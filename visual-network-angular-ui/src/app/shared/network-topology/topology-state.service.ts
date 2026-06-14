import { computed, Signal, signal, WritableSignal } from "@angular/core"

import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyConnectionDraft,
  TopologyDeviceBase,
} from "./topology.models"

export abstract class TopologyStateService<
  TTopology extends TopologyBase<TDevice, TConnection>,
  TDevice extends TopologyDeviceBase<TDeviceKind, TDeviceStatus>,
  TConnection extends TopologyConnectionBase<TConnectionKind, TStrength>,
  TDeviceKind extends string,
  TDeviceStatus extends string,
  TConnectionKind extends string,
  TStrength extends string,
> {
  readonly topologies: WritableSignal<TTopology[]>
  readonly activeTopologyId: WritableSignal<string>
  readonly selectedDeviceId: WritableSignal<string | null>
  readonly activeTopology: Signal<TTopology>
  readonly selectedDevice: Signal<TDevice | null>

  protected constructor(initialTopologies: TTopology[]) {
    this.topologies = signal(initialTopologies)
    this.activeTopologyId = signal(initialTopologies[0]?.id ?? "")
    this.selectedDeviceId = signal<string | null>(initialTopologies[0]?.devices[0]?.id ?? null)

    this.activeTopology = computed<TTopology>(() => {
      const topology = this.topologies().find((item) => item.id === this.activeTopologyId())
      return topology ?? this.topologies()[0]
    })

    this.selectedDevice = computed(() => {
      const selectedId = this.selectedDeviceId()
      return this.activeTopology().devices.find((device) => device.id === selectedId) ?? null
    })
  }

  selectTopology(topologyId: string): void {
    const topology = this.topologies().find((item) => item.id === topologyId)

    if (!topology) {
      return
    }

    this.activeTopologyId.set(topology.id)
    this.selectedDeviceId.set(topology.devices[0]?.id ?? null)
  }

  selectDevice(deviceId: string | null): void {
    this.selectedDeviceId.set(deviceId)
  }

  addDevice(kind: TDeviceKind): void {
    this.updateActiveTopology((topology) => {
      const nextIndex = topology.devices.length + 1
      const nextDevice = this.createDevice(topology, kind, nextIndex)
      return {
        ...topology,
        devices: [...topology.devices, nextDevice],
      }
    })

    const addedDevice = this.activeTopology().devices.at(-1)
    this.selectedDeviceId.set(addedDevice?.id ?? null)
  }

  removeSelectedDevice(): void {
    const selectedDeviceId = this.selectedDeviceId()

    if (!selectedDeviceId) {
      return
    }

    this.updateActiveTopology((topology) => ({
      ...topology,
      devices: topology.devices.filter((device) => device.id !== selectedDeviceId),
      connections: topology.connections.filter(
        (connection) => connection.from !== selectedDeviceId && connection.to !== selectedDeviceId,
      ),
    }))

    const fallbackDevice = this.activeTopology().devices[0]
    this.selectedDeviceId.set(fallbackDevice?.id ?? null)
  }

  updateSelectedDevice(patch: Partial<TDevice>): void {
    const selectedDeviceId = this.selectedDeviceId()

    if (!selectedDeviceId) {
      return
    }

    this.updateActiveTopology((topology) => ({
      ...topology,
      devices: topology.devices.map((device) =>
        device.id === selectedDeviceId
          ? {
              ...device,
              ...patch,
            }
          : device,
      ),
    }))
  }

  addOrUpdateConnection(draft: TopologyConnectionDraft<TConnectionKind, TStrength>): void {
    if (!draft.from || !draft.to || draft.from === draft.to) {
      return
    }

    this.updateActiveTopology((topology) => {
      const existingConnection = topology.connections.find((connection) =>
        this.isSameConnection(connection, draft),
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
          } as TConnection,
        ],
      }
    })
  }

  removeConnection(connectionId: string): void {
    this.updateActiveTopology((topology) => ({
      ...topology,
      connections: topology.connections.filter((connection) => connection.id !== connectionId),
    }))
  }

  protected createDeviceId(topology: TTopology, kind: TDeviceKind, index: number): string {
    let suffix = index
    let id = `${kind}-${suffix}`

    while (topology.devices.some((device) => device.id === id)) {
      suffix += 1
      id = `${kind}-${suffix}`
    }

    return id
  }

  protected createConnectionId(from: string, to: string): string {
    const [left, right] = [from, to].sort((first, second) => first.localeCompare(second))
    return `${left}-${right}`
  }

  private updateActiveTopology(updater: (topology: TTopology) => TTopology): void {
    const activeTopologyId = this.activeTopologyId()

    this.topologies.update((topologies) =>
      topologies.map((topology) =>
        topology.id === activeTopologyId ? updater(topology) : topology,
      ),
    )
  }

  private isSameConnection(
    connection: TConnection,
    draft: TopologyConnectionDraft<TConnectionKind, TStrength>,
  ): boolean {
    return (
      (connection.from === draft.from && connection.to === draft.to) ||
      (connection.from === draft.to && connection.to === draft.from)
    )
  }

  protected abstract createDevice(topology: TTopology, kind: TDeviceKind, index: number): TDevice
}
