import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "../../shared/network-topology/topology.models"

export type SdnDeviceKind =
  | "controller"
  | "fabric-switch"
  | "edge-switch"
  | "service-endpoint"
  | "uplink"
  | "metro-core"
  | "building-distribution"
  | "access-node"
  | "service-handoff"
  | "provider-handoff"

export type SdnConnectionKind =
  | "fabric-link"
  | "overlay-link"
  | "direct-link"
  | "backup-link"
  | "metro-fiber"
  | "metro-ethernet"
  | "leased-line"

export type SdnDeviceStatus = "online" | "degraded" | "offline"

export type SdnDeviceRole = "controller" | "site" | "transit" | "service"

export type SdnDeviceTier =
  | "edge"
  | "fabric"
  | "control"
  | "service"
  | "building"
  | "district"
  | "metro"

export interface SdnDevice extends TopologyDeviceBase<SdnDeviceKind, SdnDeviceStatus> {
  site: string
  region: string
  tier: SdnDeviceTier
  role: SdnDeviceRole
}

export interface SdnConnection extends TopologyConnectionBase<
  SdnConnectionKind,
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
  intents: SdnIntent[]
}

export interface SdnViewport extends TopologyViewport {}

export type SdnIntent = "latency" | "compliance" | "resilience"

export interface SdnPolicy {
  id: string
  label: string
  summary: string
  intent: SdnIntent
  overrideReason: string
}

export interface SdnTopology extends TopologyBase<SdnDevice, SdnConnection> {
  policies: SdnPolicy[]
  defaultPolicyId: string
}
