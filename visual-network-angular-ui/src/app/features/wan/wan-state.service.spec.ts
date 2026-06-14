import { TestBed } from "@angular/core/testing"

import { WanStateService } from "./wan-state.service"

describe("WanStateService", () => {
  let service: WanStateService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(WanStateService)
  })

  it("starts with the preferred primary WAN path for the default preset", () => {
    expect(service.sourceDeviceId()).toBe("branch-west")
    expect(service.destinationDeviceId()).toBe("hq-core")
    expect(service.activePathDeviceIds()).toEqual(["branch-west", "carrier-mpls", "hq-core"])
    expect(service.activePathConnectionIds()).toEqual([
      "branch-west-carrier-mpls",
      "carrier-mpls-hq-core",
    ])
    expect(service.failoverState()).toBe("primary")
    expect(service.activeLatencyMs()).toBe(42)
    expect(service.carrierSummary()).toBe("Carrier A")
  })

  it("marks the second preset path as degraded when a transit or site is degraded", () => {
    service.selectTopology("hybrid-service-mesh")

    expect(service.sourceDeviceId()).toBe("retail-east")
    expect(service.destinationDeviceId()).toBe("regional-hq")
    expect(service.activePathConnectionIds()).toEqual([
      "retail-east-carrier-regional",
      "carrier-regional-regional-hq",
    ])
    expect(service.failoverState()).toBe("degraded")
  })

  it("fails over to the backup WAN path when the primary carrier edge goes offline", () => {
    service.selectDevice("carrier-mpls")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.activePathDeviceIds()).toEqual(["branch-west", "carrier-internet", "hq-core"])
    expect(service.activePathConnectionIds()).toEqual([
      "branch-west-carrier-internet",
      "carrier-internet-hq-core",
    ])
    expect(service.failoverState()).toBe("failover")
    expect(service.activeLatencyMs()).toBe(74)
    expect(service.carrierSummary()).toBe("Carrier B")
  })

  it("keeps the downstream cloud service reachable over failover when the primary carrier edge goes offline", () => {
    service.selectDestinationDevice("cloud-erp")
    service.selectDevice("carrier-mpls")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.activePathDeviceIds()).toEqual([
      "branch-west",
      "carrier-internet",
      "hq-core",
      "data-hub",
      "cloud-erp",
    ])
    expect(service.activePathConnectionIds()).toEqual([
      "branch-west-carrier-internet",
      "carrier-internet-hq-core",
      "hq-core-data-hub",
      "data-hub-cloud-erp",
    ])
    expect(service.failoverState()).toBe("failover")
    expect(service.activeLatencyMs()).toBe(96)
    expect(service.activeBandwidthMbps()).toBe(300)
    expect(service.carrierSummary()).toBe("Carrier B, Metro Fiber, Cloud Fabric")
  })

  it("marks the WAN path as blocked when distinct endpoints have no remaining transport path", () => {
    service.selectDevice("carrier-mpls")
    service.updateSelectedDevice({ status: "offline" })
    service.selectDevice("carrier-internet")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.sourceDeviceId()).toBe("branch-west")
    expect(service.destinationDeviceId()).toBe("hq-core")
    expect(service.activePathDeviceIds()).toEqual(["branch-west"])
    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.failoverState()).toBe("blocked")
    expect(service.carrierSummary()).toBe("No WAN carriers active.")
  })

  it("keeps the WAN route local when source and destination are the same site", () => {
    service.selectDestinationDevice("branch-west")

    expect(service.sourceDeviceId()).toBe("branch-west")
    expect(service.destinationDeviceId()).toBe("branch-west")
    expect(service.activePathDeviceIds()).toEqual(["branch-west"])
    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.failoverState()).toBe("idle")
    expect(service.activeLatencyMs()).toBe(0)
    expect(service.activeCostUsd()).toBe(0)
  })

  it("updates WAN link telemetry when editing an existing path edge", () => {
    service.addOrUpdateWanConnection({
      from: "branch-west",
      to: "carrier-internet",
      kind: "backup-link",
      strength: "weak",
      latencyMs: 58,
      jitterMs: 16,
      packetLossPct: 1.4,
      bandwidthMbps: 220,
      carrier: "Carrier B",
      costUsd: 1500,
      priority: 3,
    })

    const updatedConnection = service
      .activeTopology()
      .connections.find((connection) => connection.id === "branch-west-carrier-internet")

    expect(updatedConnection).toBeDefined()
    expect(updatedConnection?.kind).toBe("backup-link")
    expect(updatedConnection?.strength).toBe("weak")
    expect(updatedConnection?.latencyMs).toBe(58)
    expect(updatedConnection?.bandwidthMbps).toBe(220)
    expect(updatedConnection?.costUsd).toBe(1500)
    expect(updatedConnection?.priority).toBe(3)
  })

  it("reassigns WAN endpoints when the current source site becomes offline", () => {
    service.selectDevice("branch-west")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.endpointDevices().map((device) => device.id)).toEqual([
      "hq-core",
      "data-hub",
      "cloud-erp",
    ])
    expect(service.sourceDeviceId()).toBe("hq-core")
    expect(service.destinationDeviceId()).toBe("data-hub")
    expect(service.activePathDeviceIds()).toEqual(["hq-core", "data-hub"])
  })
})
