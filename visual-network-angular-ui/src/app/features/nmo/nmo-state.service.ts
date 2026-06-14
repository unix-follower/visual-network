import { computed, Injectable, signal } from "@angular/core"

import { TopologyStateService } from "../../shared/network-topology/topology-state.service"
import { NMO_TOPOLOGIES } from "./nmo.data"
import {
  NmoAutomationMode,
  NmoConnection,
  NmoDevice,
  NmoDeviceKind,
  NmoHealthState,
  NmoPolicy,
  NmoRemediationReason,
  NmoTopology,
} from "./nmo.models"

interface NmoPath {
  deviceIds: string[]
  connectionIds: string[]
  score: number
}

type NmoPathMode = "primary" | "standby" | "adaptive"

interface NmoConnectionDraft {
  from: string
  to: string
  kind: NmoConnection["kind"]
  strength: NmoConnection["strength"]
  distanceKm: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  throughputMBps?: number
  utilizationPct?: number
  carrier: string
  costUsd: number
  priority: number
  health: NmoHealthState
  remediationAction: string
  policyId?: string
  notes?: string
}

@Injectable({ providedIn: "root" })
export class NmoStateService extends TopologyStateService<
  NmoTopology,
  NmoDevice,
  NmoConnection,
  NmoDeviceKind,
  NmoDevice["status"],
  NmoConnection["kind"],
  NmoConnection["strength"]
