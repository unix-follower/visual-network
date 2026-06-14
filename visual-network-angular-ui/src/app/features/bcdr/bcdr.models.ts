import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "../../shared/network-topology/topology.models"

export type BcdrDeviceKind =
  | "enterprise-client"
  | "branch-gateway"
  | "primary-app"
  | "recovery-app"
  | "replication-controller"
  | "data-vault"

export type BcdrConnectionKind =
  | "service-link"
  | "replication-link"
  | "recovery-link"
  | "management-link"

export type BcdrDeviceStatus = "online" | "degraded" | "offline"

export type BcdrDeviceRole =
  | "source"
  | "gateway"
  | "primary"
  | "recovery"
  | "controller"
  | "storage"

export type BcdrDeviceTier = "branch" | "transport" | "application" | "control" | "storage"

export type BcdrRecoveryStrategy = "active-passive" | "active-active"

export type BcdrSyncState = "synchronized" | "lagging" | "recovering"

export type BcdrHealthState = "healthy" | "degraded" | "failed"

export type BcdrRecoveryReason =
  | "replication-current"
  | "recovery-standby"
  | "recovery-promoted"
  | "sync-lag-risk"
  | "no-recovery-path"

export interface BcdrPolicy {
  id: string
  label: string
  summary: string
  strategy: BcdrRecoveryStrategy
  priority: number
}

export interface BcdrDevice extends TopologyDeviceBase<BcdrDeviceKind, BcdrDeviceStatus> {
  site: string
  region: string
  tier: BcdrDeviceTier
  role: BcdrDeviceRole
  domain: string
  syncState?: BcdrSyncState
  rack?: string
  cluster?: string
}

export interface BcdrConnection extends TopologyConnectionBase<
  BcdrConnectionKind,
  "strong" | "medium" | "weak"
> {
  distanceKm: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  throughputMBps: number
  utilizationPct: number
  carrier: string
  costUsd: number
  priority: number
  health: BcdrHealthState
  recoveryAction: string
  policyId?: string
  notes?: string
}

export interface BcdrViewport extends TopologyViewport {}

export interface BcdrTopology extends TopologyBase<BcdrDevice, BcdrConnection> {
  policies: BcdrPolicy[]
  defaultPolicyId?: string
}
