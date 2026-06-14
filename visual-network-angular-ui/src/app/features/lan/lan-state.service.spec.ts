import { TestBed } from "@angular/core/testing"

import { LanStateService } from "./lan-state.service"

describe("LanStateService", () => {
  let service: LanStateService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(LanStateService)
  })

  it("adds a LAN device and selects it", () => {
    const initialCount = service.activeTopology().devices.length

    service.addDevice("switch")

    expect(service.activeTopology().devices).toHaveLength(initialCount + 1)
    expect(service.selectedDevice()?.kind).toBe("switch")
    expect(service.selectedDevice()?.label).toContain("Switch")
  })

  it("updates the selected device metadata", () => {
    service.selectDevice("branch-workstation-b")

    service.updateSelectedDevice({
      label: "Front Desk PC",
      status: "online",
      detail: "Recovered after the access port was reset.",
    })

    expect(service.selectedDevice()).toMatchObject({
      id: "branch-workstation-b",
      label: "Front Desk PC",
      status: "online",
      detail: "Recovered after the access port was reset.",
    })
  })

  it("adds and updates a LAN connection without duplicating it", () => {
    const initialCount = service.activeTopology().connections.length

    service.selectDevice("branch-ap")
    service.addOrUpdateConnection({
      from: "branch-ap",
      to: "branch-printer",
      kind: "wireless",
      strength: "medium",
    })

    expect(service.activeTopology().connections).toHaveLength(initialCount + 1)

    service.addOrUpdateConnection({
      from: "branch-printer",
      to: "branch-ap",
      kind: "wireless",
      strength: "strong",
    })

    const connection = service
      .activeTopology()
      .connections.find(
        (item) =>
          (item.from === "branch-ap" && item.to === "branch-printer") ||
          (item.from === "branch-printer" && item.to === "branch-ap"),
      )

    expect(service.activeTopology().connections).toHaveLength(initialCount + 1)
    expect(connection).toMatchObject({ kind: "wireless", strength: "strong" })
  })

  it("removes the selected device and its dependent connections", () => {
    service.selectDevice("branch-switch")

    service.removeSelectedDevice()

    expect(service.activeTopology().devices.some((device) => device.id === "branch-switch")).toBe(
      false,
    )
    expect(
      service
        .activeTopology()
        .connections.some(
          (connection) => connection.from === "branch-switch" || connection.to === "branch-switch",
        ),
    ).toBe(false)
    expect(service.selectedDeviceId()).not.toBe("branch-switch")
  })
})
