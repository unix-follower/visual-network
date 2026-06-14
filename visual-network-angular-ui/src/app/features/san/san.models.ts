import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "../../shared/network-topology/topology.models"

export type SanDeviceKind =
  | "client-node"
  | "storage-controller"
  | "fabric-switch"
  | "storage-target"
  | "backup-storage"
  | "controller"
  | "edge-switch"
  | "service-endpoint"
  | "uplink"
  | "metro-core"
  | "building-distribution"
  | "access-node"
  | "service-handoff"
  | "provider-handoff"

export type SanConnectionKind =
  | "fiber-channel"
  | "sas-link"
  | "mgmt-link"
  | "backup-link"
  | "fabric-link"
  | "overlay-link"
  | "direct-link"
  | "metro-fiber"
  | "metro-ethernet"
  | "leased-line"

export type SanDeviceStatus = "online" | "degraded" | "offline"

export type SanDeviceRole =
  | "initiator"
  | "controller"
  | "fabric"
  | "target"
  | "site"
  | "transit"
  | "service"

export type SanDeviceTier =
  | "host"
  | "fabric"
  | "control"
  | "storage"
  | "edge"
  | "service"
  | "building"
  | "district"
  | "metro"

export type SanReplicationState = "standalone" | "synchronized" | "lagging" | "serving-replica"

export interface SanPolicy {
  id: string
  label: string
  summary: string
}

export interface SanDevice extends TopologyDeviceBase<SanDeviceKind, SanDeviceStatus> {
  site: string
  region: string
  tier: SanDeviceTier
  role: SanDeviceRole
  storagePool?: string
  replicationState?: SanReplicationState
}

export interface SanConnection extends TopologyConnectionBase<
  SanConnectionKind,
  "strong" | "medium" | "weak"
> {
  distanceKm: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  throughputMBps: number
  iops: number
  carrier: string
  costUsd: number
  priority: number
}

export interface SanViewport extends TopologyViewport {}

export interface SanTopology extends TopologyBase<SanDevice, SanConnection> {
  policies: SanPolicy[]
  defaultPolicyId?: string
}
