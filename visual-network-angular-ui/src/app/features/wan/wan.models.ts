import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "../../shared/network-topology/topology.models"

export type WanDeviceKind = "branch" | "headquarters" | "data-center" | "cloud" | "provider-edge"

export type WanConnectionKind = "mpls" | "internet-vpn" | "direct-connect" | "backup-link"

export type WanDeviceStatus = "online" | "degraded" | "offline"

export type WanDeviceRole = "site" | "transit" | "service" | "cloud"

export type WanDeviceTier = "branch" | "regional" | "core" | "cloud"

export interface WanDevice extends TopologyDeviceBase<WanDeviceKind, WanDeviceStatus> {
  site: string
  region: string
  tier: WanDeviceTier
  role: WanDeviceRole
}

export interface WanConnection extends TopologyConnectionBase<
  WanConnectionKind,
  "strong" | "medium" | "weak"
> {
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  bandwidthMbps: number
  carrier: string
  costUsd: number
  priority: number
}

export interface WanViewport extends TopologyViewport {}

export interface WanTopology extends TopologyBase<WanDevice, WanConnection> {}
