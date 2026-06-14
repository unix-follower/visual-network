import { TestBed } from "@angular/core/testing"

import { NmoPageComponent } from "./nmo-page.component"
import { NmoStateService } from "./nmo-state.service"

describe("NmoPageComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NmoPageComponent] }).compileComponents()
  })

  it("renders the NMO workspace and automation metrics", async () => {
    const fixture = TestBed.createComponent(NmoPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    expect(compiled.textContent).toContain("Phase 12")
    expect(compiled.textContent).toContain("Automation presets")
    expect(compiled.textContent).toContain("Detect Only Failure")
    expect(compiled.textContent).toContain("Managed sources")
    expect(compiled.textContent).toContain("Service endpoints")
    expect(compiled.textContent).toContain("Controllers")
    expect(compiled.textContent).toContain("Automation policy")
    expect(compiled.textContent).toContain("Accessible orchestration details")
  })

  it("lists sources, destinations, and automation policies in selectors", async () => {
    const fixture = TestBed.createComponent(NmoPageComponent)
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

    expect(sourceOptions).toEqual(["Branch Agent · branch"])
    expect(destinationOptions).toEqual(["ERP Service · enterprise-service"])
    expect(policyOptions).toEqual(["Observe and hold"])
  })

  it("updates the active summary when switching to auto-failover", async () => {
    const fixture = TestBed.createComponent(NmoPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const presetButtons = compiled.querySelectorAll(".preset-button")
    const failoverButton = presetButtons[1]

    if (!(failoverButton instanceof HTMLButtonElement)) {
      throw new TypeError("Expected auto-failover preset button to be rendered.")
    }

    failoverButton.click()
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Auto Failover")
    expect(compiled.textContent).toContain("Auto remediate")
    expect(compiled.textContent).toContain("Branch Agent -> ERP Service")
    expect(compiled.textContent).toContain(
      "Automation detected the failure and promoted the backup path automatically.",
    )
  })

  it("focuses the selected destination service in the details panel", async () => {
    const fixture = TestBed.createComponent(NmoPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const destinationSelect = routeControls?.querySelectorAll("select").item(1)

    if (!(destinationSelect instanceof HTMLSelectElement)) {
      throw new TypeError("Expected NMO destination selector to be rendered.")
    }

    destinationSelect.value = "erp-service"
    destinationSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("ERP Service")
    expect(compiled.textContent).toContain(
      "Managed service endpoint reached through either the primary metro path or the backup gateway.",
    )
  })

  it("shows orchestration guidance when no node is selected", async () => {
    const state = TestBed.inject(NmoStateService)
    state.selectDevice(null)

    const fixture = TestBed.createComponent(NmoPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    expect(compiled.textContent).toContain("Select an automation node")
    expect(compiled.textContent).toContain(
      "Choose a managed node, controller, monitor, backup gateway, or service endpoint to inspect the active orchestration context.",
    )
    expect(compiled.textContent).toContain(
      "Pointer: click an orchestration node, drag to pan, wheel to zoom.",
    )
  })
})
