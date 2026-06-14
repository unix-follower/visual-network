import { computed, Injectable, signal } from "@angular/core"

import { TopologyStateService } from "../../shared/network-topology/topology-state.service"
import { MAN_TOPOLOGIES } from "./man.data"
import { ManConnection, ManDevice, ManDeviceKind, ManTopology } from "./man.models"

interface ManPath {
  deviceIds: string[]
  connectionIds: string[]
  score: number
}

interface ManConnectionDraft {
  from: string
  to: string
  kind: ManConnection["kind"]
  strength: ManConnection["strength"]
  distanceKm: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  bandwidthMbps: number
  carrier: string
  costUsd: number
  priority: number
}

@Injectable({ providedIn: "root" })
export class ManStateService extends TopologyStateService<
  ManTopology,
  ManDevice,
  ManConnection,
  ManDeviceKind,
  ManDevice["status"],
  ManConnection["kind"],
  ManConnection["strength"]
> {
  readonly sourceDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "site" && device.status !== "offline",
    ),
  )
  readonly endpointDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role !== "transit" && device.status !== "offline",
    ),
  )
  readonly sourceDeviceId = signal<string | null>(null)
  readonly destinationDeviceId = signal<string | null>(null)
  readonly activePath = computed<ManPath>(() =>
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
  readonly failoverState = computed(() => {
    const path = this.activePath()
    const sourceDeviceId = this.sourceDeviceId()
    const destinationDeviceId = this.destinationDeviceId()

    if (path.connectionIds.length === 0) {
      if (!sourceDeviceId || !destinationDeviceId) {
        return "idle"
      }

      if (sourceDeviceId === destinationDeviceId) {
        return "idle"
      }

      return "blocked"
    }

    const pathConnections = this.activePathConnections()
    const pathDevices = this.activePathDeviceIds().map((deviceId) =>
      this.activeTopology().devices.find((device) => device.id === deviceId),
    )

    if (
      pathConnections.some(
        (connection) => connection.priority > 1 || connection.kind === "backup-link",
      )
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
      return "Awaiting metro endpoints"
    }

    if (sourceDeviceId === destinationDeviceId) {
      return "Local route"
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
      return "No metro providers active."
    }

    return carriers.join(", ")
  })

  constructor() {
    super(MAN_TOPOLOGIES)
    this.initializeEndpoints(this.activeTopology())
  }

  override selectTopology(topologyId: string): void {
    super.selectTopology(topologyId)
    this.initializeEndpoints(this.activeTopology())
  }

  override addDevice(kind: ManDeviceKind): void {
    super.addDevice(kind)
    this.normalizeEndpoints(this.activeTopology())
  }

  override removeSelectedDevice(): void {
    super.removeSelectedDevice()
    this.normalizeEndpoints(this.activeTopology())
  }

  override updateSelectedDevice(patch: Partial<ManDevice>): void {
    super.updateSelectedDevice(patch)
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

  addOrUpdateManConnection(draft: ManConnectionDraft): void {
    if (!draft.from || !draft.to || draft.from === draft.to) {
      return
    }

    this.updateManActiveTopology((topology) => {
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
          },
        ],
      }
    })
  }

  protected override createDevice(
    topology: ManTopology,
    kind: ManDeviceKind,
    index: number,
  ): ManDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

    if (kind === "provider-handoff") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "degraded",
        x: 180 + (index % 4) * 150,
        y: 160 + (index % 3) * 90,
        detail: "New metro provider handoff added to the MAN topology.",
        site: `Metro provider ${index}`,
        region: "City ring",
        tier: "district",
        role: "transit",
      }
    }

    let tier: ManDevice["tier"] = "building"
    let role: ManDevice["role"] = "site"

    if (kind === "metro-core") {
      tier = "metro"
    }

    if (kind === "service-handoff") {
      tier = "metro"
      role = "service"
    }

    if (kind === "access-node") {
      tier = "district"
    }

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "degraded",
      x: 180 + (index % 4) * 150,
      y: 220 + (index % 2) * 120,
      detail: `New ${normalizedKind.toLowerCase()} site added to the MAN topology.`,
      site: `${normalizedKind} ${index}`,
      region: "Metro district",
      tier,
      role,
    }
  }

  private initializeEndpoints(topology: ManTopology): void {
    const sources = topology.devices.filter(
      (device) => device.role === "site" && device.status !== "offline",
    )
    const endpoints = topology.devices.filter(
      (device) => device.role !== "transit" && device.status !== "offline",
    )
    const sourceId = sources[0]?.id ?? null
    const destinationId = this.preferredDestinationId(sourceId, sources, endpoints)

    this.sourceDeviceId.set(sourceId)
    this.destinationDeviceId.set(destinationId)
    this.selectedDeviceId.set(sourceId ?? destinationId)
  }

  private normalizeEndpoints(topology: ManTopology): void {
    const sources = topology.devices.filter(
      (device) => device.role === "site" && device.status !== "offline",
    )
    const endpoints = topology.devices.filter(
      (device) => device.role !== "transit" && device.status !== "offline",
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

  private preferredDestinationId(
    sourceId: string | null,
    sources: readonly ManDevice[],
    endpoints: readonly ManDevice[],
  ): string | null {
    return (
      sources.find((device) => device.id !== sourceId)?.id ??
      endpoints.find((device) => device.id !== sourceId)?.id ??
      sourceId
    )
  }

  private findBestPath(
    topology: ManTopology,
    sourceDeviceId: string | null,
    destinationDeviceId: string | null,
  ): ManPath {
    if (!sourceDeviceId || !destinationDeviceId) {
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

  private connectionScore(connection: ManConnection): number {
    let strengthPenalty = 0

    if (connection.strength === "medium") {
      strengthPenalty = 45
    } else if (connection.strength === "weak") {
      strengthPenalty = 110
    }

    return (
      connection.priority * 1000 +
      connection.latencyMs * 10 +
      connection.jitterMs * 4 +
      connection.packetLossPct * 120 +
      strengthPenalty
    )
  }

  private hasAlternatePath(excludedConnectionIds: string[]): boolean {
    const excludedConnectionIdSet = new Set(excludedConnectionIds)
    const reducedTopology: ManTopology = {
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

  private updateManActiveTopology(updater: (topology: ManTopology) => ManTopology): void {
    const activeTopologyId = this.activeTopologyId()

    this.topologies.update((topologies) =>
      topologies.map((topology) =>
        topology.id === activeTopologyId ? updater(topology) : topology,
      ),
    )
  }
}
