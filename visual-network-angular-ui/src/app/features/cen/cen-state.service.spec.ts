import { TestBed } from "@angular/core/testing"

import { CenStateService } from "./cen-state.service"

describe("CenStateService", () => {
  let service: CenStateService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(CenStateService)
  })

  it("starts with the preferred nearest-region path for the default preset", () => {
    expect(service.sourceDeviceId()).toBe("storefront-edge")
    expect(service.destinationDeviceId()).toBe("orders-api")
    expect(service.activePathDeviceIds()).toEqual([
      "storefront-edge",
      "branch-gateway",
      "onramp-east",
      "cloud-east",
      "orders-api",
    ])
    expect(service.activePathConnectionIds()).toEqual([
      "storefront-edge-branch-gateway",
      "branch-gateway-onramp-east",
      "onramp-east-cloud-east",
      "cloud-east-orders-api",
    ])
    expect(service.failoverState()).toBe("primary")
    expect(service.activeLatencyMs()).toBe(13)
    expect(service.activeThroughputMBps()).toBe(8500)
    expect(service.redundancySummary()).toBe("Protected")
    expect(service.controllerSummary()).toBe("On-ramp East, On-ramp West")
    expect(service.replicationSummary()).toBe("Alternate region available")
    expect(service.carrierSummary()).toContain("Cloud Backbone East")
  })

  it("fails over to the alternate region when the preferred on-ramp goes offline", () => {
    service.selectDevice("onramp-east")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.activePathDeviceIds()).toEqual([
      "storefront-edge",
      "branch-gateway",
      "onramp-west",
      "cloud-west",
      "orders-api",
    ])
    expect(service.activePathConnectionIds()).toEqual([
      "storefront-edge-branch-gateway",
      "branch-gateway-onramp-west",
      "onramp-west-cloud-west",
      "cloud-west-orders-api",
    ])
    expect(service.failoverState()).toBe("failover")
    expect(service.redundancySummary()).toBe("Alternate region active")
    expect(service.failoverReason()).toContain("alternate region path")
    expect(service.carrierSummary()).toContain("Cloud Backbone West")
  })

  it("starts the regional-failover preset on a degraded preferred path", () => {
    service.selectTopology("regional-failover")

    expect(service.sourceDeviceId()).toBe("kiosk-edge")
    expect(service.destinationDeviceId()).toBe("session-api")
    expect(service.activePathConnectionIds()).toEqual([
      "kiosk-edge-retail-gateway",
      "retail-gateway-onramp-primary",
      "onramp-primary-cloud-central",
      "cloud-central-session-api",
    ])
    expect(service.failoverState()).toBe("degraded")
    expect(service.redundancySummary()).toBe("Protected")
    expect(service.selectedDeviceId()).toBe("kiosk-edge")
  })

  it("fails over to the recovery region when the primary on-ramp goes offline", () => {
    service.selectTopology("regional-failover")
    service.selectDevice("onramp-primary")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.activePathConnectionIds()).toEqual([
      "kiosk-edge-retail-gateway",
      "retail-gateway-onramp-secondary",
      "onramp-secondary-cloud-recovery",
      "cloud-recovery-session-api",
    ])
    expect(service.failoverState()).toBe("failover")
    expect(service.carrierSummary()).toContain("Cloud Core Recovery")
  })

  it("blocks the cloud route when both on-ramps are offline", () => {
    service.selectTopology("regional-failover")
    service.selectDevice("onramp-primary")
    service.updateSelectedDevice({ status: "offline" })
    service.selectDevice("onramp-secondary")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.failoverState()).toBe("blocked")
    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.failoverReason()).toBe(
      "No cloud path is currently available between the selected edge workload and service.",
    )
    expect(service.carrierSummary()).toBe("No cloud links active.")
  })

  it("updates CEN link telemetry when editing an existing cloud path edge", () => {
    service.addOrUpdateCenConnection({
      from: "branch-gateway",
      to: "onramp-west",
      kind: "edge-uplink",
      strength: "weak",
      distanceKm: 21,
      latencyMs: 9,
      jitterMs: 3,
      packetLossPct: 0.4,
      throughputMBps: 5500,
      utilizationPct: 68,
      carrier: "Internet Edge",
      costUsd: 800,
      priority: 3,
    })

    const updatedConnection = service
      .activeTopology()
      .connections.find((connection) => connection.id === "branch-gateway-onramp-west")

    expect(updatedConnection?.kind).toBe("edge-uplink")
    expect(updatedConnection?.strength).toBe("weak")
    expect(updatedConnection?.latencyMs).toBe(9)
    expect(updatedConnection?.throughputMBps).toBe(5500)
    expect(updatedConnection?.utilizationPct).toBe(68)
  })

  it("reassigns CEN endpoints when the current source edge workload becomes offline", () => {
    service.selectDevice("storefront-edge")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.sourceDevices().map((device) => device.id)).toEqual(["telemetry-edge"])
    expect(service.endpointDevices().map((device) => device.id)).toEqual([
      "orders-api",
      "analytics-api",
    ])
    expect(service.sourceDeviceId()).toBe("telemetry-edge")
    expect(service.destinationDeviceId()).toBe("orders-api")
    expect(service.selectedDeviceId()).toBe("telemetry-edge")
    expect(service.activePathDeviceIds()).toEqual([
      "telemetry-edge",
      "branch-gateway",
      "onramp-east",
      "cloud-east",
      "orders-api",
    ])
  })
})
