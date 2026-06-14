export type PanDeviceKind =
  | "phone"
  | "laptop"
  | "tablet"
  | "watch"
  | "headset"
  | "printer"
  | "hotspot"

export type PanConnectionKind = "usb" | "bluetooth" | "wifi" | "tethering"

export type PanDeviceStatus = "online" | "idle" | "offline"

export interface PanDevice {
  id: string
  label: string
  kind: PanDeviceKind
  status: PanDeviceStatus
  batteryLevel?: number
  x: number
  y: number
  detail: string
}

export interface PanConnection {
  id: string
  from: string
  to: string
  kind: PanConnectionKind
  strength: "strong" | "medium" | "weak"
}

export interface PanViewport {
  scale: number
  offsetX: number
  offsetY: number
}

export interface PanTopology {
  id: string
  name: string
  summary: string
  devices: PanDevice[]
  connections: PanConnection[]
}
