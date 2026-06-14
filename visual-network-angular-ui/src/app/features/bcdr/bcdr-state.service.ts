import { computed, Injectable, signal } from "@angular/core"

import { TopologyStateService } from "../../shared/network-topology/topology-state.service"
import { BCDR_TOPOLOGIES } from "./bcdr.data"
import {
  BcdrConnection,
  BcdrDevice,
  BcdrDeviceKind,
  BcdrHealthState,
  BcdrPolicy,
  BcdrRecoveryReason,
  BcdrRecoveryStrategy,
  BcdrTopology,
} from "./bcdr.models"

interface BcdrPath {
  deviceIds: string[]
  connectionIds: string[]
  score: number
}

type BcdrPathMode = "primary" | "standby" | "adaptive"

interface BcdrConnectionDraft {
  from: string
  to: string
  kind: BcdrConnection["kind"]
  strength: BcdrConnection["strength"]
  distanceKm: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  throughputMBps?: number
  utilizationPct?: number
  carrier: string
  costUsd: number
  priority: number
  health: BcdrHealthState
  recoveryAction: string
  policyId?: string
  notes?: string
}

@Injectable({ providedIn: "root" })
export class BcdrStateService extends TopologyStateService<
  BcdrTopology,
  BcdrDevice,
  BcdrConnection,
  BcdrDeviceKind,
  BcdrDevice["status"],
  BcdrConnection["kind"],
  BcdrConnection["strength"]
