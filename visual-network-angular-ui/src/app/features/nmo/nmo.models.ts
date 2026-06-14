import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "../../shared/network-topology/topology.models"

export type NmoDeviceKind =
  | "managed-node"
  | "automation-controller"
  | "health-monitor"
  | "backup-gateway"
  | "service-endpoint"

export type NmoConnectionKind = "primary-link" | "backup-link" | "control-link" | "monitor-link"

export type NmoDeviceStatus = "online" | "degraded" | "offline"

export type NmoDeviceRole = "source" | "controller" | "monitor" | "backup" | "service" | "transit"

export type NmoDeviceTier = "edge" | "control" | "observability" | "transport" | "service" | "core"

export type NmoAutomationMode = "detect-only" | "auto-failover"

export type NmoHealthState = "healthy" | "degraded" | "failed"

export type NmoRemediationReason =
  | "no-issue"
  | "monitor-alert"
  | "policy-hold"
  | "auto-reroute"
  | "no-backup-path"

export interface NmoPolicy {
  id: string
  label: string
  summary: string
  mode: NmoAutomationMode
  priority: number
}

export interface NmoDevice extends TopologyDeviceBase<NmoDeviceKind, NmoDeviceStatus> {
  site: string
  region: string
  tier: NmoDeviceTier
  role: NmoDeviceRole
  domain: string
  rack?: string
  cluster?: string
}

export interface NmoConnection extends TopologyConnectionBase<
  NmoConnectionKind,
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
  health: NmoHealthState
  remediationAction: string
  policyId?: string
  notes?: string
}

export interface NmoViewport extends TopologyViewport {}

export interface NmoTopology extends TopologyBase<NmoDevice, NmoConnection> {
  policies: NmoPolicy[]
  defaultPolicyId?: string
}
