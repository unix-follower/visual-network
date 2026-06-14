import { TestBed } from "@angular/core/testing"

import { BcdrPageComponent } from "./bcdr-page.component"
import { BcdrStateService } from "./bcdr-state.service"

describe("BcdrPageComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BcdrPageComponent] }).compileComponents()
  })

  it("renders the BCDR workspace and enterprise metrics", async () => {
    const fixture = TestBed.createComponent(BcdrPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    expect(compiled.textContent).toContain("Phase 13")
    expect(compiled.textContent).toContain("Enterprise continuity presets")
    expect(compiled.textContent).toContain("Active Passive DR")
    expect(compiled.textContent).toContain("Enterprise sources")
    expect(compiled.textContent).toContain("Application sites")
    expect(compiled.textContent).toContain("Controllers")
    expect(compiled.textContent).toContain("Recovery strategy")
    expect(compiled.textContent).toContain("Accessible enterprise details")
  })

  it("lists sources, destinations, and recovery strategies in selectors", async () => {
    const fixture = TestBed.createComponent(BcdrPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const selects = routeControls?.querySelectorAll("select")
    const sourceOptions = [...(selects?.[0].querySelectorAll("option") ?? [])].map(
      (option) => option.textContent?.trim() ?? "",
    )
    const destinationOptions = [...(selects?.[1].querySelectorAll("option") ?? [])].map(
      (option) => option.textContent?.trim() ?? "",
    )
    const policyOptions = [...(selects?.[2].querySelectorAll("option") ?? [])].map(
      (option) => option.textContent?.trim() ?? "",
    )

    expect(sourceOptions).toEqual(["HQ User · enterprise-edge"])
    expect(destinationOptions).toEqual(["Primary ERP · East Region", "Recovery ERP · West Region"])
    expect(policyOptions).toEqual(["Protect primary", "Promote recovery"])
  })

  it("updates the active summary when switching to active-active failover", async () => {
    const fixture = TestBed.createComponent(BcdrPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const presetButtons = compiled.querySelectorAll(".preset-button")
    const failoverButton = presetButtons[1]

    if (!(failoverButton instanceof HTMLButtonElement)) {
      throw new TypeError("Expected active-active failover preset button to be rendered.")
    }

    failoverButton.click()
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Active Active Failover")
    expect(compiled.textContent).toContain("Promote recovery")
    expect(compiled.textContent).toContain("HQ User -> Recovery ERP")
    expect(compiled.textContent).toContain(
      "Continuity remains available, but replica lag or replay state increases recovery risk.",
    )
  })

  it("focuses the selected destination application in the details panel", async () => {
    const fixture = TestBed.createComponent(BcdrPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const destinationSelect = routeControls?.querySelectorAll("select").item(1)

    if (!(destinationSelect instanceof HTMLSelectElement)) {
      throw new TypeError("Expected BCDR destination selector to be rendered.")
    }

    destinationSelect.value = "recovery-erp"
    destinationSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Recovery ERP")
    expect(compiled.textContent).toContain(
      "Warm recovery application ready for continuity if the primary site is lost.",
    )
  })

  it("shows continuity guidance when no node is selected", async () => {
    const state = TestBed.inject(BcdrStateService)
    state.selectDevice(null)

    const fixture = TestBed.createComponent(BcdrPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    expect(compiled.textContent).toContain("Select a continuity node")
    expect(compiled.textContent).toContain(
      "Choose a user, gateway, application, controller, or vault node to inspect the active continuity context.",
    )
    expect(compiled.textContent).toContain(
      "Pointer: click an enterprise continuity node, drag to pan, wheel to zoom.",
    )
  })
})
