import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "../../shared/network-topology/topology.models"

export type RoutingSwitchingDeviceKind =
  | "router"
  | "switch"
  | "core-switch"
  | "workstation"
  | "server"

export type RoutingSwitchingConnectionKind = "ethernet" | "trunk" | "routed-link" | "wan-link"

export type RoutingSwitchingDeviceStatus = "online" | "degraded" | "offline"

export interface RoutingSwitchingDevice extends TopologyDeviceBase<
  RoutingSwitchingDeviceKind,
  RoutingSwitchingDeviceStatus
> {
  segment: string
  role: "endpoint" | "access" | "distribution" | "core"
}

export interface RoutingSwitchingConnection extends TopologyConnectionBase<
  RoutingSwitchingConnectionKind,
  "strong" | "medium" | "weak"
> {
  metric: number
}

export interface RoutingSwitchingViewport extends TopologyViewport {}

export interface RoutingSwitchingTopology extends TopologyBase<
  RoutingSwitchingDevice,
  RoutingSwitchingConnection
> {}
