import { computed, Injectable, signal } from "@angular/core"

import { TopologyStateService } from "../../shared/network-topology/topology-state.service"
import { ACN_TOPOLOGIES } from "./acn.data"
import {
  AcnConnection,
  AcnDevice,
  AcnDeviceKind,
  AcnPolicy,
  AcnPolicyAction,
  AcnTopology,
  AcnViolationReason,
} from "./acn.models"

interface AcnPath {
  deviceIds: string[]
  connectionIds: string[]
  score: number
}

interface AcnConnectionDraft {
  from: string
  to: string
  kind: AcnConnection["kind"]
  strength: AcnConnection["strength"]
  distanceKm: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  throughputMBps?: number
  utilizationPct?: number
  carrier: string
  costUsd: number
  priority: number
  action: AcnPolicyAction
  ruleId: string
  sourceZone: string
  destinationZone: string
}

@Injectable({ providedIn: "root" })
export class AcnStateService extends TopologyStateService<
  AcnTopology,
  AcnDevice,
  AcnConnection,
  AcnDeviceKind,
  AcnDevice["status"],
  AcnConnection["kind"],
  AcnConnection["strength"]
> {
  readonly enforcementDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "security" && device.status !== "offline",
    ),
  )
  readonly sourceDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "source" && device.status !== "offline",
    ),
  )
  readonly endpointDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "service" && device.status !== "offline",
    ),
  )
  readonly selectedPolicyId = signal<string | null>(null)
  readonly sourceDeviceId = signal<string | null>(null)
  readonly destinationDeviceId = signal<string | null>(null)
  readonly activePolicy = computed<AcnPolicy | null>(() =>
    this.resolvePolicy(this.activeTopology(), this.selectedSource(), this.selectedDestination()),
  )
  readonly activePath = computed<AcnPath>(() =>
    this.findBestPath(this.activeTopology(), this.sourceDeviceId(), this.destinationDeviceId()),
  )
  readonly activePathDeviceIds = computed(() => this.activePath().deviceIds)
  readonly activePathConnectionIds = computed(() => this.activePath().connectionIds)
  readonly activePathConnections = computed(() => {
    const connectionIds = new Set(this.activePathConnectionIds())
    return this.activeTopology().connections.filter((connection) =>
      connectionIds.has(connection.id),
    )
  })
  readonly activeLatencyMs = computed(() =>
    this.activePathConnections().reduce((total, connection) => total + connection.latencyMs, 0),
  )
  readonly activeJitterMs = computed(() =>
    this.activePathConnections().reduce((total, connection) => total + connection.jitterMs, 0),
  )
  readonly activePacketLossPct = computed(() =>
    this.activePathConnections().reduce((total, connection) => total + connection.packetLossPct, 0),
  )
  readonly activeCostUsd = computed(() =>
    this.activePathConnections().reduce((total, connection) => total + connection.costUsd, 0),
  )
  readonly activeThroughputMBps = computed(() => {
    if (this.activePathConnections().length === 0) {
      return 0
    }

    return this.activePathConnections().reduce(
      (minimum, connection) => Math.min(minimum, connection.throughputMBps),
      Number.POSITIVE_INFINITY,
    )
  })
  readonly activeUtilizationPct = computed(() => {
    if (this.activePathConnections().length === 0) {
      return 0
    }

    return Math.max(...this.activePathConnections().map((connection) => connection.utilizationPct))
  })
  readonly ruleSummary = computed(() => this.activePolicy()?.label ?? "Policy selection pending")
  readonly policySummary = computed(
    () => this.activePolicy()?.summary ?? "Select source and service to evaluate policy.",
  )
  readonly controllerSummary = computed(() => {
    const labels = this.enforcementDevices().map((device) => device.label)
    return labels.length > 0 ? labels.join(", ") : "No enforcement point active."
  })
  readonly violationReason = computed<AcnViolationReason>(() => {
    const source = this.selectedSource()
    const destination = this.selectedDestination()
    const policy = this.activePolicy()

    if (!source || !destination) {
      return "no-violation"
    }

    if (!policy) {
      return "implicit-deny"
    }

    if (policy.sourceZone !== source.zone || policy.destinationZone !== destination.zone) {
      return "zone-mismatch"
    }

    return policy.violationReason
  })
  readonly failoverState = computed(() => {
    const source = this.selectedSource()
    const destination = this.selectedDestination()
    const policy = this.activePolicy()

    if (!source || !destination) {
      return "idle"
    }

    if (!policy) {
      return "policy-violation"
    }

    if (policy.action === "block" || this.violationReason() === "zone-mismatch") {
      return "policy-violation"
    }

    if (this.activePathConnectionIds().length === 0) {
      return "blocked"
    }

    if (
      policy.action === "inspect" ||
      this.activePathConnections().some((connection) => connection.kind === "inspection-link")
    ) {
      return "inspected"
    }

    return "allowed"
  })
  readonly overrideReason = computed(() => {
    const state = this.failoverState()

    if (state === "policy-violation") {
      return this.policyViolationCopy(this.violationReason())
    }

    if (state === "blocked") {
      return "No allowed security path is currently available between the selected source and service."
    }

    if (state === "inspected") {
      return "Traffic is permitted, but it must traverse the inspection chain before reaching the service."
    }

    if (state === "idle") {
      return "Choose a source host and service destination to inspect policy enforcement behavior."
    }

    return "Traffic matches the active security rule and is allowed through the enforcement path."
  })
  readonly redundancySummary = computed(() => {
    const source = this.selectedSource()
    const destination = this.selectedDestination()
    const state = this.failoverState()

    if (!source || !destination) {
      return "Awaiting endpoints"
    }

    if (state === "policy-violation" || state === "blocked") {
      return "No permitted alternate"
    }

    return this.hasAlternateAllowedPath() ? "Protected" : "Single permitted path"
  })
  readonly protectionSummary = computed(() => {
    const state = this.failoverState()

    if (state === "policy-violation") {
      return this.policyViolationCopy(this.violationReason())
    }

    if (state === "blocked") {
      return "Default deny active"
    }

    if (state === "inspected") {
      return "Inspection required"
    }

    if (state === "idle") {
      return "Policy evaluation pending"
    }

    return "Explicit allow"
  })
  readonly zoneSummary = computed(() => {
    const zones = this.activePathDeviceIds()
      .map(
        (deviceId) => this.activeTopology().devices.find((device) => device.id === deviceId)?.zone,
      )
      .filter((zone): zone is string => Boolean(zone))

    if (zones.length === 0) {
      return "No zones traversed."
    }

    return [...new Set(zones)].join(" -> ")
  })
  readonly carrierSummary = computed(() => {
    const carriers = [
      ...new Set(this.activePathConnections().map((connection) => connection.carrier)),
    ]
    return carriers.length > 0 ? carriers.join(", ") : "No active policy links."
  })

  constructor() {
    super(ACN_TOPOLOGIES)
    this.selectedPolicyId.set(
      this.activeTopology().defaultPolicyId ?? this.activeTopology().policies[0]?.id ?? null,
    )
    this.initializeEndpoints(this.activeTopology())
  }

  override selectTopology(topologyId: string): void {
    super.selectTopology(topologyId)
    this.selectedPolicyId.set(
      this.activeTopology().defaultPolicyId ?? this.activeTopology().policies[0]?.id ?? null,
    )
    this.initializeEndpoints(this.activeTopology())
  }

  override addDevice(kind: AcnDeviceKind): void {
    super.addDevice(kind)
    this.normalizeEndpoints(this.activeTopology())
  }

  override removeSelectedDevice(): void {
    super.removeSelectedDevice()
    this.normalizeEndpoints(this.activeTopology())
  }

  override updateSelectedDevice(patch: Partial<AcnDevice>): void {
    super.updateSelectedDevice(patch)
    this.normalizeEndpoints(this.activeTopology())
  }

  selectPolicy(policyId: string): void {
    if (!this.activeTopology().policies.some((policy) => policy.id === policyId)) {
      return
    }

    this.selectedPolicyId.set(policyId)
  }

  selectSourceDevice(deviceId: string): void {
    if (!this.sourceDevices().some((device) => device.id === deviceId)) {
      return
    }

    this.sourceDeviceId.set(deviceId)
    this.selectedDeviceId.set(deviceId)
  }

  selectDestinationDevice(deviceId: string): void {
    if (!this.endpointDevices().some((device) => device.id === deviceId)) {
      return
    }

    this.destinationDeviceId.set(deviceId)
  }

  addOrUpdateAcnConnection(draft: AcnConnectionDraft): void {
    if (!draft.from || !draft.to || draft.from === draft.to) {
      return
    }

    const throughputMBps = draft.throughputMBps ?? 0
    const utilizationPct = draft.utilizationPct ?? 0

    this.updateAcnActiveTopology((topology) => {
      const existingConnection = topology.connections.find(
        (connection) =>
          (connection.from === draft.from && connection.to === draft.to) ||
          (connection.from === draft.to && connection.to === draft.from),
      )

      if (existingConnection) {
        return {
          ...topology,
          connections: topology.connections.map((connection) =>
            connection.id === existingConnection.id
              ? {
                  ...connection,
                  kind: draft.kind,
                  strength: draft.strength,
                  distanceKm: draft.distanceKm,
                  latencyMs: draft.latencyMs,
                  jitterMs: draft.jitterMs,
                  packetLossPct: draft.packetLossPct,
                  throughputMBps,
                  utilizationPct,
                  carrier: draft.carrier,
                  costUsd: draft.costUsd,
                  priority: draft.priority,
                  action: draft.action,
                  ruleId: draft.ruleId,
                  sourceZone: draft.sourceZone,
                  destinationZone: draft.destinationZone,
                }
              : connection,
          ),
        }
      }

      return {
        ...topology,
        connections: [
          ...topology.connections,
          {
            id: this.createConnectionId(draft.from, draft.to),
            from: draft.from,
            to: draft.to,
            kind: draft.kind,
            strength: draft.strength,
            distanceKm: draft.distanceKm,
            latencyMs: draft.latencyMs,
            jitterMs: draft.jitterMs,
            packetLossPct: draft.packetLossPct,
            throughputMBps,
            utilizationPct,
            carrier: draft.carrier,
            costUsd: draft.costUsd,
            priority: draft.priority,
            action: draft.action,
            ruleId: draft.ruleId,
            sourceZone: draft.sourceZone,
            destinationZone: draft.destinationZone,
          },
        ],
      }
    })
  }

  protected override createDevice(
    topology: AcnTopology,
    kind: AcnDeviceKind,
    index: number,
  ): AcnDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

    if (kind === "access-firewall") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 380,
        y: 300,
        detail: "New firewall added to the security topology.",
        site: `Firewall ${index}`,
        region: "Enforcement Tier",
        tier: "enforcement",
        role: "security",
        zone: "inspection",
        rack: `FW-${index}`,
      }
    }

    if (kind === "service-host") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 760,
        y: 200 + (index % 3) * 120,
        detail: "New protected service added to the security topology.",
        site: `Service ${index}`,
        region: "Service Tier",
        tier: "service",
        role: "service",
        zone: "business",
        rack: `SVC-${index}`,
        cluster: normalizedKind.toLowerCase(),
      }
    }

    if (kind === "management-station") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 560,
        y: 520,
        detail: "New management station added to the security topology.",
        site: `Operations ${index}`,
        region: "Operations Tier",
        tier: "operations",
        role: "management",
        zone: "operations",
        rack: `OPS-${index}`,
      }
    }

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "online",
      x: 140,
      y: 200 + (index % 3) * 120,
      detail: "New source host added to the security topology.",
      site: `Client ${index}`,
      region: "User Access Layer",
      tier: "client",
      role: "source",
      zone: "user",
      rack: `SRC-${index}`,
      cluster: normalizedKind.toLowerCase(),
    }
  }

  private initializeEndpoints(topology: AcnTopology): void {
    const source = topology.devices.find(
      (device) => device.role === "source" && device.status !== "offline",
    )
    const destination = topology.devices.find(
      (device) => device.role === "service" && device.status !== "offline",
    )
    this.sourceDeviceId.set(source?.id ?? null)
    this.destinationDeviceId.set(destination?.id ?? null)
    this.selectedDeviceId.set(source?.id ?? destination?.id ?? null)
  }

  private normalizeEndpoints(topology: AcnTopology): void {
    const sources = topology.devices.filter(
      (device) => device.role === "source" && device.status !== "offline",
    )
    const endpoints = topology.devices.filter(
      (device) => device.role === "service" && device.status !== "offline",
    )
    const sourceIds = new Set(sources.map((device) => device.id))
    const endpointIds = new Set(endpoints.map((device) => device.id))
    const currentSourceId = this.sourceDeviceId()
    const currentDestinationId = this.destinationDeviceId()
    const currentSelectedId = this.selectedDeviceId()

    let nextSourceId = currentSourceId
    if (!nextSourceId || !sourceIds.has(nextSourceId)) {
      nextSourceId = sources[0]?.id ?? null
    }

    let nextDestinationId = currentDestinationId
    if (!nextDestinationId || !endpointIds.has(nextDestinationId)) {
      nextDestinationId = endpoints[0]?.id ?? null
    }

    this.sourceDeviceId.set(nextSourceId)
    this.destinationDeviceId.set(nextDestinationId)

    if (currentSelectedId === currentSourceId && currentSourceId !== nextSourceId) {
      this.selectedDeviceId.set(nextSourceId ?? nextDestinationId)
      return
    }

    if (currentSelectedId === currentDestinationId && currentDestinationId !== nextDestinationId) {
      this.selectedDeviceId.set(nextDestinationId ?? nextSourceId)
    }
  }

  private selectedSource(): AcnDevice | null {
    return (
      this.activeTopology().devices.find((device) => device.id === this.sourceDeviceId()) ?? null
    )
  }

  private selectedDestination(): AcnDevice | null {
    return (
      this.activeTopology().devices.find((device) => device.id === this.destinationDeviceId()) ??
      null
    )
  }

  private resolvePolicy(
    topology: AcnTopology,
    source: AcnDevice | null,
    destination: AcnDevice | null,
  ): AcnPolicy | null {
    if (!source || !destination) {
      return topology.policies[0] ?? null
    }

    const explicitPolicyId = this.selectedPolicyId()
    const explicitPolicy = explicitPolicyId
      ? (topology.policies.find((policy) => policy.id === explicitPolicyId) ?? null)
      : null

    if (
      explicitPolicy &&
      explicitPolicy.sourceZone === source.zone &&
      explicitPolicy.destinationZone === destination.zone
    ) {
      return explicitPolicy
    }

    return (
      topology.policies.find(
        (policy) =>
          policy.sourceZone === source.zone && policy.destinationZone === destination.zone,
      ) ??
      explicitPolicy ??
      null
    )
  }

  private findBestPath(
    topology: AcnTopology,
    sourceDeviceId: string | null,
    destinationDeviceId: string | null,
  ): AcnPath {
    const source = topology.devices.find((device) => device.id === sourceDeviceId) ?? null
    const destination = topology.devices.find((device) => device.id === destinationDeviceId) ?? null
    const policy = this.resolvePolicy(topology, source, destination)

    if (!source || !destination || !policy || policy.action === "block") {
      return {
        deviceIds: sourceDeviceId ? [sourceDeviceId] : [],
        connectionIds: [],
        score: Number.POSITIVE_INFINITY,
      }
    }

    const deviceById = new Map(topology.devices.map((device) => [device.id, device]))
    const scores = new Map<string, number>([[source.id, 0]])
    const previousDevice = new Map<string, { deviceId: string; connectionId: string }>()
    const queue = new Set<string>([source.id])

    while (queue.size > 0) {
      let currentDeviceId: string | null = null
      let currentScore = Number.POSITIVE_INFINITY

      queue.forEach((deviceId) => {
        const score = scores.get(deviceId) ?? Number.POSITIVE_INFINITY
        if (score < currentScore) {
          currentDeviceId = deviceId
          currentScore = score
        }
      })

      if (!currentDeviceId) {
        break
      }

      const resolvedCurrentDeviceId = currentDeviceId

      queue.delete(resolvedCurrentDeviceId)

      if (resolvedCurrentDeviceId === destination.id) {
        break
      }

      topology.connections.forEach((connection) => {
        let neighborId: string | null = null

        if (connection.from === resolvedCurrentDeviceId) {
          neighborId = connection.to
        } else if (connection.to === resolvedCurrentDeviceId) {
          neighborId = connection.from
        }

        if (!neighborId || !this.isConnectionAllowed(connection, policy)) {
          return
        }

        const currentDevice = deviceById.get(resolvedCurrentDeviceId)
        const neighborDevice = deviceById.get(neighborId)

        if (currentDevice?.status === "offline" || neighborDevice?.status === "offline") {
          return
        }

        const nextScore = currentScore + this.connectionScore(connection, policy.action)
        if (nextScore >= (scores.get(neighborId) ?? Number.POSITIVE_INFINITY)) {
          return
        }

        scores.set(neighborId, nextScore)
        previousDevice.set(neighborId, {
          deviceId: resolvedCurrentDeviceId,
          connectionId: connection.id,
        })
        queue.add(neighborId)
      })
    }

    if (!previousDevice.has(destination.id)) {
      return { deviceIds: [source.id], connectionIds: [], score: Number.POSITIVE_INFINITY }
    }

    const deviceIds: string[] = []
    const connectionIds: string[] = []
    let currentDeviceId = destination.id

    while (currentDeviceId !== source.id) {
      deviceIds.unshift(currentDeviceId)
      const previousHop = previousDevice.get(currentDeviceId)

      if (!previousHop) {
        return { deviceIds: [source.id], connectionIds: [], score: Number.POSITIVE_INFINITY }
      }

      connectionIds.unshift(previousHop.connectionId)
      currentDeviceId = previousHop.deviceId
    }

    deviceIds.unshift(source.id)
    return {
      deviceIds,
      connectionIds,
      score: scores.get(destination.id) ?? Number.POSITIVE_INFINITY,
    }
  }

  private isConnectionAllowed(connection: AcnConnection, policy: AcnPolicy): boolean {
    if (connection.kind === "blocked-link") {
      return false
    }

    if (policy.action === "inspect") {
      return connection.action === "inspect" || connection.action === "allow"
    }

    return connection.action !== "block"
  }

  private connectionScore(connection: AcnConnection, policyAction: AcnPolicyAction): number {
    let strengthPenalty = 0

    if (connection.strength === "medium") {
      strengthPenalty = 40
    } else if (connection.strength === "weak") {
      strengthPenalty = 110
    }

    const throughputPenalty =
      connection.throughputMBps > 0 ? 12000 / connection.throughputMBps : 12000
    const utilizationPenalty = connection.utilizationPct * 3
    const inspectionPenalty =
      policyAction === "inspect" && connection.kind !== "inspection-link" ? 600 : 0

    return (
      connection.priority * 900 +
      connection.latencyMs * 12 +
      connection.jitterMs * 5 +
      connection.packetLossPct * 120 +
      throughputPenalty +
      utilizationPenalty +
      strengthPenalty +
      inspectionPenalty
    )
  }

  private hasAlternateAllowedPath(): boolean {
    const activeConnectionIds = this.activePathConnectionIds()
    if (activeConnectionIds.length === 0) {
      return false
    }

    const reducedTopology: AcnTopology = {
      ...this.activeTopology(),
      connections: this.activeTopology().connections.filter(
        (connection) =>
          !activeConnectionIds.includes(connection.id) && connection.kind !== "blocked-link",
      ),
    }
    const alternatePath = this.findBestPath(
      reducedTopology,
      this.sourceDeviceId(),
      this.destinationDeviceId(),
    )
    return alternatePath.connectionIds.length > 0
  }

  private policyViolationCopy(reason: AcnViolationReason): string {
    switch (reason) {
      case "explicit-block":
        return "The selected source and service pair matches an explicit block rule."
      case "zone-mismatch":
        return "The selected source and destination zones do not match the active policy scope."
      case "implicit-deny":
        return "No matching allow rule exists, so default deny blocks the path."
      default:
        return "No policy violation detected."
    }
  }

  private updateAcnActiveTopology(updater: (topology: AcnTopology) => AcnTopology): void {
    const activeTopologyId = this.activeTopologyId()
    this.topologies.update((topologies) =>
      topologies.map((topology) =>
        topology.id === activeTopologyId ? updater(topology) : topology,
      ),
    )
  }
}
