import { TestBed } from "@angular/core/testing"

import { AcnPageComponent } from "./acn-page.component"
import { AcnStateService } from "./acn-state.service"

describe("AcnPageComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AcnPageComponent] }).compileComponents()
  })

  it("renders the ACN workspace and security metrics", async () => {
    const fixture = TestBed.createComponent(AcnPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    expect(compiled.textContent).toContain("Phase 11")
    expect(compiled.textContent).toContain("Security presets")
    expect(compiled.textContent).toContain("Default Deny With Exception")
    expect(compiled.textContent).toContain("Source hosts")
    expect(compiled.textContent).toContain("Protected services")
    expect(compiled.textContent).toContain("Enforcement points")
    expect(compiled.textContent).toContain("Matched rule")
    expect(compiled.textContent).toContain("Explicit allow")
    expect(compiled.textContent).toContain("Accessible security details")
  })

  it("lists sources, destinations, and policy options in selectors", async () => {
    const fixture = TestBed.createComponent(AcnPageComponent)
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

    expect(sourceOptions).toEqual(["Branch Laptop · user", "Guest Tablet · guest"])
    expect(destinationOptions).toContain("CRM Service · business")
    expect(destinationOptions).toContain("Payroll Service · restricted")
    expect(policyOptions).toEqual(["Allow business CRM", "Deny payroll access"])
  })

  it("updates the active summary when switching to inspection-required", async () => {
    const fixture = TestBed.createComponent(AcnPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const presetButtons = compiled.querySelectorAll(".preset-button")
    const inspectionButton = presetButtons[1]

    if (!(inspectionButton instanceof HTMLButtonElement)) {
      throw new TypeError("Expected inspection-required preset button to be rendered.")
    }

    inspectionButton.click()
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Inspection Required")
    expect(compiled.textContent).toContain("Inspect finance app")
    expect(compiled.textContent).toContain("Finance Workstation -> Finance App")
    expect(compiled.textContent).toContain(
      "Traffic is permitted, but it must traverse the inspection chain before reaching the service.",
    )
  })

  it("focuses the selected destination service in the details panel", async () => {
    const fixture = TestBed.createComponent(AcnPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const destinationSelect = routeControls?.querySelectorAll("select").item(1)

    if (!(destinationSelect instanceof HTMLSelectElement)) {
      throw new TypeError("Expected ACN destination selector to be rendered.")
    }

    destinationSelect.value = "payroll-service"
    destinationSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Branch Laptop -> Payroll Service")
    expect(compiled.textContent).toContain("Payroll Service")
    expect(compiled.textContent).toContain(
      "Restricted application that demonstrates explicit policy denial for unauthorized zones.",
    )
  })

  it("shows security guidance when no node is selected", async () => {
    const state = TestBed.inject(AcnStateService)
    state.selectDevice(null)

    const fixture = TestBed.createComponent(AcnPageComponent)
    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    expect(compiled.textContent).toContain("Select a security node")
    expect(compiled.textContent).toContain(
      "Choose a source host, firewall, or service node to inspect the active policy context.",
    )
    expect(compiled.textContent).toContain(
      "Pointer: click a security node, drag to pan, wheel to zoom.",
    )
  })
})
