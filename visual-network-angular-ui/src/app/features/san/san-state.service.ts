import { computed, Injectable, signal } from "@angular/core"

import { TopologyStateService } from "../../shared/network-topology/topology-state.service"
import { SAN_TOPOLOGIES } from "./san.data"
import { SanConnection, SanDevice, SanDeviceKind, SanTopology } from "./san.models"

interface SanPath {
  deviceIds: string[]
  connectionIds: string[]
  score: number
}

interface SanConnectionDraft {
  from: string
  to: string
  kind: SanConnection["kind"]
  strength: SanConnection["strength"]
  distanceKm: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  throughputMBps?: number
  bandwidthMbps?: number
  iops?: number
  carrier: string
  costUsd: number
  priority: number
}

@Injectable({ providedIn: "root" })
export class SanStateService extends TopologyStateService<
  SanTopology,
  SanDevice,
  SanConnection,
  SanDeviceKind,
  SanDevice["status"],
  SanConnection["kind"],
  SanConnection["strength"]
> {
  readonly storageControllers = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "controller" && device.status !== "offline",
    ),
  )
  readonly sourceDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "initiator" && device.status !== "offline",
    ),
  )
  readonly endpointDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "target" && device.status !== "offline",
    ),
  )
  readonly selectedPolicyId = signal<string | null>(null)
  readonly sourceDeviceId = signal<string | null>(null)
  readonly destinationDeviceId = signal<string | null>(null)
  readonly activePath = computed<SanPath>(() =>
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
  readonly activeThroughputMBps = computed(() => {
    const dataConnections = this.activePathConnections().filter(
      (connection) => connection.kind !== "mgmt-link",
    )

    if (dataConnections.length === 0) {
      return 0
    }

    return dataConnections.reduce(
      (minimum, connection) => Math.min(minimum, connection.throughputMBps),
      Number.POSITIVE_INFINITY,
    )
  })
  readonly activeBandwidthMbps = computed(() => this.activeThroughputMBps())
  readonly activeIops = computed(() => {
    const dataConnections = this.activePathConnections().filter(
      (connection) => connection.kind !== "mgmt-link",
    )

    if (dataConnections.length === 0) {
      return 0
    }

    return dataConnections.reduce(
      (minimum, connection) => Math.min(minimum, connection.iops),
      Number.POSITIVE_INFINITY,
    )
  })
  readonly storageControllerSummary = computed(() => {
    const labels = this.storageControllers().map((device) => device.label)
    return labels.length > 0 ? labels.join(", ") : "No storage controllers active."
  })
  readonly controllerSummary = computed(() => this.storageControllerSummary())
  readonly policySummary = computed(
    () => this.activeTopology().policies[0]?.label ?? "Automatic failover",
  )
  readonly failoverReason = computed(() => {
    const pathState = this.failoverState()

    if (pathState === "blocked") {
      return "No storage path is currently available to the selected target."
    }

    if (pathState === "failover") {
      return "Traffic has shifted to the protected storage path or replica target."
    }

    if (pathState === "degraded") {
      return "The preferred SAN path is still active, but one fabric or device is degraded."
    }

    if (pathState === "idle") {
      return "Choose an initiator and storage target to inspect SAN failover behavior."
    }

    return "The preferred SAN path is serving storage traffic."
  })
  readonly overrideReason = computed(() => this.failoverReason())
  readonly replicationSummary = computed(() => {
    const destinationId = this.destinationDeviceId()

    if (!destinationId) {
      return "Replication unknown"
    }

    const destination = this.activeTopology().devices.find((device) => device.id === destinationId)

    if (!destination) {
      return "Replication unknown"
    }

    if (destination.kind === "backup-storage") {
      return "Serving from replica"
    }

    const replicationPeer = this.activeTopology()
      .connections.filter(
        (connection) =>
          connection.kind === "mgmt-link" &&
          (connection.from === destination.id || connection.to === destination.id),
      )
      .map((connection) =>
        this.activeTopology().devices.find(
          (device) =>
            device.id === (connection.from === destination.id ? connection.to : connection.from),
        ),
      )
      .find((device) => device?.kind === "backup-storage" && device.status !== "offline")

    if (!replicationPeer) {
      return "No replica available"
    }

    if (replicationPeer.replicationState === "lagging") {
      return "Replica lag detected"
    }

    return "Synchronized replica ready"
  })
  readonly failoverState = computed(() => {
    const path = this.activePath()
    const sourceDeviceId = this.sourceDeviceId()
    const destinationDeviceId = this.destinationDeviceId()

    if (path.connectionIds.length === 0) {
      if (!sourceDeviceId || !destinationDeviceId) {
        return "idle"
      }

      return "blocked"
    }

    const pathConnections = this.activePathConnections()
    const pathDevices = this.activePathDeviceIds().map((deviceId) =>
      this.activeTopology().devices.find((device) => device.id === deviceId),
    )

    if (
      pathConnections.some((connection) => connection.priority > 1) ||
      pathDevices.some((device) => device?.kind === "backup-storage")
    ) {
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
      return "Awaiting SAN endpoints"
    }

    if (pathState === "blocked") {
      return "No resilience"
    }

    if (pathState === "failover") {
      return "Replica active"
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
      return "No SAN fabrics active."
    }

    return carriers.join(", ")
  })

  constructor() {
    super(SAN_TOPOLOGIES)
    this.selectedPolicyId.set(this.activeTopology().policies[0]?.id ?? null)
    this.initializeEndpoints(this.activeTopology())
  }

  override selectTopology(topologyId: string): void {
    super.selectTopology(topologyId)
    this.selectedPolicyId.set(this.activeTopology().policies[0]?.id ?? null)
    this.initializeEndpoints(this.activeTopology())
  }

  override addDevice(kind: SanDeviceKind): void {
    super.addDevice(kind)
    this.normalizeEndpoints(this.activeTopology())
  }

  override removeSelectedDevice(): void {
    super.removeSelectedDevice()
    this.normalizeEndpoints(this.activeTopology())
  }

  override updateSelectedDevice(patch: Partial<SanDevice>): void {
    super.updateSelectedDevice(patch)
    this.normalizeEndpoints(this.activeTopology())
  }

  selectPolicy(policyId: string): void {
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

  addOrUpdateSanConnection(draft: SanConnectionDraft): void {
    if (!draft.from || !draft.to || draft.from === draft.to) {
      return
    }

    const throughputMBps = draft.throughputMBps ?? draft.bandwidthMbps ?? 0
    const iops = draft.iops ?? Math.max(Math.round(throughputMBps * 64), 0)

    this.updateSanActiveTopology((topology) => {
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
                  iops,
                  carrier: draft.carrier,
                  costUsd: draft.costUsd,
                  priority: draft.priority,
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
            iops,
            carrier: draft.carrier,
            costUsd: draft.costUsd,
            priority: draft.priority,
          },
        ],
      }
    })
  }

  protected override createDevice(
    topology: SanTopology,
    kind: SanDeviceKind,
    index: number,
  ): SanDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

    if (kind === "storage-controller") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 240 + (index % 3) * 170,
        y: 90,
        detail: "New SAN storage controller added to the topology.",
        site: `Storage controller ${index}`,
        region: "Storage core",
        tier: "control",
        role: "controller",
      }
    }

    let tier: SanDevice["tier"] = "host"
    let role: SanDevice["role"] = "initiator"
    let replicationState: SanDevice["replicationState"] = "standalone"

    if (kind === "fabric-switch") {
      tier = "fabric"
      role = "fabric"
    }

    if (kind === "storage-target") {
      tier = "storage"
      role = "target"
      replicationState = "synchronized"
    }

    if (kind === "backup-storage") {
      tier = "storage"
      role = "target"
      replicationState = "serving-replica"
    }

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "degraded",
      x: 180 + (index % 4) * 150,
      y: 220 + (index % 2) * 120,
      detail: `New ${normalizedKind.toLowerCase()} node added to the SAN topology.`,
      site: `${normalizedKind} ${index}`,
      region: "Storage fabric",
      tier,
      role,
      replicationState,
    }
  }

  private initializeEndpoints(topology: SanTopology): void {
    const sources = topology.devices.filter(
      (device) => device.role === "initiator" && device.status !== "offline",
    )
    const endpoints = topology.devices.filter(
      (device) => device.role === "target" && device.status !== "offline",
    )
    const sourceId = sources[0]?.id ?? null
    const destinationId = this.preferredDestinationId(endpoints)

    this.sourceDeviceId.set(sourceId)
    this.destinationDeviceId.set(destinationId)
    this.selectedDeviceId.set(sourceId ?? destinationId)
  }

  private normalizeEndpoints(topology: SanTopology): void {
    const sources = topology.devices.filter(
      (device) => device.role === "initiator" && device.status !== "offline",
    )
    const endpoints = topology.devices.filter(
      (device) => device.role === "target" && device.status !== "offline",
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
      nextDestinationId = this.preferredDestinationId(endpoints)
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

  private preferredDestinationId(endpoints: readonly SanDevice[]): string | null {
    return (
      endpoints.find((device) => device.kind === "storage-target")?.id ?? endpoints[0]?.id ?? null
    )
  }

  private findBestPath(
    topology: SanTopology,
    sourceDeviceId: string | null,
    destinationDeviceId: string | null,
  ): SanPath {
    if (!sourceDeviceId || !destinationDeviceId) {
      return { deviceIds: [], connectionIds: [], score: Number.POSITIVE_INFINITY }
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

        if (!neighborId) {
          return
        }

        const currentDevice = deviceById.get(currentId)
        const neighborDevice = deviceById.get(neighborId)

        if (currentDevice?.status === "offline" || neighborDevice?.status === "offline") {
          return
        }

        const nextScore = currentScore + this.connectionScore(connection)

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

  private connectionScore(connection: SanConnection): number {
    let strengthPenalty = 0

    if (connection.strength === "medium") {
      strengthPenalty = 45
    } else if (connection.strength === "weak") {
      strengthPenalty = 110
    }

    const throughputPenalty =
      connection.throughputMBps > 0 ? 12000 / connection.throughputMBps : 12000
    const iopsPenalty =
      connection.iops > 0 ? 18000 / connection.iops : connection.kind === "mgmt-link" ? 9000 : 18000
    const managementPenalty = connection.kind === "mgmt-link" ? 5000 : 0

    return (
      connection.priority * 1000 +
      connection.latencyMs * 10 +
      connection.jitterMs * 4 +
      connection.packetLossPct * 120 +
      throughputPenalty +
      iopsPenalty +
      managementPenalty +
      strengthPenalty
    )
  }

  private hasAlternatePath(excludedConnectionIds: string[]): boolean {
    const excludedConnectionIdSet = new Set(excludedConnectionIds)
    const reducedTopology: SanTopology = {
      ...this.activeTopology(),
      connections: this.activeTopology().connections.filter(
        (connection) => !excludedConnectionIdSet.has(connection.id),
      ),
    }
    const alternatePath = this.findBestPath(
      reducedTopology,
      this.sourceDeviceId(),
      this.destinationDeviceId(),
    )

    return alternatePath.connectionIds.length > 0
  }

  private updateSanActiveTopology(updater: (topology: SanTopology) => SanTopology): void {
    const activeTopologyId = this.activeTopologyId()

    this.topologies.update((topologies) =>
      topologies.map((topology) =>
        topology.id === activeTopologyId ? updater(topology) : topology,
      ),
    )
  }
}
