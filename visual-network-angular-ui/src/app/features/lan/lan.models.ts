export type LanDeviceKind =
  | "router"
  | "switch"
  | "access-point"
  | "server"
  | "workstation"
  | "printer"

export type LanConnectionKind = "ethernet" | "trunk" | "wireless" | "uplink"

export type LanDeviceStatus = "online" | "degraded" | "offline"

export interface LanDevice {
  id: string
  label: string
  kind: LanDeviceKind
  status: LanDeviceStatus
  x: number
  y: number
  detail: string
}

export interface LanConnection {
  id: string
  from: string
  to: string
  kind: LanConnectionKind
  strength: "strong" | "medium" | "weak"
}

export interface LanViewport {
  scale: number
  offsetX: number
  offsetY: number
}

export interface LanTopology {
  id: string
  name: string
  summary: string
  devices: LanDevice[]
  connections: LanConnection[]
}
