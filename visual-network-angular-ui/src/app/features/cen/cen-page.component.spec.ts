import { TestBed } from "@angular/core/testing"

import { CenPageComponent } from "./cen-page.component"
import { CenStateService } from "./cen-state.service"

describe("CenPageComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CenPageComponent],
    }).compileComponents()
  })

  it("renders the CEN workspace and region metrics", async () => {
    const fixture = TestBed.createComponent(CenPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Phase 10")
    expect(compiled.textContent).toContain("CEN presets")
    expect(compiled.textContent).toContain("Nearest Region Preference")
    expect(compiled.textContent).toContain("Edge sites")
    expect(compiled.textContent).toContain("Cloud services")
    expect(compiled.textContent).toContain("Cloud regions")
    expect(compiled.textContent).toContain("Peak utilization")
    expect(compiled.textContent).toContain("Region summary")
    expect(compiled.textContent).toContain("On-ramp East, On-ramp West")
    expect(compiled.textContent).toContain("Alternate region available")
    expect(compiled.textContent).toContain("Accessible cloud and edge details")
  })

  it("lists edge workloads, service endpoints, and the routing policy in the selector", async () => {
    const fixture = TestBed.createComponent(CenPageComponent)

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

    expect(sourceOptions).toEqual([
      "Storefront Edge · Storefront Floor",
      "Telemetry Edge · Storefront Floor",
    ])
    expect(destinationOptions).toContain("Orders API · Application Layer")
    expect(destinationOptions).toContain("Analytics API · Application Layer")
    expect(policyOptions).toEqual(["Prefer nearest region"])
  })

  it("updates the active CEN summary when switching to the regional-failover preset", async () => {
    const fixture = TestBed.createComponent(CenPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const presetButtons = compiled.querySelectorAll(".preset-button")
    const failoverButton = presetButtons[1]

    if (!(failoverButton instanceof HTMLButtonElement)) {
      throw new TypeError("Expected regional-failover CEN preset button to be rendered.")
    }

    failoverButton.click()
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Regional Failover")
    expect(compiled.textContent).toContain("Preserve service continuity")
    expect(compiled.textContent).toContain("Kiosk Edge -> Session API")
    expect(compiled.textContent).toContain(
      "The preferred cloud path is still active, but one edge or region segment is degraded.",
    )
  })

  it("focuses the selected destination service endpoint in the CEN details panel", async () => {
    const fixture = TestBed.createComponent(CenPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const destinationSelect = routeControls?.querySelectorAll("select").item(1)

    if (!(destinationSelect instanceof HTMLSelectElement)) {
      throw new TypeError("Expected CEN destination selector to be rendered.")
    }

    destinationSelect.value = "analytics-api"
    destinationSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Storefront Edge -> Analytics API")
    expect(compiled.textContent).toContain("Analytics API")
    expect(compiled.textContent).toContain(
      "Secondary cloud analytics endpoint that shares the same cloud path options while targeting a different application service.",
    )
  })

  it("shows endpoint-aware guidance when no CEN node is selected", async () => {
    const state = TestBed.inject(CenStateService)

    state.selectDevice(null)

    const fixture = TestBed.createComponent(CenPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Select a CEN node")
    expect(compiled.textContent).toContain(
      "Choose an edge workload, service endpoint, or click the canvas to inspect any cloud and edge node in the topology.",
    )
    expect(compiled.textContent).toContain("Pointer: click a CEN node, drag to pan, wheel to zoom.")
  })
})
