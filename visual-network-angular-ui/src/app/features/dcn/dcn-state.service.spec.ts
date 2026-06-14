import { TestBed } from "@angular/core/testing"

import { DcnStateService } from "./dcn-state.service"

describe("DcnStateService", () => {
  let service: DcnStateService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(DcnStateService)
  })

  it("starts with the preferred leaf-spine path for the default preset", () => {
    expect(service.sourceDeviceId()).toBe("app-pod")
    expect(service.destinationDeviceId()).toBe("orders-service")
    expect(service.activePathDeviceIds()).toEqual([
      "app-pod",
      "leaf-compute",
      "spine-1",
      "leaf-services",
      "orders-service",
    ])
    expect(service.activePathConnectionIds()).toEqual([
      "app-pod-leaf-compute",
      "leaf-compute-spine-1",
      "spine-1-leaf-services",
      "leaf-services-orders-service",
    ])
    expect(service.failoverState()).toBe("primary")
    expect(service.activeLatencyMs()).toBe(6)
    expect(service.activeThroughputMBps()).toBe(12000)
    expect(service.redundancySummary()).toBe("Protected")
    expect(service.controllerSummary()).toBe("Spine 1, Spine 2")
    expect(service.replicationSummary()).toBe("Alternate spine available")
    expect(service.carrierSummary()).toContain("Fabric Blue")
  })

  it("fails over to the alternate spine when the preferred spine goes offline", () => {
    service.selectDevice("spine-1")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.activePathDeviceIds()).toEqual([
      "app-pod",
      "leaf-compute",
      "spine-2",
      "leaf-services",
      "orders-service",
    ])
    expect(service.activePathConnectionIds()).toEqual([
      "app-pod-leaf-compute",
      "leaf-compute-spine-2",
      "spine-2-leaf-services",
      "leaf-services-orders-service",
    ])
    expect(service.failoverState()).toBe("failover")
    expect(service.redundancySummary()).toBe("Alternate spine active")
    expect(service.failoverReason()).toContain("alternate spine path")
    expect(service.carrierSummary()).toContain("Fabric Amber")
  })

  it("starts the spine-failover preset on a degraded preferred path", () => {
    service.selectTopology("spine-failover")

    expect(service.sourceDeviceId()).toBe("web-pod")
    expect(service.destinationDeviceId()).toBe("payments-api")
    expect(service.activePathConnectionIds()).toEqual([
      "web-pod-leaf-apps",
      "leaf-apps-spine-east",
      "spine-east-leaf-api",
      "leaf-api-payments-api",
    ])
    expect(service.failoverState()).toBe("degraded")
    expect(service.redundancySummary()).toBe("Protected")
    expect(service.selectedDeviceId()).toBe("web-pod")
  })

  it("fails over to the west spine when the east spine goes offline", () => {
    service.selectTopology("spine-failover")
    service.selectDevice("spine-east")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.activePathConnectionIds()).toEqual([
      "web-pod-leaf-apps",
      "leaf-apps-spine-west",
      "spine-west-leaf-api",
      "leaf-api-payments-api",
    ])
    expect(service.failoverState()).toBe("failover")
    expect(service.carrierSummary()).toContain("Fabric West")
  })

  it("blocks the DCN route when both spines are offline", () => {
    service.selectTopology("spine-failover")
    service.selectDevice("spine-east")
    service.updateSelectedDevice({ status: "offline" })
    service.selectDevice("spine-west")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.failoverState()).toBe("blocked")
    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.failoverReason()).toBe(
      "No DCN path is currently available between the selected workload and service.",
    )
    expect(service.carrierSummary()).toBe("No DCN links active.")
  })

  it("updates DCN link telemetry when editing an existing fabric edge", () => {
    service.addOrUpdateDcnConnection({
      from: "leaf-compute",
      to: "spine-2",
      kind: "backup-uplink",
      strength: "weak",
      distanceKm: 3,
      latencyMs: 6,
      jitterMs: 3,
      packetLossPct: 0.4,
      throughputMBps: 7200,
      utilizationPct: 68,
      carrier: "Fabric Amber",
      costUsd: 800,
      priority: 3,
    })

    const updatedConnection = service
      .activeTopology()
      .connections.find((connection) => connection.id === "leaf-compute-spine-2")

    expect(updatedConnection?.kind).toBe("backup-uplink")
    expect(updatedConnection?.strength).toBe("weak")
    expect(updatedConnection?.latencyMs).toBe(6)
    expect(updatedConnection?.throughputMBps).toBe(7200)
    expect(updatedConnection?.utilizationPct).toBe(68)
  })

  it("reassigns DCN endpoints when the current source compute workload becomes offline", () => {
    service.selectDevice("app-pod")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.sourceDevices().map((device) => device.id)).toEqual(["batch-pod"])
    expect(service.endpointDevices().map((device) => device.id)).toEqual([
      "orders-service",
      "analytics-service",
    ])
    expect(service.sourceDeviceId()).toBe("batch-pod")
    expect(service.destinationDeviceId()).toBe("orders-service")
    expect(service.selectedDeviceId()).toBe("batch-pod")
    expect(service.activePathDeviceIds()).toEqual([
      "batch-pod",
      "leaf-compute",
      "spine-1",
      "leaf-services",
      "orders-service",
    ])
  })
})
