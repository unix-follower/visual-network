import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "../../shared/network-topology/topology.models"

export type ManDeviceKind =
  | "metro-core"
  | "building-distribution"
  | "access-node"
  | "service-handoff"
  | "provider-handoff"

export type ManConnectionKind = "metro-fiber" | "metro-ethernet" | "leased-line" | "backup-link"

export type ManDeviceStatus = "online" | "degraded" | "offline"

export type ManDeviceRole = "site" | "transit" | "service"

export type ManDeviceTier = "building" | "district" | "metro"

export interface ManDevice extends TopologyDeviceBase<ManDeviceKind, ManDeviceStatus> {
  site: string
  region: string
  tier: ManDeviceTier
  role: ManDeviceRole
}

export interface ManConnection extends TopologyConnectionBase<
  ManConnectionKind,
  "strong" | "medium" | "weak"
> {
  distanceKm: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  bandwidthMbps: number
  carrier: string
  costUsd: number
  priority: number
}

export interface ManViewport extends TopologyViewport {}

export interface ManTopology extends TopologyBase<ManDevice, ManConnection> {}