> {
  readonly controllerDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "controller" && device.status !== "offline",
    ),
  )
  readonly monitorDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "monitor" && device.status !== "offline",
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
  readonly activePolicy = computed<NmoPolicy | null>(() =>
    this.resolvePolicy(this.activeTopology(), this.selectedPolicyId()),
  )
  readonly primaryPath = computed(() =>
    this.findBestPath(
      this.activeTopology(),
      this.sourceDeviceId(),
      this.destinationDeviceId(),
      "primary",
    ),
  )
  readonly standbyPath = computed(() =>
    this.findBestPath(
      this.activeTopology(),
      this.sourceDeviceId(),
      this.destinationDeviceId(),
      "standby",
    ),
  )
  readonly backupPath = computed(() =>
    this.findBestPath(
      this.activeTopology(),
      this.sourceDeviceId(),
      this.destinationDeviceId(),
      "adaptive",
    ),
  )
  readonly activePath = computed<NmoPath>(() => {
    const policy = this.activePolicy()
    const primaryPath = this.primaryPath()
    const backupPath = this.backupPath()
    const primaryHealth = this.primaryPathHealth()

    if (!policy) {
      return primaryPath
    }

    if (
      policy.mode === "auto-failover" &&
      primaryHealth === "failed" &&
      backupPath.connectionIds.length > 0
    ) {
      return backupPath
    }

    return primaryPath
  })
  readonly activePathDeviceIds = computed(() => this.activePath().deviceIds)
  readonly activePathConnectionIds = computed(() => this.activePath().connectionIds)
  readonly activePathConnections = computed(() => {
    const connectionIds = new Set(this.activePathConnectionIds())
    return this.activeTopology().connections.filter((connection) =>
      connectionIds.has(connection.id),
    )
  })
  readonly primaryPathConnections = computed(() => {
    const connectionIds = new Set(this.primaryPath().connectionIds)
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
  readonly primaryPathHealth = computed<NmoHealthState>(() =>
    this.pathHealth(this.primaryPathConnections()),
  )
  readonly backupReadiness = computed(() => {
    const backupPath = this.standbyPath()
    if (backupPath.connectionIds.length === 0) {
      return "No standby path"
    }

    const backupConnections = this.connectionsForIds(backupPath.connectionIds)
    const backupHealth = this.pathHealth(backupConnections)
    if (backupHealth === "failed") {
      return "Standby unavailable"
    }

    if (backupHealth === "degraded") {
      return "Standby degraded"
    }

    return "Standby ready"
  })
  readonly remediationReason = computed<NmoRemediationReason>(() => {
    const policy = this.activePolicy()
    const primaryHealth = this.primaryPathHealth()
    const backupPath = this.backupPath()

    if (!policy) {
      return "no-backup-path"
    }

    if (primaryHealth === "healthy") {
      return "no-issue"
    }

    if (primaryHealth === "degraded" && policy.mode === "detect-only") {
      return "policy-hold"
    }

    if (primaryHealth === "failed" && policy.mode === "detect-only") {
      return "monitor-alert"
    }

    if (policy.mode === "auto-failover" && backupPath.connectionIds.length === 0) {
      return "no-backup-path"
    }

    if (policy.mode === "auto-failover") {
      return "auto-reroute"
    }

    return "monitor-alert"
  })
  readonly remediationState = computed(() => {
    const source = this.selectedSource()
    const destination = this.selectedDestination()
    const policy = this.activePolicy()
    const primaryHealth = this.primaryPathHealth()
    const activePathIds = this.activePathConnectionIds()

    if (!source || !destination) {
      return "idle"
    }

    if (!policy) {
      return "blocked"
    }

    if (primaryHealth === "healthy" && activePathIds.length > 0) {
      return "healthy"
    }

    if (policy.mode === "detect-only" && primaryHealth === "degraded" && activePathIds.length > 0) {
      return "detected"
    }

    if (policy.mode === "detect-only" && primaryHealth === "failed") {
      return "blocked"
    }

    if (policy.mode === "auto-failover" && primaryHealth === "failed" && activePathIds.length > 0) {
      return "failed-over"
    }

    if (
      policy.mode === "auto-failover" &&
      primaryHealth === "degraded" &&
      activePathIds.length > 0
    ) {
      return "healing"
    }

    if (activePathIds.length === 0) {
      return "blocked"
    }

    return "degraded"
  })
  readonly actionSummary = computed(() => {
    const policy = this.activePolicy()
    const state = this.remediationState()

    if (!policy) {
      return "No automation policy selected"
    }

    if (state === "healthy") {
      return "Monitoring only"
    }

    if (state === "detected") {
      return "Alert only"
    }

    if (state === "failed-over") {
      return "Backup path activated"
    }

    if (state === "healing") {
      return "Preemptive healing"
    }

    if (state === "blocked") {
      return policy.mode === "detect-only"
        ? "Operator intervention required"
        : "No recoverable path"
    }

    return "Remediation pending"
  })
  readonly policySummary = computed(
    () => this.activePolicy()?.summary ?? "Select an automation policy.",
  )
  readonly ruleSummary = computed(() => this.activePolicy()?.label ?? "Policy selection pending")
  readonly controllerSummary = computed(() => {
    const labels = this.controllerDevices().map((device) => device.label)
    return labels.length > 0 ? labels.join(", ") : "No controller active."
  })
  readonly monitorSummary = computed(() => {
    const labels = this.monitorDevices().map((device) => device.label)
    return labels.length > 0 ? labels.join(", ") : "No monitor active."
  })
  readonly remediationSummary = computed(() => this.remediationCopy(this.remediationReason()))
  readonly mttrSummary = computed(() => {
    const state = this.remediationState()
    if (state === "failed-over") {
      return "MTTR held to seconds by automated reroute."
    }
    if (state === "detected") {
      return "MTTR deferred until an operator approves remediation."
    }
    if (state === "blocked") {
      return "MTTR rising because no active service path remains."
    }
    return "MTTR nominal."
  })
  readonly pathHealthSummary = computed(() => {
    const health = this.primaryPathHealth()
    if (health === "healthy") {
      return "Primary route healthy"
    }
    if (health === "degraded") {
      return "Primary route degraded"
    }
    return "Primary route failed"
  })
  readonly carrierSummary = computed(() => {
    const carriers = [
      ...new Set(this.activePathConnections().map((connection) => connection.carrier)),
    ]
    return carriers.length > 0 ? carriers.join(", ") : "No active service links."
  })
  readonly domainSummary = computed(() => {
    const domains = this.activePathDeviceIds()
      .map(
        (deviceId) =>
          this.activeTopology().devices.find((device) => device.id === deviceId)?.domain,
      )
      .filter((domain): domain is string => Boolean(domain))

    if (domains.length === 0) {
      return "No domains traversed."
    }

    return [...new Set(domains)].join(" -> ")
  })

  constructor() {
    super(NMO_TOPOLOGIES)
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

  override addDevice(kind: NmoDeviceKind): void {
    super.addDevice(kind)
    this.normalizeEndpoints(this.activeTopology())
  }

  override removeSelectedDevice(): void {
    super.removeSelectedDevice()
    this.normalizeEndpoints(this.activeTopology())
  }

  override updateSelectedDevice(patch: Partial<NmoDevice>): void {
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

  addOrUpdateNmoConnection(draft: NmoConnectionDraft): void {
    if (!draft.from || !draft.to || draft.from === draft.to) {
      return
    }

    const throughputMBps = draft.throughputMBps ?? 0
    const utilizationPct = draft.utilizationPct ?? 0

    this.updateNmoActiveTopology((topology) => {
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
                  health: draft.health,
                  remediationAction: draft.remediationAction,
                  policyId: draft.policyId,
                  notes: draft.notes,
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
            health: draft.health,
            remediationAction: draft.remediationAction,
            policyId: draft.policyId,
            notes: draft.notes,
          },
        ],
      }
    })
  }

  protected override createDevice(
    topology: NmoTopology,
    kind: NmoDeviceKind,
    index: number,
  ): NmoDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

    if (kind === "automation-controller") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 360,
        y: 80,
        detail: "New automation controller added to the orchestration workspace.",
        site: `Controller ${index}`,
        region: "Control Plane",
        tier: "control",
        role: "controller",
        domain: "automation",
        rack: `CTRL-${index}`,
      }
    }

    if (kind === "health-monitor") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 560,
        y: 80,
        detail: "New health monitor added to the orchestration workspace.",
        site: `Monitor ${index}`,
        region: "Observability",
        tier: "observability",
        role: "monitor",
        domain: "monitoring",
        rack: `MON-${index}`,
      }
    }

    if (kind === "backup-gateway") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 560,
        y: 360,
        detail: "New backup gateway added to the orchestration workspace.",
        site: `Transport ${index}`,
        region: "Backup Transport",
        tier: "transport",
        role: "backup",
        domain: "backup",
        rack: `BKP-${index}`,
      }
    }

    if (kind === "service-endpoint") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 760,
        y: 260,
        detail: "New service endpoint added to the orchestration workspace.",
        site: `Service ${index}`,
        region: "Service Tier",
        tier: "service",
        role: "service",
        domain: "enterprise-service",
        rack: `SVC-${index}`,
        cluster: normalizedKind.toLowerCase(),
      }
    }

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "online",
      x: 140,
      y: 200 + (index % 3) * 120,
      detail: "New managed node added to the orchestration workspace.",
      site: `Node ${index}`,
      region: "Edge Access",
      tier: "edge",
      role: "source",
      domain: "branch",
      rack: `ND-${index}`,
    }
  }

  private initializeEndpoints(topology: NmoTopology): void {
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

  private normalizeEndpoints(topology: NmoTopology): void {
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

  private selectedSource(): NmoDevice | null {
    return (
      this.activeTopology().devices.find((device) => device.id === this.sourceDeviceId()) ?? null
    )
  }

  private selectedDestination(): NmoDevice | null {
    return (
      this.activeTopology().devices.find((device) => device.id === this.destinationDeviceId()) ??
      null
    )
  }

  private resolvePolicy(topology: NmoTopology, selectedPolicyId: string | null): NmoPolicy | null {
    if (!selectedPolicyId) {
      return topology.policies[0] ?? null
    }

    return (
      topology.policies.find((policy) => policy.id === selectedPolicyId) ??
      topology.policies[0] ??
      null
    )
  }

  private findBestPath(
    topology: NmoTopology,
    sourceDeviceId: string | null,
    destinationDeviceId: string | null,
    pathMode: NmoPathMode,
  ): NmoPath {
    const source = topology.devices.find((device) => device.id === sourceDeviceId) ?? null
    const destination = topology.devices.find((device) => device.id === destinationDeviceId) ?? null

    if (!source || !destination) {
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
        if (!this.isPathConnectionUsable(connection, pathMode)) {
          return
        }

        let neighborId: string | null = null
        if (connection.from === resolvedCurrentDeviceId) {
          neighborId = connection.to
        } else if (connection.to === resolvedCurrentDeviceId) {
          neighborId = connection.from
        }

        if (!neighborId) {
          return
        }

        const currentDevice = deviceById.get(resolvedCurrentDeviceId)
        const neighborDevice = deviceById.get(neighborId)
        if (currentDevice?.status === "offline" || neighborDevice?.status === "offline") {
          return
        }

        const nextScore = currentScore + this.connectionScore(connection, pathMode)
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

  private isPathConnectionUsable(connection: NmoConnection, pathMode: NmoPathMode): boolean {
    if (connection.kind === "control-link" || connection.kind === "monitor-link") {
      return false
    }

    if (pathMode === "primary") {
      return connection.kind === "primary-link" && connection.health !== "failed"
    }

    if (pathMode === "standby") {
      return connection.kind === "backup-link" && connection.health !== "failed"
    }

    return connection.health !== "failed"
  }

  private connectionScore(connection: NmoConnection, pathMode: NmoPathMode): number {
    let strengthPenalty = 0
    if (connection.strength === "medium") {
      strengthPenalty = 40
    } else if (connection.strength === "weak") {
      strengthPenalty = 110
    }

    const throughputPenalty =
      connection.throughputMBps > 0 ? 12000 / connection.throughputMBps : 12000
    const utilizationPenalty = connection.utilizationPct * 3
    const healthPenalty = connection.health === "degraded" ? 350 : 0
    const backupPenalty = pathMode === "adaptive" && connection.kind === "backup-link" ? 250 : 0

    return (
      connection.priority * 900 +
      connection.latencyMs * 12 +
      connection.jitterMs * 5 +
      connection.packetLossPct * 120 +
      throughputPenalty +
      utilizationPenalty +
      strengthPenalty +
      healthPenalty +
      backupPenalty
    )
  }

  private pathHealth(connections: NmoConnection[]): NmoHealthState {
    if (connections.length === 0) {
      return "failed"
    }

    if (connections.some((connection) => connection.health === "failed")) {
      return "failed"
    }

    if (connections.some((connection) => connection.health === "degraded")) {
      return "degraded"
    }

    return "healthy"
  }

  private connectionsForIds(connectionIds: string[]): NmoConnection[] {
    const ids = new Set(connectionIds)
    return this.activeTopology().connections.filter((connection) => ids.has(connection.id))
  }

  private remediationCopy(reason: NmoRemediationReason): string {
    switch (reason) {
      case "policy-hold":
        return "Monitoring has raised a fault alert, but detect-only policy is holding the primary route in place."
      case "monitor-alert":
        return "Monitoring has raised a fault alert and the service path now requires operator intervention."
      case "auto-reroute":
        return "Automation detected the failure and promoted the backup path automatically."
      case "no-backup-path":
        return "Automation evaluated remediation, but no viable backup path is currently available."
      default:
        return "The monitored service path is healthy."
    }
  }

  private updateNmoActiveTopology(updater: (topology: NmoTopology) => NmoTopology): void {
    const activeTopologyId = this.activeTopologyId()
    this.topologies.update((topologies) =>
      topologies.map((topology) =>
        topology.id === activeTopologyId ? updater(topology) : topology,
      ),
    )
  }
}
