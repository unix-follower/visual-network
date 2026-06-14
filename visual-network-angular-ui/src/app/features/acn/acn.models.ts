import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "../../shared/network-topology/topology.models"

export type AcnDeviceKind =
  | "source-host"
  | "access-firewall"
  | "service-host"
  | "management-station"

export type AcnConnectionKind = "allowed-link" | "inspection-link" | "blocked-link"

export type AcnDeviceStatus = "online" | "degraded" | "offline"

export type AcnDeviceRole = "source" | "security" | "service" | "management"

export type AcnDeviceTier = "client" | "enforcement" | "service" | "operations"

export type AcnPolicyAction = "allow" | "block" | "inspect"

export type AcnViolationReason =
  | "implicit-deny"
  | "explicit-block"
  | "zone-mismatch"
  | "no-violation"

export interface AcnPolicy {
  id: string
  label: string
  summary: string
  sourceZone: string
  destinationZone: string
  action: AcnPolicyAction
  violationReason: AcnViolationReason
  priority: number
}

export interface AcnDevice extends TopologyDeviceBase<AcnDeviceKind, AcnDeviceStatus> {
  site: string
  region: string
  tier: AcnDeviceTier
  role: AcnDeviceRole
  zone: string
  rack?: string
  cluster?: string
}

export interface AcnConnection extends TopologyConnectionBase<
  AcnConnectionKind,
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
  action: AcnPolicyAction
  ruleId: string
  sourceZone: string
  destinationZone: string
}

export interface AcnViewport extends TopologyViewport {}

export interface AcnTopology extends TopologyBase<AcnDevice, AcnConnection> {
  policies: AcnPolicy[]
  defaultPolicyId?: string
}
