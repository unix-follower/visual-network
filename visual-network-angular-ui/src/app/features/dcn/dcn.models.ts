import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "../../shared/network-topology/topology.models"

export type DcnDeviceKind =
  | "compute-node"
  | "leaf-switch"
  | "spine-switch"
  | "service-node"
  | "client-node"
  | "storage-controller"
  | "controller"
  | "fabric-switch"
  | "edge-switch"
  | "service-endpoint"
  | "uplink"
  | "storage-target"
  | "backup-storage"
  | "metro-core"
  | "building-distribution"
  | "access-node"
  | "service-handoff"
  | "provider-handoff"

export type DcnConnectionKind =
  | "rack-link"
  | "fabric-uplink"
  | "backup-uplink"
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

export type DcnDeviceStatus = "online" | "degraded" | "offline"

export type DcnDeviceRole =
  | "compute"
  | "leaf"
  | "spine"
  | "service"
  | "initiator"
  | "controller"
  | "fabric"
  | "target"

export type DcnDeviceTier =
  | "workload"
  | "leaf"
  | "spine"
  | "service"
  | "host"
  | "fabric"
  | "control"
  | "storage"

export interface DcnPolicy {
  id: string
  label: string
  summary: string
}

export interface DcnDevice extends TopologyDeviceBase<DcnDeviceKind, DcnDeviceStatus> {
  site: string
  region: string
  tier: DcnDeviceTier
  role: DcnDeviceRole
  rack?: string
  cluster?: string
  storagePool?: string
  replicationState?: string
}

export interface DcnConnection extends TopologyConnectionBase<
  DcnConnectionKind,
  "strong" | "medium" | "weak"
> {
  distanceKm: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  throughputMBps: number
  iops: number
  utilizationPct: number
  carrier: string
  costUsd: number
  priority: number
}

export interface DcnViewport extends TopologyViewport {}

export interface DcnTopology extends TopologyBase<DcnDevice, DcnConnection> {
  policies: DcnPolicy[]
  defaultPolicyId?: string
}
