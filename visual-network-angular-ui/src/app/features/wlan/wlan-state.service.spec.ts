import { TestBed } from "@angular/core/testing"

import { WlanStateService } from "./wlan-state.service"

describe("WlanStateService", () => {
  let service: WlanStateService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(WlanStateService)
  })

  it("starts with the strongest office access point selected for the default client", () => {
    expect(service.selectedClientId()).toBe("tablet-01")
    expect(service.activeAssociation().accessPointId).toBe("ap-studio")
    expect(service.activeAssociation().pathDeviceIds).toEqual([
      "tablet-01",
      "ap-studio",
      "wlc-office",
      "internet-edge",
    ])
    expect(service.signalSummary()).toBe("-52 dBm, 620 Mbps")
  })

  it("uses a manually preferred access point when one is selected", () => {
    service.selectPreferredAccessPoint("ap-lobby")

    expect(service.activeAssociation().accessPointId).toBe("ap-lobby")
    expect(service.activeAssociation().roamingState).toBe("candidate")
    expect(service.activeAssociation().pathConnectionIds[0]).toBe("tablet-01-ap-lobby")
  })

  it("resets client selection when switching topologies", () => {
    service.selectPreferredAccessPoint("ap-lobby")

    service.selectTopology("warehouse-coverage")

    expect(service.selectedClientId()).toBe("scanner-01")
    expect(service.preferredAccessPointId()).toBeNull()
    expect(service.activeAssociation().accessPointId).toBe("ap-dock")
    expect(service.signalSummary()).toBe("-55 dBm, 510 Mbps")
  })

  it("adds and updates WLAN connection telemetry for edited links", () => {
    service.selectTopology("warehouse-coverage")

    service.addOrUpdateWlanConnection({
      from: "scanner-01",
      to: "ap-dock",
      kind: "wireless-link",
      strength: "medium",
      rssi: -61,
      throughputMbps: 430,
    })

    const connection = service
      .activeTopology()
      .connections.find((item) => item.id === "ap-dock-scanner-01")

    expect(connection).toBeDefined()
    expect(connection?.kind).toBe("wireless-link")
    expect(connection?.strength).toBe("medium")
    expect(connection?.rssi).toBe(-61)
    expect(connection?.throughputMbps).toBe(430)

    service.addOrUpdateWlanConnection({
      from: "scanner-01",
      to: "ap-dock",
      kind: "wireless-link",
      strength: "strong",
      rssi: -48,
      throughputMbps: 590,
    })

    const updatedConnection = service
      .activeTopology()
      .connections.find((item) => item.id === "ap-dock-scanner-01")

    expect(updatedConnection).toBeDefined()
    expect(updatedConnection?.strength).toBe("strong")
    expect(updatedConnection?.rssi).toBe(-48)
    expect(updatedConnection?.throughputMbps).toBe(590)
  })
})
