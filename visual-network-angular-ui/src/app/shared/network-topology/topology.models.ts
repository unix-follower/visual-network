export interface TopologyDeviceBase<
  TDeviceKind extends string = string,
  TDeviceStatus extends string = string,
> {
  id: string
  label: string
  kind: TDeviceKind
  status: TDeviceStatus
  x: number
  y: number
  detail: string
}

export interface TopologyConnectionBase<
  TConnectionKind extends string = string,
  TStrength extends string = string,
> {
  id: string
  from: string
  to: string
  kind: TConnectionKind
  strength: TStrength
}

export interface TopologyBase<
  TDevice extends TopologyDeviceBase = TopologyDeviceBase,
  TConnection extends TopologyConnectionBase = TopologyConnectionBase,
> {
  id: string
  name: string
  summary: string
  devices: TDevice[]
  connections: TConnection[]
}

export interface TopologyConnectionDraft<
  TConnectionKind extends string = string,
  TStrength extends string = string,
> {
  from: string
  to: string
  kind: TConnectionKind
  strength: TStrength
}

export interface TopologyViewport {
  scale: number
  offsetX: number
  offsetY: number
}
