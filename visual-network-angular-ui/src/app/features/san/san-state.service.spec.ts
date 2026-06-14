import { TestBed } from "@angular/core/testing"

import { SanStateService } from "./san-state.service"

describe("SanStateService", () => {
  let service: SanStateService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(SanStateService)
  })

  it("starts with the primary storage path for the default preset", () => {
    expect(service.sourceDeviceId()).toBe("app-host")
    expect(service.destinationDeviceId()).toBe("primary-array")
    expect(service.activePathDeviceIds()).toEqual(["app-host", "fabric-a", "primary-array"])
    expect(service.activePathConnectionIds()).toEqual([
      "app-host-fabric-a",
      "fabric-a-primary-array",
    ])
    expect(service.failoverState()).toBe("primary")
    expect(service.activeLatencyMs()).toBe(5)
    expect(service.activeThroughputMBps()).toBe(3200)
    expect(service.activeIops()).toBe(220000)
    expect(service.storageControllerSummary()).toBe("Storage Controller")
    expect(service.replicationSummary()).toBe("Synchronized replica ready")
    expect(service.carrierSummary()).toBe("Fabric A")
  })

  it("fails over to the backup storage target when the primary array goes offline", () => {
    service.selectDevice("primary-array")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.destinationDeviceId()).toBe("backup-array")
    expect(service.activePathDeviceIds()).toEqual(["app-host", "fabric-b", "backup-array"])
    expect(service.activePathConnectionIds()).toEqual([
      "app-host-fabric-b",
      "fabric-b-backup-array",
    ])
    expect(service.failoverState()).toBe("failover")
    expect(service.redundancySummary()).toBe("Replica active")
    expect(service.failoverReason()).toContain("protected storage path")
    expect(service.replicationSummary()).toBe("Serving from replica")
    expect(service.carrierSummary()).toBe("Fabric B")
  })

  it("starts the dual-fabric preset on the degraded primary fabric path", () => {
    service.selectTopology("dual-fabric-storage")

    expect(service.sourceDeviceId()).toBe("analytics-host")
    expect(service.destinationDeviceId()).toBe("flash-array")
    expect(service.activePathConnectionIds()).toEqual([
      "analytics-host-fabric-east",
      "fabric-east-flash-array",
    ])
    expect(service.failoverState()).toBe("degraded")
    expect(service.redundancySummary()).toBe("Protected")
    expect(service.selectedDeviceId()).toBe("analytics-host")
  })

  it("fails over to the secondary fabric when the primary fabric goes offline", () => {
    service.selectTopology("dual-fabric-storage")
    service.selectDevice("fabric-east")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.activePathConnectionIds()).toEqual([
      "analytics-host-fabric-west",
      "fabric-west-flash-array",
    ])
    expect(service.failoverState()).toBe("failover")
    expect(service.carrierSummary()).toBe("Fabric West")
  })

  it("blocks the SAN route when both data fabrics are offline", () => {
    service.selectTopology("dual-fabric-storage")
    service.selectDevice("fabric-east")
    service.updateSelectedDevice({ status: "offline" })
    service.selectDevice("fabric-west")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.failoverState()).toBe("blocked")
    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.failoverReason()).toBe(
      "No storage path is currently available to the selected target.",
    )
    expect(service.carrierSummary()).toBe("No SAN fabrics active.")
  })

  it("updates SAN link telemetry when editing an existing path edge", () => {
    service.addOrUpdateSanConnection({
      from: "app-host",
      to: "fabric-b",
      kind: "backup-link",
      strength: "weak",
      distanceKm: 4,
      latencyMs: 10,
      jitterMs: 4,
      packetLossPct: 0.6,
      throughputMBps: 900,
      iops: 64000,
      carrier: "Fabric B",
      costUsd: 1400,
      priority: 3,
    })

    const updatedConnection = service
      .activeTopology()
      .connections.find((connection) => connection.id === "app-host-fabric-b")

    expect(updatedConnection?.kind).toBe("backup-link")
    expect(updatedConnection?.strength).toBe("weak")
    expect(updatedConnection?.latencyMs).toBe(10)
    expect(updatedConnection?.throughputMBps).toBe(900)
    expect(updatedConnection?.iops).toBe(64000)
  })

  it("reassigns SAN endpoints when the current source initiator becomes offline", () => {
    service.selectDevice("app-host")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.sourceDevices().map((device) => device.id)).toEqual(["batch-host"])
    expect(service.endpointDevices().map((device) => device.id)).toEqual([
      "primary-array",
      "backup-array",
    ])
    expect(service.sourceDeviceId()).toBe("batch-host")
    expect(service.destinationDeviceId()).toBe("primary-array")
    expect(service.selectedDeviceId()).toBe("batch-host")
    expect(service.activePathDeviceIds()).toEqual(["batch-host", "fabric-a", "primary-array"])
  })
})
