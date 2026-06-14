import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "../../shared/network-topology/topology.models"

export type CenDeviceKind =
  | "edge-workload"
  | "edge-gateway"
  | "cloud-onramp"
  | "cloud-region"
  | "service-endpoint"

export type CenConnectionKind = "local-link" | "edge-uplink" | "cloud-backbone" | "service-link"

export type CenDeviceStatus = "online" | "degraded" | "offline"

export type CenDeviceRole = "edge" | "gateway" | "cloud" | "service"

export type CenDeviceTier = "edge" | "gateway" | "cloud" | "service"

export interface CenPolicy {
  id: string
  label: string
  summary: string
}

export interface CenDevice extends TopologyDeviceBase<CenDeviceKind, CenDeviceStatus> {
  site: string
  region: string
  tier: CenDeviceTier
  role: CenDeviceRole
  rack?: string
  cluster?: string
  zone?: string
}

export interface CenConnection extends TopologyConnectionBase<
  CenConnectionKind,
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

export interface CenViewport extends TopologyViewport {}

export interface CenTopology extends TopologyBase<CenDevice, CenConnection> {
  policies: CenPolicy[]
  defaultPolicyId?: string
}
