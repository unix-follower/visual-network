import { Injectable } from "@angular/core"

import { PAN_TOPOLOGIES } from "./pan.data"
import { PanConnection, PanDevice, PanDeviceKind, PanTopology } from "./pan.models"
import { TopologyStateService } from "../../shared/network-topology/topology-state.service"

@Injectable({ providedIn: "root" })
export class PanStateService extends TopologyStateService<
  PanTopology,
  PanDevice,
  PanConnection,
  PanDeviceKind,
  PanDevice["status"],
  PanConnection["kind"],
  PanConnection["strength"]
> {
  constructor() {
    super(PAN_TOPOLOGIES)
  }

  protected override createDevice(
    topology: PanTopology,
    kind: PanDeviceKind,
    index: number,
  ): PanDevice {
    const id = this.createDeviceId(topology, kind, index)
    const normalizedKind = kind.charAt(0).toUpperCase() + kind.slice(1)

    return {
      id,
      label: `${normalizedKind} ${index}`,
      kind,
      status: "idle",
      batteryLevel: kind === "printer" ? undefined : 60,
      x: 200 + (index % 4) * 125,
      y: 140 + (index % 3) * 110,
      detail: `New ${kind} device added to the personal topology.`,
    }
  }
}
