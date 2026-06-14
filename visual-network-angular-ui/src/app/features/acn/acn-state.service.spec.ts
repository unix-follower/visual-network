import { TestBed } from "@angular/core/testing"

import { AcnStateService } from "./acn-state.service"

describe("AcnStateService", () => {
  let service: AcnStateService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(AcnStateService)
  })

  it("starts with the allowed CRM path for the default preset", () => {
    expect(service.sourceDeviceId()).toBe("branch-laptop")
    expect(service.destinationDeviceId()).toBe("crm-service")
    expect(service.activePathDeviceIds()).toEqual([
      "branch-laptop",
      "branch-firewall",
      "crm-service",
    ])
    expect(service.activePathConnectionIds()).toEqual([
      "branch-laptop-branch-firewall",
      "branch-firewall-crm-service",
    ])
    expect(service.failoverState()).toBe("allowed")
    expect(service.activeLatencyMs()).toBe(6)
    expect(service.activeThroughputMBps()).toBe(7800)
    expect(service.ruleSummary()).toBe("Allow business CRM")
    expect(service.protectionSummary()).toBe("Explicit allow")
  })

  it("surfaces a policy violation when the blocked payroll service is selected", () => {
    service.selectDestinationDevice("payroll-service")

    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.failoverState()).toBe("policy-violation")
    expect(service.violationReason()).toBe("explicit-block")
    expect(service.overrideReason()).toContain("explicit block rule")
  })

  it("starts the inspection-required preset on an inspected path", () => {
    service.selectTopology("inspection-required")

    expect(service.sourceDeviceId()).toBe("finance-workstation")
    expect(service.destinationDeviceId()).toBe("finance-app")
    expect(service.activePathConnectionIds()).toEqual([
      "finance-workstation-inspection-firewall",
      "inspection-firewall-inspection-proxy",
      "inspection-proxy-finance-app",
    ])
    expect(service.failoverState()).toBe("inspected")
    expect(service.protectionSummary()).toBe("Inspection required")
    expect(service.ruleSummary()).toBe("Inspect finance app")
  })

  it("reassigns the source when the current source host goes offline", () => {
    service.selectTopology("inspection-required")
    service.selectDevice("finance-workstation")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.sourceDeviceId()).toBe("backup-workstation")
    expect(service.selectedDeviceId()).toBe("backup-workstation")
    expect(service.activePathDeviceIds()).toEqual([
      "backup-workstation",
      "inspection-firewall",
      "inspection-proxy",
      "finance-app",
    ])
  })

  it("blocks the route when the enforcement device is offline", () => {
    service.selectDevice("branch-firewall")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.failoverState()).toBe("blocked")
    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.overrideReason()).toBe(
      "No allowed security path is currently available between the selected source and service.",
    )
  })

  it("updates existing ACN link telemetry", () => {
    service.addOrUpdateAcnConnection({
      from: "branch-firewall",
      to: "crm-service",
      kind: "allowed-link",
      strength: "medium",
      distanceKm: 21,
      latencyMs: 7,
      jitterMs: 2,
      packetLossPct: 0.2,
      throughputMBps: 6500,
      utilizationPct: 61,
      carrier: "Policy Backbone",
      costUsd: 610,
      priority: 2,
      action: "allow",
      ruleId: "allow-business-crm",
      sourceZone: "inspection",
      destinationZone: "business",
    })

    const updatedConnection = service
      .activeTopology()
      .connections.find((connection) => connection.id === "branch-firewall-crm-service")

    expect(updatedConnection?.latencyMs).toBe(7)
    expect(updatedConnection?.throughputMBps).toBe(6500)
    expect(updatedConnection?.utilizationPct).toBe(61)
    expect(updatedConnection?.strength).toBe("medium")
  })

  it("flags zone mismatch when the policy does not match the selected destination", () => {
    service.selectTopology("inspection-required")
    service.selectDestinationDevice("admin-console")

    expect(service.failoverState()).toBe("policy-violation")
    expect(service.violationReason()).toBe("zone-mismatch")
    expect(service.protectionSummary()).toContain("selected source and destination zones")
  })
})
