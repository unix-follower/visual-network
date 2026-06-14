import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "../../shared/network-topology/topology.models"

export type WlanDeviceKind = "access-point" | "client" | "controller" | "gateway"

export type WlanConnectionKind = "wireless-link" | "wired-uplink" | "mesh-backhaul"

export type WlanDeviceStatus = "online" | "degraded" | "offline"

export type WlanDeviceRole = "access" | "endpoint" | "control" | "edge"

export interface WlanDevice extends TopologyDeviceBase<WlanDeviceKind, WlanDeviceStatus> {
  zone: string
  role: WlanDeviceRole
  band: "dual-band" | "tri-band" | "6-ghz" | "wired-only"
  channel: string
  coverageRadius: number
}

export interface WlanConnection extends TopologyConnectionBase<
  WlanConnectionKind,
  "strong" | "medium" | "weak"
> {
  rssi: number
  throughputMbps: number
}

export interface WlanViewport extends TopologyViewport {}

export interface WlanTopology extends TopologyBase<WlanDevice, WlanConnection> {}
