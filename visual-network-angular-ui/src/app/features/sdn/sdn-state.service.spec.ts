import { TestBed } from "@angular/core/testing"

import { SdnStateService } from "./sdn-state.service"

describe("SdnStateService", () => {
  let service: SdnStateService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(SdnStateService)
  })

  it("starts with the default latency policy and the private fabric path", () => {
    expect(service.sourceDeviceId()).toBe("branch-user")
    expect(service.destinationDeviceId()).toBe("app-cluster")
    expect(service.selectedPolicyId()).toBe("latency-optimized")
    expect(service.activePathDeviceIds()).toEqual([
      "branch-user",
      "private-edge",
      "fabric-core",
      "app-cluster",
    ])
    expect(service.activePathConnectionIds()).toEqual([
      "branch-user-private-edge",
      "private-edge-fabric-core",
      "fabric-core-app-cluster",
    ])
    expect(service.failoverState()).toBe("primary")
    expect(service.activeLatencyMs()).toBe(44)
    expect(service.controllerSummary()).toBe("Central Controller")
    expect(service.policySummary()).toBe("Latency optimized")
    expect(service.carrierSummary()).toBe("Private Fabric, East-West Fabric")
  })

  it("reroutes an application flow when the controller switches to the compliance policy", () => {
    service.selectPolicy("compliance-enforced")

    expect(service.activePathDeviceIds()).toEqual([
      "branch-user",
      "internet-edge",
      "fabric-core",
      "app-cluster",
    ])
    expect(service.activePathConnectionIds()).toEqual([
      "branch-user-internet-edge",
      "internet-edge-fabric-core",
      "fabric-core-app-cluster",
    ])
    expect(service.failoverState()).toBe("policy-override")
    expect(service.redundancySummary()).toBe("Intent enforced")
    expect(service.overrideReason()).toContain("inspected edge")
    expect(service.carrierSummary()).toBe("Inspected Edge, East-West Fabric")
  })

  it("starts the second preset on the resilience-first controller policy", () => {
    service.selectTopology("controller-resilience-reroute")

    expect(service.sourceDeviceId()).toBe("branch-west")
    expect(service.destinationDeviceId()).toBe("analytics-pod")
    expect(service.selectedPolicyId()).toBe("resilience-priority")
    expect(service.activePathConnectionIds()).toEqual([
      "branch-west-resilient-overlay",
      "resilient-overlay-branch-east",
      "branch-east-analytics-pod",
    ])
    expect(service.failoverState()).toBe("primary")
    expect(service.selectedDeviceId()).toBe("branch-west")
  })

  it("blocks the SDN route when both controller-approved uplinks are offline", () => {
    service.selectDevice("private-edge")
    service.updateSelectedDevice({ status: "offline" })
    service.selectDevice("internet-edge")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.failoverState()).toBe("blocked")
    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.overrideReason()).toBe("No controller-approved path is currently available.")
    expect(service.carrierSummary()).toBe("No SDN transports active.")
  })

  it("keeps the SDN route local when source and destination are the same site", () => {
    service.selectDestinationDevice("branch-user")

    expect(service.sourceDeviceId()).toBe("branch-user")
    expect(service.destinationDeviceId()).toBe("branch-user")
    expect(service.activePathDeviceIds()).toEqual(["branch-user"])
    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.failoverState()).toBe("idle")
    expect(service.redundancySummary()).toBe("Local route")
    expect(service.activeLatencyMs()).toBe(0)
    expect(service.activeCostUsd()).toBe(0)
  })

  it("updates SDN link telemetry when editing an existing path edge", () => {
    service.addOrUpdateSdnConnection({
      from: "branch-user",
      to: "internet-edge",
      kind: "backup-link",
      strength: "weak",
      distanceKm: 12,
      latencyMs: 12,
      jitterMs: 4,
      packetLossPct: 0.6,
      bandwidthMbps: 320,
      carrier: "Inspected Edge",
      costUsd: 1400,
      priority: 3,
      intents: ["compliance"],
    })

    const updatedConnection = service
      .activeTopology()
      .connections.find((connection) => connection.id === "branch-user-internet-edge")

    expect(updatedConnection?.kind).toBe("backup-link")
    expect(updatedConnection?.strength).toBe("weak")
    expect(updatedConnection?.latencyMs).toBe(12)
    expect(updatedConnection?.bandwidthMbps).toBe(320)
    expect(updatedConnection?.intents).toEqual(["compliance"])
  })

  it("reassigns SDN endpoints when the current source site becomes offline", () => {
    service.selectDevice("branch-user")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.sourceDevices().map((device) => device.id)).toEqual(["fabric-core"])
    expect(service.endpointDevices().map((device) => device.id)).toEqual([
      "fabric-core",
      "app-cluster",
      "audit-vault",
    ])
    expect(service.sourceDeviceId()).toBe("fabric-core")
    expect(service.destinationDeviceId()).toBe("app-cluster")
    expect(service.selectedDeviceId()).toBe("fabric-core")
    expect(service.activePathDeviceIds()).toEqual(["fabric-core", "app-cluster"])
  })
})