> {
  readonly controllerDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "controller" && device.status !== "offline",
    ),
  )
  readonly sourceDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "source" && device.status !== "offline",
    ),
  )
  readonly endpointDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) =>
        (device.role === "primary" || device.role === "recovery") && device.status !== "offline",
    ),
  )
  readonly recoveryDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "recovery" && device.status !== "offline",
    ),
  )
  readonly storageDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "storage" && device.status !== "offline",
    ),
  )
  readonly selectedPolicyId = signal<string | null>(null)
  readonly sourceDeviceId = signal<string | null>(null)
  readonly destinationDeviceId = signal<string | null>(null)
  readonly activePolicy = computed<BcdrPolicy | null>(() =>
    this.resolvePolicy(this.activeTopology(), this.selectedPolicyId()),
  )
  readonly primaryEndpointId = computed(
    () => this.activeTopology().devices.find((device) => device.role === "primary")?.id ?? null,
  )
  readonly recoveryEndpointId = computed(
    () => this.activeTopology().devices.find((device) => device.role === "recovery")?.id ?? null,
  )
  readonly primaryPath = computed(() =>
    this.findBestPath(
      this.activeTopology(),
      this.sourceDeviceId(),
      this.primaryEndpointId(),
      "primary",
    ),
  )
  readonly standbyPath = computed(() =>
    this.findBestPath(
      this.activeTopology(),
      this.sourceDeviceId(),
      this.recoveryEndpointId(),
      "standby",
    ),
  )
  readonly adaptiveRecoveryPath = computed(() =>
    this.findBestPath(
      this.activeTopology(),
      this.sourceDeviceId(),
      this.recoveryEndpointId(),
      "adaptive",
    ),
  )
  readonly activePath = computed<BcdrPath>(() => {
    const policy = this.activePolicy()
    const selectedDestinationId = this.destinationDeviceId()
    const primaryEndpointId = this.primaryEndpointId()
    const recoveryEndpointId = this.recoveryEndpointId()

    if (!policy) {
      return this.primaryPath()
    }

    if (selectedDestinationId === recoveryEndpointId) {
      return this.adaptiveRecoveryPath()
    }

    if (
      policy.strategy === "active-active" &&
      this.primarySiteHealth() === "failed" &&
      recoveryEndpointId
    ) {
      return this.adaptiveRecoveryPath()
    }

    if (selectedDestinationId === primaryEndpointId) {
      return this.primaryPath()
    }

    return this.primaryPath()
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
  readonly replicationConnections = computed(() =>
    this.activeTopology().connections.filter(
      (connection) => connection.kind === "replication-link",
    ),
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
  readonly primarySiteHealth = computed<BcdrHealthState>(() =>
    this.pathHealth(this.primaryPathConnections()),
  )
  readonly replicationHealth = computed<BcdrHealthState>(() =>
    this.pathHealth(this.replicationConnections()),
  )
  readonly syncSummary = computed(() => {
    const syncStates = [
      ...this.endpointDevices().map((device) => device.syncState),
      ...this.storageDevices().map((device) => device.syncState),
    ].filter((state): state is NonNullable<BcdrDevice["syncState"]> => Boolean(state))

    if (syncStates.includes("lagging")) {
      return "Replica lag detected"
    }

    if (syncStates.includes("recovering")) {
      return "Recovery replay active"
    }

    return "Replica synchronized"
  })
  readonly standbyReadiness = computed(() => {
    const standbyPath = this.standbyPath()
    if (standbyPath.connectionIds.length === 0) {
      return "No recovery route"
    }

    const standbyConnections = this.connectionsForIds(standbyPath.connectionIds)
    const standbyHealth = this.pathHealth(standbyConnections)
    if (standbyHealth === "failed") {
      return "Recovery unavailable"
    }

    if (standbyHealth === "degraded") {
      return "Recovery degraded"
    }

    if (this.replicationHealth() === "degraded" || this.syncSummary() !== "Replica synchronized") {
      return "Recovery at risk"
    }

    return "Recovery ready"
  })
  readonly recoveryReason = computed<BcdrRecoveryReason>(() => {
    const policy = this.activePolicy()
    const primaryHealth = this.primarySiteHealth()
    const recoveryPath = this.adaptiveRecoveryPath()
    const replicationHealth = this.replicationHealth()

    if (!policy) {
      return "no-recovery-path"
    }

    if (
      policy.strategy === "active-passive" &&
      primaryHealth === "healthy" &&
      replicationHealth === "healthy"
    ) {
      return "replication-current"
    }

    if (
      policy.strategy === "active-passive" &&
      (replicationHealth === "degraded" || this.syncSummary() !== "Replica synchronized")
    ) {
      return "sync-lag-risk"
    }

    if (policy.strategy === "active-passive") {
      return "recovery-standby"
    }

    if (policy.strategy === "active-active" && recoveryPath.connectionIds.length === 0) {
      return "no-recovery-path"
    }

    if (
      policy.strategy === "active-active" &&
      (replicationHealth === "degraded" || this.syncSummary() !== "Replica synchronized")
    ) {
      return "sync-lag-risk"
    }

    return "recovery-promoted"
  })
  readonly recoveryState = computed(() => {
    const source = this.selectedSource()
    const policy = this.activePolicy()
    const activePathIds = this.activePathConnectionIds()
    const primaryHealth = this.primarySiteHealth()
    const destinationId = this.destinationDeviceId()

    if (!source || !destinationId) {
      return "idle"
    }

    if (!policy) {
      return "blocked"
    }

    if (
      policy.strategy === "active-passive" &&
      primaryHealth === "healthy" &&
      this.recoveryReason() === "replication-current"
    ) {
      return "protected"
    }

    if (policy.strategy === "active-passive" && activePathIds.length > 0) {
      return this.recoveryReason() === "sync-lag-risk" ? "at-risk" : "protected"
    }

    if (
      policy.strategy === "active-active" &&
      activePathIds.length > 0 &&
      destinationId === this.recoveryEndpointId()
    ) {
      return this.recoveryReason() === "sync-lag-risk" ? "at-risk" : "failed-over"
    }

    if (
      policy.strategy === "active-active" &&
      primaryHealth === "degraded" &&
      activePathIds.length > 0
    ) {
      return "recovering"
    }

    if (activePathIds.length === 0) {
      return "blocked"
    }

    return "at-risk"
  })
  readonly actionSummary = computed(() => {
    const state = this.recoveryState()
    if (state === "protected") {
      return "Standby protected"
    }
    if (state === "recovering") {
      return "Recovery warming"
    }
    if (state === "failed-over") {
      return "Recovery site active"
    }
    if (state === "at-risk") {
      return "Continuity risk elevated"
    }
    if (state === "blocked") {
      return "Continuity unavailable"
    }
    return "Select continuity context"
  })
  readonly ruleSummary = computed(() => this.activePolicy()?.label ?? "Strategy selection pending")
  readonly policySummary = computed(
    () => this.activePolicy()?.summary ?? "Select a recovery strategy.",
  )
  readonly controllerSummary = computed(() => {
    const labels = this.controllerDevices().map((device) => device.label)
    return labels.length > 0 ? labels.join(", ") : "No continuity controller active."
  })
  readonly readinessSummary = computed(() => this.recoveryCopy(this.recoveryReason()))
  readonly rtoSummary = computed(() => {
    const state = this.recoveryState()
    if (state === "failed-over") {
      return "RTO held by recovery-site promotion."
    }
    if (state === "at-risk") {
      return "RTO within reach, but elevated sync lag increases business risk."
    }
    if (state === "blocked") {
      return "RTO missed because no active continuity path remains."
    }
    return "RTO target currently protected."
  })
  readonly rpoSummary = computed(() => {
    const reason = this.recoveryReason()
    if (reason === "sync-lag-risk") {
      return "RPO risk elevated due to lagging or replaying replica state."
    }
    return "RPO target currently protected."
  })
  readonly siteSummary = computed(() => {
    const regions = this.activePathDeviceIds()
      .map(
        (deviceId) =>
          this.activeTopology().devices.find((device) => device.id === deviceId)?.region,
      )
      .filter((region): region is string => Boolean(region))

    if (regions.length === 0) {
      return "No sites traversed."
    }

    return [...new Set(regions)].join(" -> ")
  })
  readonly carrierSummary = computed(() => {
    const carriers = [
      ...new Set(this.activePathConnections().map((connection) => connection.carrier)),
    ]
    return carriers.length > 0 ? carriers.join(", ") : "No active continuity links."
  })

  constructor() {
    super(BCDR_TOPOLOGIES)
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

  override addDevice(kind: BcdrDeviceKind): void {
    super.addDevice(kind)
    this.normalizeEndpoints(this.activeTopology())
  }

  override removeSelectedDevice(): void {
    super.removeSelectedDevice()
    this.normalizeEndpoints(this.activeTopology())
  }

  override updateSelectedDevice(patch: Partial<BcdrDevice>): void {
    super.updateSelectedDevice(patch)
    this.normalizeEndpoints(this.activeTopology())
  }

  selectPolicy(policyId: string): void {
    if (!this.activeTopology().policies.some((policy) => policy.id === policyId)) {
      return
    }

    this.selectedPolicyId.set(policyId)
    this.normalizeEndpoints(this.activeTopology())
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

  addOrUpdateBcdrConnection(draft: BcdrConnectionDraft): void {
    if (!draft.from || !draft.to || draft.from === draft.to) {
      return
    }

    const throughputMBps = draft.throughputMBps ?? 0
    const utilizationPct = draft.utilizationPct ?? 0

    this.updateBcdrActiveTopology((topology) => {
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
                  recoveryAction: draft.recoveryAction,
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
            recoveryAction: draft.recoveryAction,
            policyId: draft.policyId,
            notes: draft.notes,
          },
        ],
      }
    })
  }

  protected override createDevice(
    topology: BcdrTopology,
    kind: BcdrDeviceKind,
    index: number,
  ): BcdrDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

    if (kind === "branch-gateway") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 300,
        y: 280,
        detail: "New branch gateway added to the continuity topology.",
        site: `Gateway ${index}`,
        region: "Enterprise Transport",
        tier: "transport",
        role: "gateway",
        domain: "transport",
        rack: `GW-${index}`,
      }
    }

    if (kind === "primary-app") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 520,
        y: 200,
        detail: "New primary application added to the continuity topology.",
        site: `Primary ${index}`,
        region: "Primary Region",
        tier: "application",
        role: "primary",
        domain: "business-app",
        syncState: "synchronized",
        rack: `APP-${index}`,
        cluster: normalizedKind.toLowerCase(),
      }
    }

    if (kind === "recovery-app") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 760,
        y: 320,
        detail: "New recovery application added to the continuity topology.",
        site: `Recovery ${index}`,
        region: "Recovery Region",
        tier: "application",
        role: "recovery",
        domain: "business-app",
        syncState: "synchronized",
        rack: `RCV-${index}`,
        cluster: normalizedKind.toLowerCase(),
      }
    }

    if (kind === "replication-controller") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 520,
        y: 60,
        detail: "New replication controller added to the continuity topology.",
        site: `Controller ${index}`,
        region: "Control Plane",
        tier: "control",
        role: "controller",
        domain: "continuity-control",
        rack: `CTRL-${index}`,
      }
    }

    if (kind === "data-vault") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 760,
        y: 120,
        detail: "New vault storage added to the continuity topology.",
        site: `Vault ${index}`,
        region: "Recovery Region",
        tier: "storage",
        role: "storage",
        domain: "recovery-storage",
        syncState: "synchronized",
        rack: `VLT-${index}`,
      }
    }

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "online",
      x: 120,
      y: 200 + (index % 3) * 120,
      detail: "New enterprise client added to the continuity topology.",
      site: `Branch ${index}`,
      region: "Enterprise Edge",
      tier: "branch",
      role: "source",
      domain: "enterprise-edge",
      rack: `SRC-${index}`,
    }
  }

  private initializeEndpoints(topology: BcdrTopology): void {
    const source = topology.devices.find(
      (device) => device.role === "source" && device.status !== "offline",
    )
    const destination = this.defaultDestination(
      topology,
      this.resolvePolicy(topology, this.selectedPolicyId()),
    )
    this.sourceDeviceId.set(source?.id ?? null)
    this.destinationDeviceId.set(destination?.id ?? null)
    this.selectedDeviceId.set(source?.id ?? destination?.id ?? null)
  }

  private normalizeEndpoints(topology: BcdrTopology): void {
    const sources = topology.devices.filter(
      (device) => device.role === "source" && device.status !== "offline",
    )
    const endpoints = topology.devices.filter(
      (device) =>
        (device.role === "primary" || device.role === "recovery") && device.status !== "offline",
    )
    const sourceIds = new Set(sources.map((device) => device.id))
    const endpointIds = new Set(endpoints.map((device) => device.id))
    const currentSourceId = this.sourceDeviceId()
    const currentDestinationId = this.destinationDeviceId()
    const currentSelectedId = this.selectedDeviceId()
    const preferredDestination = this.defaultDestination(
      topology,
      this.resolvePolicy(topology, this.selectedPolicyId()),
    )

    let nextSourceId = currentSourceId
    if (!nextSourceId || !sourceIds.has(nextSourceId)) {
      nextSourceId = sources[0]?.id ?? null
    }

    let nextDestinationId = currentDestinationId
    if (!nextDestinationId || !endpointIds.has(nextDestinationId)) {
      nextDestinationId = preferredDestination?.id ?? endpoints[0]?.id ?? null
    }

    if (preferredDestination?.id && endpointIds.has(preferredDestination.id)) {
      nextDestinationId = preferredDestination.id
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

  private selectedSource(): BcdrDevice | null {
    return (
      this.activeTopology().devices.find((device) => device.id === this.sourceDeviceId()) ?? null
    )
  }

  private resolvePolicy(
    topology: BcdrTopology,
    selectedPolicyId: string | null,
  ): BcdrPolicy | null {
    if (!selectedPolicyId) {
      return topology.policies[0] ?? null
    }

    return (
      topology.policies.find((policy) => policy.id === selectedPolicyId) ??
      topology.policies[0] ??
      null
    )
  }

  private defaultDestination(topology: BcdrTopology, policy: BcdrPolicy | null): BcdrDevice | null {
    if (policy?.strategy === "active-active") {
      return (
        topology.devices.find(
          (device) => device.role === "recovery" && device.status !== "offline",
        ) ?? null
      )
    }

    return (
      topology.devices.find((device) => device.role === "primary" && device.status !== "offline") ??
      null
    )
  }

  private findBestPath(
    topology: BcdrTopology,
    sourceDeviceId: string | null,
    destinationDeviceId: string | null,
    pathMode: BcdrPathMode,
  ): BcdrPath {
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

  private isPathConnectionUsable(connection: BcdrConnection, pathMode: BcdrPathMode): boolean {
    if (connection.kind === "management-link" || connection.kind === "replication-link") {
      return false
    }

    if (pathMode === "primary") {
      return connection.kind === "service-link" && connection.health !== "failed"
    }

    if (pathMode === "standby") {
      return (
        (connection.kind === "service-link" || connection.kind === "recovery-link") &&
        connection.health !== "failed"
      )
    }

    return (
      (connection.kind === "service-link" || connection.kind === "recovery-link") &&
      connection.health !== "failed"
    )
  }

  private connectionScore(connection: BcdrConnection, pathMode: BcdrPathMode): number {
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
    const recoveryPenalty = pathMode === "adaptive" && connection.kind === "recovery-link" ? 240 : 0

    return (
      connection.priority * 900 +
      connection.latencyMs * 12 +
      connection.jitterMs * 5 +
      connection.packetLossPct * 120 +
      throughputPenalty +
      utilizationPenalty +
      strengthPenalty +
      healthPenalty +
      recoveryPenalty
    )
  }

  private pathHealth(connections: BcdrConnection[]): BcdrHealthState {
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

  private connectionsForIds(connectionIds: string[]): BcdrConnection[] {
    const ids = new Set(connectionIds)
    return this.activeTopology().connections.filter((connection) => ids.has(connection.id))
  }

  private recoveryCopy(reason: BcdrRecoveryReason): string {
    switch (reason) {
      case "replication-current":
        return "Replication is current and the recovery site is ready if the enterprise application must fail over."
      case "recovery-standby":
        return "The recovery site is standing by while the primary application continues to serve production traffic."
      case "recovery-promoted":
        return "The recovery application has been promoted and is now carrying the enterprise workload."
      case "sync-lag-risk":
        return "Continuity remains available, but replica lag or replay state increases recovery risk."
      default:
        return "No viable recovery path is currently available."
    }
  }

  private updateBcdrActiveTopology(updater: (topology: BcdrTopology) => BcdrTopology): void {
    const activeTopologyId = this.activeTopologyId()
    this.topologies.update((topologies) =>
      topologies.map((topology) =>
        topology.id === activeTopologyId ? updater(topology) : topology,
      ),
    )
  }
}
