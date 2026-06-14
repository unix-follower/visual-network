import { TestBed } from "@angular/core/testing"

import { NmoStateService } from "./nmo-state.service"

describe("NmoStateService", () => {
  let service: NmoStateService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(NmoStateService)
  })

  it("starts on the degraded primary path for the detect-only preset", () => {
    expect(service.sourceDeviceId()).toBe("branch-agent")
    expect(service.destinationDeviceId()).toBe("erp-service")
    expect(service.activePathDeviceIds()).toEqual(["branch-agent", "metro-core", "erp-service"])
    expect(service.activePathConnectionIds()).toEqual([
      "branch-agent-metro-core",
      "metro-core-erp-service",
    ])
    expect(service.remediationState()).toBe("detected")
    expect(service.primaryPathHealth()).toBe("degraded")
    expect(service.actionSummary()).toBe("Alert only")
    expect(service.backupReadiness()).toBe("Standby ready")
  })

  it("switches to the backup path for the auto-failover preset", () => {
    service.selectTopology("auto-failover")

    expect(service.activePathDeviceIds()).toEqual(["branch-agent", "backup-gateway", "erp-service"])
    expect(service.activePathConnectionIds()).toEqual([
      "branch-agent-backup-gateway",
      "backup-gateway-erp-service",
    ])
    expect(service.remediationState()).toBe("failed-over")
    expect(service.remediationReason()).toBe("auto-reroute")
    expect(service.actionSummary()).toBe("Backup path activated")
  })

  it("keeps the detect-only preset on the primary route even when a healthy backup exists", () => {
    expect(service.activePathConnectionIds()).toContain("branch-agent-metro-core")
    expect(service.activePathConnectionIds()).not.toContain("branch-agent-backup-gateway")
    expect(service.remediationReason()).toBe("policy-hold")
    expect(service.remediationSummary()).toContain("detect-only policy")
  })

  it("reassigns the source when the current managed node goes offline", () => {
    service.addDevice("managed-node")
    service.selectDevice("branch-agent")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.sourceDevices().map((device) => device.id)).toContain("managed-node-7")
    expect(service.sourceDeviceId()).toBe("managed-node-7")
    expect(service.selectedDeviceId()).toBe("managed-node-7")
  })

  it("blocks detect-only traffic when the degraded primary route fully fails", () => {
    service.addOrUpdateNmoConnection({
      from: "branch-agent",
      to: "metro-core",
      kind: "primary-link",
      strength: "weak",
      distanceKm: 6,
      latencyMs: 0,
      jitterMs: 0,
      packetLossPct: 100,
      throughputMBps: 0,
      utilizationPct: 0,
      carrier: "Metro Ethernet",
      costUsd: 340,
      priority: 1,
      health: "failed",
      remediationAction: "declare-failure",
      policyId: "observe-and-hold",
      notes: "Primary edge handoff is now down.",
    })

    expect(service.remediationState()).toBe("blocked")
    expect(service.remediationReason()).toBe("monitor-alert")
    expect(service.activePathConnectionIds()).toEqual([])
  })

  it("updates existing NMO link telemetry", () => {
    service.addOrUpdateNmoConnection({
      from: "branch-agent",
      to: "backup-gateway",
      kind: "backup-link",
      strength: "medium",
      distanceKm: 15,
      latencyMs: 7,
      jitterMs: 2,
      packetLossPct: 0.2,
      throughputMBps: 6400,
      utilizationPct: 48,
      carrier: "Backup MPLS",
      costUsd: 650,
      priority: 2,
      health: "healthy",
      remediationAction: "activate-backup",
      policyId: "observe-and-hold",
      notes: "Backup ingress capacity was updated.",
    })

    const updatedConnection = service
      .activeTopology()
      .connections.find((connection) => connection.id === "branch-agent-backup-gateway")

    expect(updatedConnection?.latencyMs).toBe(7)
    expect(updatedConnection?.throughputMBps).toBe(6400)
    expect(updatedConnection?.utilizationPct).toBe(48)
    expect(updatedConnection?.strength).toBe("medium")
  })

  it("can switch policies inside the active topology when multiple options exist", () => {
    service.selectTopology("detect-only-failure")
    service.activeTopology().policies.push({
      id: "temporary-auto",
      label: "Temporary auto",
      summary: "Emergency failover override.",
      mode: "auto-failover",
      priority: 2,
    })

    service.selectPolicy("temporary-auto")

    expect(service.selectedPolicyId()).toBe("temporary-auto")
    expect(service.ruleSummary()).toBe("Temporary auto")
  })
})
