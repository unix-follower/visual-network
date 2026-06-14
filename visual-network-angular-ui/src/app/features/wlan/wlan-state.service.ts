import { computed, Injectable, signal } from "@angular/core"

import { TopologyStateService } from "../../shared/network-topology/topology-state.service"
import { WLAN_TOPOLOGIES } from "./wlan.data"
import { WlanConnection, WlanDevice, WlanDeviceKind, WlanTopology } from "./wlan.models"

interface WlanAssociation {
  clientId: string | null
  accessPointId: string | null
  gatewayId: string | null
  pathDeviceIds: string[]
  pathConnectionIds: string[]
  signalRssi: number | null
  throughputMbps: number | null
  roamingState: "stable" | "candidate" | "blocked"
}

interface WlanConnectionDraft {
  from: string
  to: string
  kind: WlanConnection["kind"]
  strength: WlanConnection["strength"]
  rssi: number
  throughputMbps: number
}

@Injectable({ providedIn: "root" })
export class WlanStateService extends TopologyStateService<
  WlanTopology,
  WlanDevice,
  WlanConnection,
  WlanDeviceKind,
  WlanDevice["status"],
  WlanConnection["kind"],
  WlanConnection["strength"]
> {
  readonly accessPoints = computed(() =>
    this.activeTopology().devices.filter((device) => device.kind === "access-point"),
  )
  readonly clients = computed(() =>
    this.activeTopology().devices.filter((device) => device.kind === "client"),
  )
  readonly gateway = computed(
    () =>
      this.activeTopology().devices.find(
        (device) => device.role === "edge" || device.kind === "gateway",
      ) ?? null,
  )
  readonly selectedClientId = signal<string | null>(null)
  readonly preferredAccessPointId = signal<string | null>(null)
  readonly activeAssociation = computed(() =>
    this.resolveAssociation(
      this.activeTopology(),
      this.selectedClientId(),
      this.preferredAccessPointId(),
    ),
  )
  readonly activePathConnectionIds = computed(() => this.activeAssociation().pathConnectionIds)
  readonly activePathDeviceIds = computed(() => this.activeAssociation().pathDeviceIds)
  readonly signalSummary = computed(() => {
    const association = this.activeAssociation()

    if (association.signalRssi === null || association.throughputMbps === null) {
      return "No wireless association available."
    }

    return `${association.signalRssi} dBm, ${association.throughputMbps} Mbps`
  })

  constructor() {
    super(WLAN_TOPOLOGIES)
    this.initializeSelections(this.activeTopology())
  }

  override selectTopology(topologyId: string): void {
    super.selectTopology(topologyId)
    this.initializeSelections(this.activeTopology())
  }

  selectClient(clientId: string): void {
    this.selectedClientId.set(clientId)
    this.selectedDeviceId.set(clientId)
  }

  selectPreferredAccessPoint(accessPointId: string | null): void {
    this.preferredAccessPointId.set(accessPointId)
  }

  addOrUpdateWlanConnection(draft: WlanConnectionDraft): void {
    if (!draft.from || !draft.to || draft.from === draft.to) {
      return
    }

    this.updateWlanActiveTopology((topology) => {
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
                  rssi: draft.rssi,
                  throughputMbps: draft.throughputMbps,
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
            rssi: draft.rssi,
            throughputMbps: draft.throughputMbps,
          },
        ],
      }
    })
  }

  protected override createDevice(
    topology: WlanTopology,
    kind: WlanDeviceKind,
    index: number,
  ): WlanDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

    if (kind === "client") {
      return {
        id,
        label: `Client ${index}`,
        kind,
        status: "online",
        x: 160 + (index % 4) * 130,
        y: 330 + (index % 2) * 55,
        detail: "New wireless client added to the topology.",
        zone: "Unassigned zone",
        role: "endpoint",
        band: "dual-band",
        channel: "Client auto",
        coverageRadius: 0,
      }
    }

    let role: WlanDevice["role"] = "access"

    if (kind === "gateway") {
      role = "edge"
    } else if (kind === "controller") {
      role = "control"
    }

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "degraded",
      x: 160 + (index % 4) * 140,
      y: 120 + (index % 3) * 100,
      detail: `New ${normalizedKind.toLowerCase()} added to the wireless topology.`,
      zone: "New zone",
      role,
      band: kind === "access-point" ? "dual-band" : "wired-only",
      channel: kind === "access-point" ? "5 GHz ch 36" : "Mgmt",
      coverageRadius: kind === "access-point" ? 135 : 0,
    }
  }

  private initializeSelections(topology: WlanTopology): void {
    const firstClient = topology.devices.find((device) => device.kind === "client")?.id ?? null
    this.selectedClientId.set(firstClient)
    this.selectedDeviceId.set(firstClient ?? topology.devices[0]?.id ?? null)
    this.preferredAccessPointId.set(null)
  }

  private resolveAssociation(
    topology: WlanTopology,
    clientId: string | null,
    preferredAccessPointId: string | null,
  ): WlanAssociation {
    if (!clientId) {
      return this.emptyAssociation()
    }

    const wirelessCandidates = topology.connections
      .filter(
        (connection) =>
          connection.kind === "wireless-link" &&
          (connection.from === clientId || connection.to === clientId),
      )
      .map((connection) => ({
        connection,
        accessPointId: connection.from === clientId ? connection.to : connection.from,
      }))
      .filter(({ accessPointId }) =>
        topology.devices.some(
          (device) => device.id === accessPointId && device.kind === "access-point",
        ),
      )

    if (wirelessCandidates.length === 0) {
      return this.emptyAssociation(clientId)
    }

    const preferredCandidate = wirelessCandidates.find(
      ({ accessPointId }) => accessPointId === preferredAccessPointId,
    )
    const chosenCandidate =
      preferredCandidate ??
      [...wirelessCandidates].sort((left, right) => right.connection.rssi - left.connection.rssi)[0]
    const gatewayId = this.gateway()?.id ?? null

    if (!gatewayId) {
      return {
        clientId,
        accessPointId: chosenCandidate.accessPointId,
        gatewayId: null,
        pathDeviceIds: [clientId, chosenCandidate.accessPointId],
        pathConnectionIds: [chosenCandidate.connection.id],
        signalRssi: chosenCandidate.connection.rssi,
        throughputMbps: chosenCandidate.connection.throughputMbps,
        roamingState: preferredCandidate ? "candidate" : "stable",
      }
    }

    const wiredPath = this.findPath(
      topology,
      chosenCandidate.accessPointId,
      gatewayId,
      new Set([chosenCandidate.connection.id]),
    )

    let roamingState: WlanAssociation["roamingState"] = "stable"

    if (preferredCandidate) {
      roamingState = "candidate"
    } else if (wiredPath.connectionIds.length === 0) {
      roamingState = "blocked"
    }

    return {
      clientId,
      accessPointId: chosenCandidate.accessPointId,
      gatewayId,
      pathDeviceIds: [clientId, ...wiredPath.deviceIds],
      pathConnectionIds: [chosenCandidate.connection.id, ...wiredPath.connectionIds],
      signalRssi: chosenCandidate.connection.rssi,
      throughputMbps: chosenCandidate.connection.throughputMbps,
      roamingState,
    }
  }

  private findPath(
    topology: WlanTopology,
    sourceDeviceId: string,
    destinationDeviceId: string,
    excludedConnectionIds: Set<string>,
  ): { deviceIds: string[]; connectionIds: string[] } {
    if (sourceDeviceId === destinationDeviceId) {
      return { deviceIds: [sourceDeviceId], connectionIds: [] }
    }

    const queue: string[] = [sourceDeviceId]
    const visited = new Set<string>([sourceDeviceId])
    const previousDevice = new Map<string, { deviceId: string; connectionId: string }>()

    while (queue.length > 0) {
      const currentDeviceId = queue.shift()

      if (!currentDeviceId) {
        continue
      }

      if (currentDeviceId === destinationDeviceId) {
        break
      }

      topology.connections.forEach((connection) => {
        if (excludedConnectionIds.has(connection.id)) {
          return
        }

        let neighborId: string | null = null

        if (connection.from === currentDeviceId) {
          neighborId = connection.to
        } else if (connection.to === currentDeviceId) {
          neighborId = connection.from
        }

        if (!neighborId || visited.has(neighborId)) {
          return
        }

        visited.add(neighborId)
        previousDevice.set(neighborId, { deviceId: currentDeviceId, connectionId: connection.id })
        queue.push(neighborId)
      })
    }

    if (!previousDevice.has(destinationDeviceId)) {
      return { deviceIds: [sourceDeviceId], connectionIds: [] }
    }

    const deviceIds: string[] = []
    const connectionIds: string[] = []
    let currentDeviceId = destinationDeviceId

    while (currentDeviceId !== sourceDeviceId) {
      deviceIds.unshift(currentDeviceId)
      const previousHop = previousDevice.get(currentDeviceId)

      if (!previousHop) {
        return { deviceIds: [sourceDeviceId], connectionIds: [] }
      }

      connectionIds.unshift(previousHop.connectionId)
      currentDeviceId = previousHop.deviceId
    }

    deviceIds.unshift(sourceDeviceId)
    return { deviceIds, connectionIds }
  }

  private emptyAssociation(clientId: string | null = null): WlanAssociation {
    return {
      clientId,
      accessPointId: null,
      gatewayId: null,
      pathDeviceIds: clientId ? [clientId] : [],
      pathConnectionIds: [],
      signalRssi: null,
      throughputMbps: null,
      roamingState: "blocked",
    }
  }

  private updateWlanActiveTopology(updater: (topology: WlanTopology) => WlanTopology): void {
    const activeTopologyId = this.activeTopologyId()

    this.topologies.update((topologies) =>
      topologies.map((topology) =>
        topology.id === activeTopologyId ? updater(topology) : topology,
      ),
    )
  }
}
