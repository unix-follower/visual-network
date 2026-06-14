import { computed, Injectable, signal } from "@angular/core"

import { TopologyStateService } from "../../shared/network-topology/topology-state.service"
import { DCN_TOPOLOGIES } from "./dcn.data"
import { DcnConnection, DcnDevice, DcnDeviceKind, DcnTopology } from "./dcn.models"

interface DcnPath {
  deviceIds: string[]
  connectionIds: string[]
  score: number
}

interface DcnConnectionDraft {
  from: string
  to: string
  kind: DcnConnection["kind"]
  strength: DcnConnection["strength"]
  distanceKm: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  throughputMBps?: number
  bandwidthMbps?: number
  iops?: number
  utilizationPct?: number
  carrier: string
  costUsd: number
  priority: number
}

@Injectable({ providedIn: "root" })
export class DcnStateService extends TopologyStateService<
  DcnTopology,
  DcnDevice,
  DcnConnection,
  DcnDeviceKind,
  DcnDevice["status"],
  DcnConnection["kind"],
  DcnConnection["strength"]
> {
  readonly spineSwitches = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "spine" && device.status !== "offline",
    ),
  )
  readonly sourceDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "compute" && device.status !== "offline",
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
  readonly activePath = computed<DcnPath>(() =>
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
    if (this.activePathConnections().length === 0) {
      return 0
    }

    return this.activePathConnections().reduce(
      (minimum, connection) => Math.min(minimum, connection.throughputMBps),
      Number.POSITIVE_INFINITY,
    )
  })
  readonly activeBandwidthMbps = computed(() => this.activeThroughputMBps())
  readonly activeIops = computed(() => 0)
  readonly activeUtilizationPct = computed(() => {
    if (this.activePathConnections().length === 0) {
      return 0
    }

    return Math.max(...this.activePathConnections().map((connection) => connection.utilizationPct))
  })
  readonly spineSummary = computed(() => {
    const labels = this.spineSwitches().map((device) => device.label)
    return labels.length > 0 ? labels.join(", ") : "No spine switches active."
  })
  readonly controllerSummary = computed(() => this.spineSummary())
  readonly policySummary = computed(
    () => this.activeTopology().policies[0]?.label ?? "Preferred spine path",
  )
  readonly failoverReason = computed(() => {
    const pathState = this.failoverState()

    if (pathState === "blocked") {
      return "No DCN path is currently available between the selected workload and service."
    }

    if (pathState === "failover") {
      return "Traffic has shifted to the alternate spine path to preserve service reachability."
    }

    if (pathState === "degraded") {
      return "The preferred spine path is still active, but one fabric segment or device is degraded."
    }

    if (pathState === "idle") {
      return "Choose a compute workload and service destination to inspect DCN path behavior."
    }

    return "The preferred leaf-spine path is serving traffic."
  })
  readonly overrideReason = computed(() => this.failoverReason())
  readonly replicationSummary = computed(() => {
    if (!this.destinationDeviceId()) {
      return "Service selection pending"
    }

    return this.hasAlternateSpinePath() ? "Alternate spine available" : "Single service path"
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
      return "Awaiting DCN endpoints"
    }

    if (pathState === "blocked") {
      return "No resilience"
    }

    if (pathState === "failover") {
      return "Alternate spine active"
    }

    if (pathState === "degraded") {
      return this.hasAlternateSpinePath() ? "Protected" : "Primary degraded"
    }

    return this.hasAlternateSpinePath() ? "Protected" : "Single path"
  })
  readonly carrierSummary = computed(() => {
    const carriers = [
      ...new Set(this.activePathConnections().map((connection) => connection.carrier)),
    ]

    if (carriers.length === 0) {
      return "No DCN links active."
    }

    return carriers.join(", ")
  })

  constructor() {
    super(DCN_TOPOLOGIES)
    this.selectedPolicyId.set(this.activeTopology().policies[0]?.id ?? null)
    this.initializeEndpoints(this.activeTopology())
  }

  override selectTopology(topologyId: string): void {
    super.selectTopology(topologyId)
    this.selectedPolicyId.set(this.activeTopology().policies[0]?.id ?? null)
    this.initializeEndpoints(this.activeTopology())
  }

  override addDevice(kind: DcnDeviceKind): void {
    super.addDevice(kind)
    this.normalizeEndpoints(this.activeTopology())
  }

  override removeSelectedDevice(): void {
    super.removeSelectedDevice()
    this.normalizeEndpoints(this.activeTopology())
  }

  override updateSelectedDevice(patch: Partial<DcnDevice>): void {
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

  addOrUpdateDcnConnection(draft: DcnConnectionDraft): void {
    if (!draft.from || !draft.to || draft.from === draft.to) {
      return
    }

    const throughputMBps = draft.throughputMBps ?? draft.bandwidthMbps ?? 0
    const iops = draft.iops ?? 0
    const utilizationPct = draft.utilizationPct ?? 0

    this.updateDcnActiveTopology((topology) => {
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
                  utilizationPct,
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
            utilizationPct,
            carrier: draft.carrier,
            costUsd: draft.costUsd,
            priority: draft.priority,
          },
        ],
      }
    })
  }

  protected override createDevice(
    topology: DcnTopology,
    kind: DcnDeviceKind,
    index: number,
  ): DcnDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

    if (kind === "spine-switch") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 520,
        y: 140 + (index % 2) * 220,
        detail: "New spine switch added to the DC fabric.",
        site: `Spine ${index}`,
        region: "Spine Tier",
        tier: "spine",
        role: "spine",
        rack: `Spine-${index}`,
      }
    }

    if (kind === "leaf-switch" || kind === "fabric-switch") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 280 + (index % 3) * 220,
        y: 300,
        detail: "New leaf switch added to the DC fabric.",
        site: `Leaf ${index}`,
        region: "Leaf Tier",
        tier: "leaf",
        role: "leaf",
        rack: `Leaf-${index}`,
      }
    }

    if (kind === "service-node" || kind === "storage-target" || kind === "backup-storage") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 900,
        y: 210 + (index % 3) * 120,
        detail: `New ${normalizedKind.toLowerCase()} attached to the service side of the fabric.`,
        site: `Service rack ${index}`,
        region: "Services Row",
        tier: "service",
        role: "service",
        rack: `S-${index}`,
        cluster: normalizedKind.toLowerCase(),
      }
    }

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "degraded",
      x: 140,
      y: 210 + (index % 3) * 120,
      detail: `New ${normalizedKind.toLowerCase()} attached to the compute side of the fabric.`,
      site: `Compute rack ${index}`,
      region: "Compute Row",
      tier: "workload",
      role: "compute",
      rack: `C-${index}`,
      cluster: normalizedKind.toLowerCase(),
    }
  }

  private initializeEndpoints(topology: DcnTopology): void {
    const source = topology.devices.find(
      (device) => device.role === "compute" && device.status !== "offline",
    )
    const endpoints = topology.devices.filter(
      (device) => device.role === "service" && device.status !== "offline",
    )
    const sourceId = source?.id ?? null
    const destinationId = this.preferredDestinationId(endpoints)

    this.sourceDeviceId.set(sourceId)
    this.destinationDeviceId.set(destinationId)
    this.selectedDeviceId.set(sourceId ?? destinationId)
  }

  private normalizeEndpoints(topology: DcnTopology): void {
    const sources = topology.devices.filter(
      (device) => device.role === "compute" && device.status !== "offline",
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

  private preferredDestinationId(endpoints: readonly DcnDevice[]): string | null {
    return (
      endpoints.find((device) => device.kind === "service-node")?.id ?? endpoints[0]?.id ?? null
    )
  }

  private findBestPath(
    topology: DcnTopology,
    sourceDeviceId: string | null,
    destinationDeviceId: string | null,
  ): DcnPath {
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

  private connectionScore(connection: DcnConnection): number {
    let strengthPenalty = 0

    if (connection.strength === "medium") {
      strengthPenalty = 45
    } else if (connection.strength === "weak") {
      strengthPenalty = 110
    }

    const throughputPenalty =
      connection.throughputMBps > 0 ? 15000 / connection.throughputMBps : 15000
    const utilizationPenalty = connection.utilizationPct * 3

    return (
      connection.priority * 1000 +
      connection.latencyMs * 10 +
      connection.jitterMs * 4 +
      connection.packetLossPct * 120 +
      throughputPenalty +
      utilizationPenalty +
      strengthPenalty
    )
  }

  private hasAlternatePath(excludedConnectionIds: string[]): boolean {
    const excludedConnectionIdSet = new Set(excludedConnectionIds)
    const reducedTopology: DcnTopology = {
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

  private hasAlternateSpinePath(): boolean {
    const pathDevices = this.activePathDeviceIds()
      .map((deviceId) => this.activeTopology().devices.find((device) => device.id === deviceId))
      .filter((device): device is DcnDevice => device !== undefined)
    const sourceLeaf = pathDevices.find((device) => device.role === "leaf")
    const destinationLeaf = [...pathDevices].reverse().find((device) => device.role === "leaf")

    if (!sourceLeaf || !destinationLeaf) {
      return this.hasAlternatePath(this.activePathConnectionIds())
    }

    const activePathDeviceIdSet = new Set(this.activePathDeviceIds())

    return this.spineSwitches().some((spine) => {
      if (activePathDeviceIdSet.has(spine.id)) {
        return false
      }

      const sourceLink = this.activeTopology().connections.find(
        (connection) =>
          ((connection.from === sourceLeaf.id && connection.to === spine.id) ||
            (connection.from === spine.id && connection.to === sourceLeaf.id)) &&
          connection.strength !== "weak",
      )
      const destinationLink = this.activeTopology().connections.find(
        (connection) =>
          ((connection.from === destinationLeaf.id && connection.to === spine.id) ||
            (connection.from === spine.id && connection.to === destinationLeaf.id)) &&
          connection.strength !== "weak",
      )

      return Boolean(sourceLink && destinationLink)
    })
  }

  private updateDcnActiveTopology(updater: (topology: DcnTopology) => DcnTopology): void {
    const activeTopologyId = this.activeTopologyId()

    this.topologies.update((topologies) =>
      topologies.map((topology) =>
        topology.id === activeTopologyId ? updater(topology) : topology,
      ),
    )
  }
}
