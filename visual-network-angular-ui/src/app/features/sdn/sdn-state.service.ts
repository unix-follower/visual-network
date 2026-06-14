import { computed, Injectable, signal } from "@angular/core"

import { TopologyStateService } from "../../shared/network-topology/topology-state.service"
import { SDN_TOPOLOGIES } from "./sdn.data"
import { SdnConnection, SdnDevice, SdnDeviceKind, SdnPolicy, SdnTopology } from "./sdn.models"

interface SdnPath {
  deviceIds: string[]
  connectionIds: string[]
  score: number
}

interface SdnConnectionDraft {
  from: string
  to: string
  kind: SdnConnection["kind"]
  strength: SdnConnection["strength"]
  distanceKm: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  bandwidthMbps: number
  carrier: string
  costUsd: number
  priority: number
  intents?: SdnConnection["intents"]
}

@Injectable({ providedIn: "root" })
export class SdnStateService extends TopologyStateService<
  SdnTopology,
  SdnDevice,
  SdnConnection,
  SdnDeviceKind,
  SdnDevice["status"],
  SdnConnection["kind"],
  SdnConnection["strength"]
> {
  readonly controllerDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "controller" && device.status !== "offline",
    ),
  )
  readonly sourceDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "site" && device.status !== "offline",
    ),
  )
  readonly endpointDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) =>
        (device.role === "site" || device.role === "service") && device.status !== "offline",
    ),
  )
  readonly selectedPolicyId = signal<string | null>(null)
  readonly activePolicy = computed(() => {
    const topology = this.activeTopology()

    return (
      topology.policies.find((policy) => policy.id === this.selectedPolicyId()) ??
      this.defaultPolicy()
    )
  })
  readonly sourceDeviceId = signal<string | null>(null)
  readonly destinationDeviceId = signal<string | null>(null)
  readonly baselinePath = computed<SdnPath>(() =>
    this.findBestPath(
      this.activeTopology(),
      this.sourceDeviceId(),
      this.destinationDeviceId(),
      this.defaultPolicy(),
    ),
  )
  readonly activePath = computed<SdnPath>(() =>
    this.findBestPath(
      this.activeTopology(),
      this.sourceDeviceId(),
      this.destinationDeviceId(),
      this.activePolicy(),
    ),
  )
  readonly activePathDeviceIds = computed(() => this.activePath().deviceIds)
  readonly activePathConnectionIds = computed(() => this.activePath().connectionIds)
  readonly activePathConnections = computed(() => {
    const connectionIds = new Set(this.activePathConnectionIds())
    return this.activeTopology().connections.filter((connection) =>
      connectionIds.has(connection.id),
    )
  })
  readonly activeDistanceKm = computed(() =>
    this.activePathConnections().reduce((total, connection) => total + connection.distanceKm, 0),
  )
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
  readonly activeBandwidthMbps = computed(() => {
    const connections = this.activePathConnections()

    if (connections.length === 0) {
      return 0
    }

    return connections.reduce(
      (minimum, connection) => Math.min(minimum, connection.bandwidthMbps),
      Number.POSITIVE_INFINITY,
    )
  })
  readonly controllerSummary = computed(() => {
    const labels = this.controllerDevices().map((device) => device.label)
    return labels.length > 0 ? labels.join(", ") : "No controllers active."
  })
  readonly policySummary = computed(() => this.activePolicy()?.label ?? "No policy active")
  readonly overrideReason = computed(() => {
    const pathState = this.failoverState()

    if (pathState === "blocked") {
      return "No controller-approved path is currently available."
    }

    if (pathState === "policy-override") {
      return this.activePolicy()?.overrideReason ?? "Controller has overridden the forwarding path."
    }

    if (pathState === "idle") {
      return "Source and destination are the same endpoint, so traffic stays local."
    }

    return this.activePolicy()?.summary ?? "Controller is using the active policy."
  })
  readonly failoverState = computed(() => {
    const path = this.activePath()
    const sourceDeviceId = this.sourceDeviceId()
    const destinationDeviceId = this.destinationDeviceId()

    if (path.connectionIds.length === 0) {
      if (!sourceDeviceId || !destinationDeviceId || sourceDeviceId === destinationDeviceId) {
        return "idle"
      }

      return "blocked"
    }

    const pathConnections = this.activePathConnections()
    const pathDevices = this.activePathDeviceIds().map((deviceId) =>
      this.activeTopology().devices.find((device) => device.id === deviceId),
    )

    if (!this.matchesPath(path.connectionIds, this.baselinePath().connectionIds)) {
      return "policy-override"
    }

    if (pathConnections.some((connection) => connection.priority > 1)) {
      return "failover"
    }

    if (
      pathConnections.some((connection) => connection.strength !== "strong") ||
      pathDevices.some((device) => device?.status === "degraded")
    ) {
      return "degraded"
    }

    return "primary"
  })
  readonly redundancySummary = computed(() => {
    const sourceDeviceId = this.sourceDeviceId()
    const destinationDeviceId = this.destinationDeviceId()
    const pathState = this.failoverState()

    if (!sourceDeviceId || !destinationDeviceId) {
      return "Awaiting SDN endpoints"
    }

    if (sourceDeviceId === destinationDeviceId) {
      return "Local route"
    }

    if (pathState === "policy-override") {
      return "Intent enforced"
    }

    if (pathState === "blocked") {
      return "No resilience"
    }

    if (pathState === "failover") {
      return "Backup active"
    }

    if (pathState === "degraded") {
      return this.hasAlternatePath(this.activePathConnectionIds())
        ? "Protected"
        : "Primary degraded"
    }

    return this.hasAlternatePath(this.activePathConnectionIds()) ? "Protected" : "Single path"
  })
  readonly carrierSummary = computed(() => {
    const carriers = [
      ...new Set(this.activePathConnections().map((connection) => connection.carrier)),
    ]

    if (carriers.length === 0) {
      return "No SDN transports active."
    }

    return carriers.join(", ")
  })

  constructor() {
    super(SDN_TOPOLOGIES)
    this.initializeEndpoints(this.activeTopology())
    this.initializePolicy(this.activeTopology())
  }

  override selectTopology(topologyId: string): void {
    super.selectTopology(topologyId)
    this.initializeEndpoints(this.activeTopology())
    this.initializePolicy(this.activeTopology())
  }

  override addDevice(kind: SdnDeviceKind): void {
    super.addDevice(kind)
    this.normalizeEndpoints(this.activeTopology())
  }

  override removeSelectedDevice(): void {
    super.removeSelectedDevice()
    this.normalizeEndpoints(this.activeTopology())
  }

  override updateSelectedDevice(patch: Partial<SdnDevice>): void {
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

  addOrUpdateSdnConnection(draft: SdnConnectionDraft): void {
    if (!draft.from || !draft.to || draft.from === draft.to) {
      return
    }

    this.updateSdnActiveTopology((topology) => {
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
                  bandwidthMbps: draft.bandwidthMbps,
                  carrier: draft.carrier,
                  costUsd: draft.costUsd,
                  priority: draft.priority,
                  intents: draft.intents ?? existingConnection.intents,
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
            bandwidthMbps: draft.bandwidthMbps,
            carrier: draft.carrier,
            costUsd: draft.costUsd,
            priority: draft.priority,
            intents: draft.intents ?? this.defaultIntentsForKind(draft.kind),
          },
        ],
      }
    })
  }

  protected override createDevice(
    topology: SdnTopology,
    kind: SdnDeviceKind,
    index: number,
  ): SdnDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

    if (kind === "provider-handoff" || kind === "uplink") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "degraded",
        x: 180 + (index % 4) * 150,
        y: 160 + (index % 3) * 90,
        detail: "New SDN transport edge added to the topology.",
        site: `Transit ${index}`,
        region: "Transit",
        tier: "fabric",
        role: "transit",
      }
    }

    if (kind === "controller") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 240 + (index % 3) * 170,
        y: 90,
        detail: "New SDN controller added to the topology.",
        site: `Controller ${index}`,
        region: "Operations",
        tier: "control",
        role: "controller",
      }
    }

    let tier: SdnDevice["tier"] = "edge"
    let role: SdnDevice["role"] = "site"

    if (kind === "metro-core" || kind === "fabric-switch") {
      tier = "fabric"
    }

    if (kind === "service-handoff" || kind === "service-endpoint") {
      tier = "service"
      role = "service"
    }

    if (kind === "access-node" || kind === "building-distribution" || kind === "edge-switch") {
      tier = "edge"
    }

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "degraded",
      x: 180 + (index % 4) * 150,
      y: 220 + (index % 2) * 120,
      detail: `New ${normalizedKind.toLowerCase()} node added to the SDN topology.`,
      site: `${normalizedKind} ${index}`,
      region: "Policy fabric",
      tier,
      role,
    }
  }

  private initializeEndpoints(topology: SdnTopology): void {
    const sources = topology.devices.filter(
      (device) => device.role === "site" && device.status !== "offline",
    )
    const endpoints = topology.devices.filter(
      (device) =>
        (device.role === "site" || device.role === "service") && device.status !== "offline",
    )
    const sourceId = sources[0]?.id ?? null
    const destinationId = this.preferredDestinationId(sourceId, sources, endpoints)

    this.sourceDeviceId.set(sourceId)
    this.destinationDeviceId.set(destinationId)
    this.selectedDeviceId.set(sourceId ?? destinationId)
  }

  private initializePolicy(topology: SdnTopology): void {
    const defaultPolicy =
      topology.policies.find((policy) => policy.id === topology.defaultPolicyId) ??
      topology.policies[0] ??
      null
    this.selectedPolicyId.set(defaultPolicy?.id ?? null)
  }

  private normalizeEndpoints(topology: SdnTopology): void {
    const sources = topology.devices.filter(
      (device) => device.role === "site" && device.status !== "offline",
    )
    const endpoints = topology.devices.filter(
      (device) =>
        (device.role === "site" || device.role === "service") && device.status !== "offline",
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

    if (
      !nextDestinationId ||
      !endpointIds.has(nextDestinationId) ||
      nextDestinationId === nextSourceId
    ) {
      nextDestinationId = this.preferredDestinationId(nextSourceId, sources, endpoints)
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

  private defaultPolicy(): SdnPolicy | null {
    const topology = this.activeTopology()
    return (
      topology.policies.find((policy) => policy.id === topology.defaultPolicyId) ??
      topology.policies[0] ??
      null
    )
  }

  private preferredDestinationId(
    sourceId: string | null,
    sources: readonly SdnDevice[],
    endpoints: readonly SdnDevice[],
  ): string | null {
    return (
      endpoints.find((device) => device.role === "service" && device.id !== sourceId)?.id ??
      sources.find((device) => device.id !== sourceId)?.id ??
      endpoints.find((device) => device.id !== sourceId)?.id ??
      sourceId
    )
  }

  private findBestPath(
    topology: SdnTopology,
    sourceDeviceId: string | null,
    destinationDeviceId: string | null,
    policy: SdnPolicy | null,
  ): SdnPath {
    if (!sourceDeviceId || !destinationDeviceId || !policy) {
      return { deviceIds: [], connectionIds: [], score: Number.POSITIVE_INFINITY }
    }

    if (sourceDeviceId === destinationDeviceId) {
      return { deviceIds: [sourceDeviceId], connectionIds: [], score: 0 }
    }

    const deviceById = new Map(topology.devices.map((device) => [device.id, device]))
    const scores = new Map<string, number>([[sourceDeviceId, 0]])
    const previousDevice = new Map<string, { deviceId: string; connectionId: string }>()
    const queue = new Set<string>([sourceDeviceId])

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

      const currentId = currentDeviceId

      queue.delete(currentId)

      if (currentId === destinationDeviceId) {
        break
      }

      topology.connections.forEach((connection) => {
        let neighborId: string | null = null

        if (connection.from === currentId) {
          neighborId = connection.to
        } else if (connection.to === currentId) {
          neighborId = connection.from
        }

        if (!neighborId || this.policyBlocksConnection(connection, policy)) {
          return
        }

        const currentDevice = deviceById.get(currentId)
        const neighborDevice = deviceById.get(neighborId)

        if (currentDevice?.status === "offline" || neighborDevice?.status === "offline") {
          return
        }

        const nextScore = currentScore + this.connectionScore(connection, policy)

        if (nextScore >= (scores.get(neighborId) ?? Number.POSITIVE_INFINITY)) {
          return
        }

        scores.set(neighborId, nextScore)
        previousDevice.set(neighborId, { deviceId: currentId, connectionId: connection.id })
        queue.add(neighborId)
      })
    }

    if (!previousDevice.has(destinationDeviceId)) {
      return { deviceIds: [sourceDeviceId], connectionIds: [], score: Number.POSITIVE_INFINITY }
    }

    const deviceIds: string[] = []
    const connectionIds: string[] = []
    let currentDeviceId = destinationDeviceId

    while (currentDeviceId !== sourceDeviceId) {
      deviceIds.unshift(currentDeviceId)
      const previousHop = previousDevice.get(currentDeviceId)

      if (!previousHop) {
        return { deviceIds: [sourceDeviceId], connectionIds: [], score: Number.POSITIVE_INFINITY }
      }

      connectionIds.unshift(previousHop.connectionId)
      currentDeviceId = previousHop.deviceId
    }

    deviceIds.unshift(sourceDeviceId)
    return {
      deviceIds,
      connectionIds,
      score: scores.get(destinationDeviceId) ?? Number.POSITIVE_INFINITY,
    }
  }

  private connectionScore(connection: SdnConnection, policy: SdnPolicy): number {
    let strengthPenalty = 0

    if (connection.strength === "medium") {
      strengthPenalty = 45
    } else if (connection.strength === "weak") {
      strengthPenalty = 110
    }

    const intentPenalty = connection.intents.includes(policy.intent) ? 0 : 5000
    const resilienceBonus =
      policy.intent === "resilience" && connection.kind === "backup-link" ? -25 : 0

    return (
      intentPenalty +
      connection.priority * 1000 +
      connection.latencyMs * 10 +
      connection.jitterMs * 4 +
      connection.packetLossPct * 120 +
      strengthPenalty +
      resilienceBonus
    )
  }

  private hasAlternatePath(excludedConnectionIds: string[]): boolean {
    const excludedConnectionIdSet = new Set(excludedConnectionIds)
    const reducedTopology: SdnTopology = {
      ...this.activeTopology(),
      connections: this.activeTopology().connections.filter(
        (connection) => !excludedConnectionIdSet.has(connection.id),
      ),
    }
    const alternatePath = this.findBestPath(
      reducedTopology,
      this.sourceDeviceId(),
      this.destinationDeviceId(),
      this.activePolicy(),
    )

    return alternatePath.connectionIds.length > 0
  }

  private matchesPath(activePathConnectionIds: string[], baselineConnectionIds: string[]): boolean {
    if (activePathConnectionIds.length !== baselineConnectionIds.length) {
      return false
    }

    return activePathConnectionIds.every(
      (connectionId, index) => connectionId === baselineConnectionIds[index],
    )
  }

  private policyBlocksConnection(connection: SdnConnection, policy: SdnPolicy): boolean {
    return (
      policy.intent === "compliance" &&
      !connection.intents.includes("compliance") &&
      connection.kind === "backup-link"
    )
  }

  private defaultIntentsForKind(kind: SdnConnection["kind"]): SdnConnection["intents"] {
    switch (kind) {
      case "backup-link":
        return ["resilience"]
      case "direct-link":
      case "leased-line":
        return ["latency", "compliance", "resilience"]
      case "fabric-link":
      case "metro-fiber":
        return ["latency", "resilience"]
      default:
        return ["latency"]
    }
  }

  private updateSdnActiveTopology(updater: (topology: SdnTopology) => SdnTopology): void {
    const activeTopologyId = this.activeTopologyId()

    this.topologies.update((topologies) =>
      topologies.map((topology) =>
        topology.id === activeTopologyId ? updater(topology) : topology,
      ),
    )
  }
}
