import { computed, Injectable, signal } from "@angular/core"

import { TopologyStateService } from "../../shared/network-topology/topology-state.service"
import { CEN_TOPOLOGIES } from "./cen.data"
import { CenConnection, CenDevice, CenDeviceKind, CenTopology } from "./cen.models"

interface CenPath {
  deviceIds: string[]
  connectionIds: string[]
  score: number
}

interface CenConnectionDraft {
  from: string
  to: string
  kind: CenConnection["kind"]
  strength: CenConnection["strength"]
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
export class CenStateService extends TopologyStateService<
  CenTopology,
  CenDevice,
  CenConnection,
  CenDeviceKind,
  CenDevice["status"],
  CenConnection["kind"],
  CenConnection["strength"]
> {
  readonly cloudOnramps = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.kind === "cloud-onramp" && device.status !== "offline",
    ),
  )
  readonly sourceDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "edge" && device.status !== "offline",
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
  readonly activePath = computed<CenPath>(() =>
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
  readonly gatewaySummary = computed(() => {
    const labels = this.cloudOnramps().map((device) => device.label)
    return labels.length > 0 ? labels.join(", ") : "No cloud on-ramps active."
  })
  readonly controllerSummary = computed(() => this.gatewaySummary())
  readonly policySummary = computed(
    () => this.activeTopology().policies[0]?.label ?? "Prefer nearest region",
  )
  readonly failoverReason = computed(() => {
    const pathState = this.failoverState()

    if (pathState === "blocked") {
      return "No cloud path is currently available between the selected edge workload and service."
    }

    if (pathState === "failover") {
      return "Traffic has shifted to the alternate region path to preserve cloud service reachability."
    }

    if (pathState === "degraded") {
      return "The preferred cloud path is still active, but one edge or region segment is degraded."
    }

    if (pathState === "idle") {
      return "Choose an edge workload and service destination to inspect cloud path behavior."
    }

    return "The preferred edge-to-cloud path is serving traffic."
  })
  readonly overrideReason = computed(() => this.failoverReason())
  readonly replicationSummary = computed(() => {
    if (!this.destinationDeviceId()) {
      return "Service selection pending"
    }

    return this.hasAlternateRegionPath() ? "Alternate region available" : "Single region path"
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
      return "Awaiting cloud endpoints"
    }

    if (pathState === "blocked") {
      return "No resilience"
    }

    if (pathState === "failover") {
      return "Alternate region active"
    }

    if (pathState === "degraded") {
      return this.hasAlternateRegionPath() ? "Protected" : "Primary degraded"
    }

    return this.hasAlternateRegionPath() ? "Protected" : "Single path"
  })
  readonly carrierSummary = computed(() => {
    const carriers = [
      ...new Set(this.activePathConnections().map((connection) => connection.carrier)),
    ]

    if (carriers.length === 0) {
      return "No cloud links active."
    }

    return carriers.join(", ")
  })

  constructor() {
    super(CEN_TOPOLOGIES)
    this.selectedPolicyId.set(this.activeTopology().policies[0]?.id ?? null)
    this.initializeEndpoints(this.activeTopology())
  }

  override selectTopology(topologyId: string): void {
    super.selectTopology(topologyId)
    this.selectedPolicyId.set(this.activeTopology().policies[0]?.id ?? null)
    this.initializeEndpoints(this.activeTopology())
  }

  override addDevice(kind: CenDeviceKind): void {
    super.addDevice(kind)
    this.normalizeEndpoints(this.activeTopology())
  }

  override removeSelectedDevice(): void {
    super.removeSelectedDevice()
    this.normalizeEndpoints(this.activeTopology())
  }

  override updateSelectedDevice(patch: Partial<CenDevice>): void {
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

  addOrUpdateCenConnection(draft: CenConnectionDraft): void {
    if (!draft.from || !draft.to || draft.from === draft.to) {
      return
    }

    const throughputMBps = draft.throughputMBps ?? draft.bandwidthMbps ?? 0
    const iops = draft.iops ?? 0
    const utilizationPct = draft.utilizationPct ?? 0

    this.updateCenActiveTopology((topology) => {
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
    topology: CenTopology,
    kind: CenDeviceKind,
    index: number,
  ): CenDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

    if (kind === "cloud-region") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 700,
        y: 140 + (index % 2) * 220,
        detail: "New cloud region added to the CEN topology.",
        site: `Region ${index}`,
        region: "Cloud Region Tier",
        tier: "cloud",
        role: "cloud",
        rack: `REG-${index}`,
        zone: `region-${index}`,
      }
    }

    if (kind === "edge-gateway" || kind === "cloud-onramp") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: kind === "edge-gateway" ? 290 : 500,
        y: 300,
        detail:
          kind === "edge-gateway"
            ? "New edge gateway added to the cloud edge fabric."
            : "New cloud on-ramp added to the CEN topology.",
        site: kind === "edge-gateway" ? `Gateway ${index}` : `On-ramp ${index}`,
        region: kind === "edge-gateway" ? "Edge Gateway Layer" : "Cloud On-ramp Layer",
        tier: "gateway",
        role: "gateway",
        rack: kind === "edge-gateway" ? `GW-${index}` : `OR-${index}`,
        zone: kind === "edge-gateway" ? "branch-edge" : "cloud-entry",
      }
    }

    if (kind === "service-endpoint") {
      return {
        id,
        label: `${normalizedKind} ${index}`,
        kind,
        status: "online",
        x: 920,
        y: 210 + (index % 3) * 120,
        detail: `New ${normalizedKind.toLowerCase()} exposed through the cloud service layer.`,
        site: `Service mesh ${index}`,
        region: "Application Layer",
        tier: "service",
        role: "service",
        rack: `APP-${index}`,
        cluster: normalizedKind.toLowerCase(),
        zone: "multi-region",
      }
    }

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "degraded",
      x: 140,
      y: 210 + (index % 3) * 120,
      detail: `New ${normalizedKind.toLowerCase()} attached to the edge side of the topology.`,
      site: `Edge site ${index}`,
      region: "Edge Workload Layer",
      tier: "edge",
      role: "edge",
      rack: `EDGE-${index}`,
      cluster: normalizedKind.toLowerCase(),
      zone: "local-cache",
    }
  }

  private initializeEndpoints(topology: CenTopology): void {
    const source = topology.devices.find(
      (device) => device.role === "edge" && device.status !== "offline",
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

  private normalizeEndpoints(topology: CenTopology): void {
    const sources = topology.devices.filter(
      (device) => device.role === "edge" && device.status !== "offline",
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

  private preferredDestinationId(endpoints: readonly CenDevice[]): string | null {
    return (
      endpoints.find((device) => device.kind === "service-endpoint")?.id ?? endpoints[0]?.id ?? null
    )
  }

  private findBestPath(
    topology: CenTopology,
    sourceDeviceId: string | null,
    destinationDeviceId: string | null,
  ): CenPath {
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

  private connectionScore(connection: CenConnection): number {
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
    const reducedTopology: CenTopology = {
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

  private hasAlternateRegionPath(): boolean {
    const pathDevices = this.activePathDeviceIds()
      .map((deviceId) => this.activeTopology().devices.find((device) => device.id === deviceId))
      .filter((device): device is CenDevice => device !== undefined)
    const edgeGateway = pathDevices.find((device) => device.kind === "edge-gateway")
    const destinationServiceId = this.destinationDeviceId()

    if (!edgeGateway || !destinationServiceId) {
      return this.hasAlternatePath(this.activePathConnectionIds())
    }

    const activePathDeviceIdSet = new Set(this.activePathDeviceIds())

    return this.cloudOnramps().some((onramp) => {
      if (activePathDeviceIdSet.has(onramp.id)) {
        return false
      }

      const edgeLink = this.activeTopology().connections.find(
        (connection) =>
          ((connection.from === edgeGateway.id && connection.to === onramp.id) ||
            (connection.from === onramp.id && connection.to === edgeGateway.id)) &&
          connection.strength !== "weak",
      )

      if (!edgeLink) {
        return false
      }

      return this.activeTopology()
        .devices.filter(
          (device) =>
            device.kind === "cloud-region" &&
            device.status !== "offline" &&
            !activePathDeviceIdSet.has(device.id),
        )
        .some((region) => {
          const backboneLink = this.activeTopology().connections.find(
            (connection) =>
              ((connection.from === onramp.id && connection.to === region.id) ||
                (connection.from === region.id && connection.to === onramp.id)) &&
              connection.strength !== "weak",
          )
          const serviceLink = this.activeTopology().connections.find(
            (connection) =>
              ((connection.from === region.id && connection.to === destinationServiceId) ||
                (connection.from === destinationServiceId && connection.to === region.id)) &&
              connection.strength !== "weak",
          )

          return Boolean(backboneLink && serviceLink)
        })
    })
  }

  private updateCenActiveTopology(updater: (topology: CenTopology) => CenTopology): void {
    const activeTopologyId = this.activeTopologyId()

    this.topologies.update((topologies) =>
      topologies.map((topology) =>
        topology.id === activeTopologyId ? updater(topology) : topology,
      ),
    )
  }
}
