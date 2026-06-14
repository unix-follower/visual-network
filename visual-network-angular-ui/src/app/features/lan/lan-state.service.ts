import { Injectable } from "@angular/core"

import { LAN_TOPOLOGIES } from "./lan.data"
import { LanConnection, LanDevice, LanDeviceKind, LanTopology } from "./lan.models"
import { TopologyStateService } from "../../shared/network-topology/topology-state.service"

@Injectable({ providedIn: "root" })
export class LanStateService extends TopologyStateService<
  LanTopology,
  LanDevice,
  LanConnection,
  LanDeviceKind,
  LanDevice["status"],
  LanConnection["kind"],
  LanConnection["strength"]
> {
  constructor() {
    super(LAN_TOPOLOGIES)
  }

  protected override createDevice(
    topology: LanTopology,
    kind: LanDeviceKind,
    index: number,
  ): LanDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "degraded",
      x: 200 + (index % 4) * 125,
      y: 140 + (index % 3) * 110,
      detail: `New ${kind} device added to the LAN topology.`,
    }
  }
}
