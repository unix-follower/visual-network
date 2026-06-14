import { TestBed } from "@angular/core/testing"

import { BcdrStateService } from "./bcdr-state.service"

describe("BcdrStateService", () => {
  let service: BcdrStateService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(BcdrStateService)
  })

  it("starts with protected primary service in the active-passive preset", () => {
    expect(service.sourceDeviceId()).toBe("hq-user")
    expect(service.destinationDeviceId()).toBe("primary-erp")
    expect(service.activePathDeviceIds()).toEqual(["hq-user", "hq-gateway", "primary-erp"])
    expect(service.activePathConnectionIds()).toEqual([
      "hq-user-hq-gateway",
      "hq-gateway-primary-erp",
    ])
    expect(service.recoveryState()).toBe("protected")
    expect(service.primarySiteHealth()).toBe("healthy")
    expect(service.standbyReadiness()).toBe("Recovery ready")
    expect(service.syncSummary()).toBe("Replica synchronized")
  })

  it("starts the active-active preset on the promoted recovery path", () => {
    service.selectTopology("active-active-failover")

    expect(service.destinationDeviceId()).toBe("recovery-erp")
    expect(service.activePathDeviceIds()).toEqual(["hq-user", "hq-gateway", "recovery-erp"])
    expect(service.activePathConnectionIds()).toEqual([
      "hq-user-hq-gateway",
      "hq-gateway-recovery-erp",
    ])
    expect(service.recoveryState()).toBe("at-risk")
    expect(service.recoveryReason()).toBe("sync-lag-risk")
    expect(service.actionSummary()).toBe("Continuity risk elevated")
  })

  it("can switch from protected primary to promoted recovery strategy inside the baseline preset", () => {
    service.selectPolicy("promote-recovery")

    expect(service.destinationDeviceId()).toBe("recovery-erp")
    expect(service.activePathConnectionIds()).toEqual([
      "hq-user-hq-gateway",
      "hq-gateway-recovery-erp",
    ])
    expect(service.recoveryState()).toBe("failed-over")
    expect(service.recoveryReason()).toBe("recovery-promoted")
  })

  it("reassigns the source when the current enterprise client goes offline", () => {
    service.addDevice("enterprise-client")
    service.selectDevice("hq-user")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.sourceDevices().map((device) => device.id)).toContain("enterprise-client-7")
    expect(service.sourceDeviceId()).toBe("enterprise-client-7")
    expect(service.selectedDeviceId()).toBe("enterprise-client-7")
  })

  it("marks continuity as at risk when replication falls behind", () => {
    service.addOrUpdateBcdrConnection({
      from: "primary-erp",
      to: "recovery-erp",
      kind: "replication-link",
      strength: "medium",
      distanceKm: 26,
      latencyMs: 10,
      jitterMs: 3,
      packetLossPct: 0.6,
      throughputMBps: 3900,
      utilizationPct: 76,
      carrier: "Replica Fabric",
      costUsd: 520,
      priority: 1,
      health: "degraded",
      recoveryAction: "replay-log",
      policyId: "protect-primary",
      notes: "Replication lag exceeded the target.",
    })

    expect(service.recoveryState()).toBe("at-risk")
    expect(service.recoveryReason()).toBe("sync-lag-risk")
    expect(service.rpoSummary()).toContain("lagging or replaying replica state")
  })

  it("updates existing BCDR link telemetry", () => {
    service.addOrUpdateBcdrConnection({
      from: "hq-gateway",
      to: "recovery-erp",
      kind: "recovery-link",
      strength: "strong",
      distanceKm: 34,
      latencyMs: 12,
      jitterMs: 3,
      packetLossPct: 0.2,
      throughputMBps: 6100,
      utilizationPct: 43,
      carrier: "Recovery WAN",
      costUsd: 660,
      priority: 2,
      health: "healthy",
      recoveryAction: "standby-route",
      policyId: "protect-primary",
      notes: "Recovery WAN capacity was updated.",
    })

    const updatedConnection = service
      .activeTopology()
      .connections.find((connection) => connection.id === "hq-gateway-recovery-erp")

    expect(updatedConnection?.latencyMs).toBe(12)
    expect(updatedConnection?.throughputMBps).toBe(6100)
    expect(updatedConnection?.utilizationPct).toBe(43)
    expect(updatedConnection?.strength).toBe("strong")
  })

  it("blocks continuity when no recovery route is available during promotion", () => {
    service.selectTopology("active-active-failover")
    service.addOrUpdateBcdrConnection({
      from: "hq-gateway",
      to: "recovery-erp",
      kind: "recovery-link",
      strength: "weak",
      distanceKm: 34,
      latencyMs: 0,
      jitterMs: 0,
      packetLossPct: 100,
      throughputMBps: 0,
      utilizationPct: 0,
      carrier: "Recovery WAN",
      costUsd: 620,
      priority: 1,
      health: "failed",
      recoveryAction: "recovery-down",
      policyId: "promote-recovery",
      notes: "Recovery WAN is unavailable.",
    })

    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.recoveryState()).toBe("blocked")
    expect(service.recoveryReason()).toBe("no-recovery-path")
  })
})
