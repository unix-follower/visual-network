import { computed, Injectable, signal } from "@angular/core"

import { TopologyStateService } from "../../shared/network-topology/topology-state.service"
import { ROUTING_SWITCHING_TOPOLOGIES } from "./routing-switching.data"
import {
  RoutingSwitchingConnection,
  RoutingSwitchingDevice,
  RoutingSwitchingDeviceKind,
  RoutingSwitchingTopology,
} from "./routing-switching.models"

interface RoutePath {
  deviceIds: string[]
  connectionIds: string[]
}

@Injectable({ providedIn: "root" })
export class RoutingSwitchingStateService extends TopologyStateService<
  RoutingSwitchingTopology,
  RoutingSwitchingDevice,
  RoutingSwitchingConnection,
  RoutingSwitchingDeviceKind,
  RoutingSwitchingDevice["status"],
  RoutingSwitchingConnection["kind"],
  RoutingSwitchingConnection["strength"]
> {
  readonly endpointDevices = computed(() =>
    this.activeTopology().devices.filter(
      (device) => device.role === "endpoint" && device.status !== "offline",
    ),
  )
  readonly sourceDeviceId = signal<string | null>(null)
  readonly destinationDeviceId = signal<string | null>(null)
  readonly activePath = computed<RoutePath>(() =>
    this.findRoutePath(this.activeTopology(), this.sourceDeviceId(), this.destinationDeviceId()),
  )
  readonly activePathDeviceIds = computed(() => this.activePath().deviceIds)
  readonly activePathConnectionIds = computed(() => this.activePath().connectionIds)

  constructor() {
    super(ROUTING_SWITCHING_TOPOLOGIES)
    this.initializeEndpoints(this.activeTopology())
  }

  override selectTopology(topologyId: string): void {
    super.selectTopology(topologyId)
    this.initializeEndpoints(this.activeTopology())
  }

  selectSourceDevice(deviceId: string): void {
    this.sourceDeviceId.set(deviceId)
  }

  selectDestinationDevice(deviceId: string): void {
    this.destinationDeviceId.set(deviceId)
  }

  protected override createDevice(
    topology: RoutingSwitchingTopology,
    kind: RoutingSwitchingDeviceKind,
    index: number,
  ): RoutingSwitchingDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "degraded",
      x: 160 + (index % 4) * 140,
      y: 120 + (index % 3) * 115,
      detail: `New ${normalizedKind.toLowerCase()} added to the routed topology.`,
      segment: "New segment",
      role: kind === "workstation" || kind === "server" ? "endpoint" : "access",
    }
  }

  private initializeEndpoints(topology: RoutingSwitchingTopology): void {
    const endpoints = topology.devices.filter(
      (device) => device.role === "endpoint" && device.status !== "offline",
    )
    this.sourceDeviceId.set(endpoints[0]?.id ?? null)
    this.destinationDeviceId.set(endpoints[1]?.id ?? endpoints[0]?.id ?? null)
  }

  private findRoutePath(
    topology: RoutingSwitchingTopology,
    sourceDeviceId: string | null,
    destinationDeviceId: string | null,
  ): RoutePath {
    if (!sourceDeviceId || !destinationDeviceId) {
      return { deviceIds: [], connectionIds: [] }
    }

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
        return { deviceIds: [], connectionIds: [] }
      }

      connectionIds.unshift(previousHop.connectionId)
      currentDeviceId = previousHop.deviceId
    }

    deviceIds.unshift(sourceDeviceId)
    return { deviceIds, connectionIds }
  }
}
