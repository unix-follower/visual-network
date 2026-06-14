import { TestBed } from "@angular/core/testing"

import { DcnPageComponent } from "./dcn-page.component"
import { DcnStateService } from "./dcn-state.service"

describe("DcnPageComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DcnPageComponent],
    }).compileComponents()
  })

  it("renders the DCN workspace and leaf-spine metrics", async () => {
    const fixture = TestBed.createComponent(DcnPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Phase 9")
    expect(compiled.textContent).toContain("DCN presets")
    expect(compiled.textContent).toContain("Leaf-Spine Redundancy")
    expect(compiled.textContent).toContain("Compute nodes")
    expect(compiled.textContent).toContain("Service nodes")
    expect(compiled.textContent).toContain("Spine switches")
    expect(compiled.textContent).toContain("Peak utilization")
    expect(compiled.textContent).toContain("Spine summary")
    expect(compiled.textContent).toContain("Spine 1, Spine 2")
    expect(compiled.textContent).toContain("Alternate spine available")
    expect(compiled.textContent).toContain("Accessible DCN details")
  })

  it("lists compute workloads as sources, services as destinations, and the DCN fabric preference in the selector", async () => {
    const fixture = TestBed.createComponent(DcnPageComponent)

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

    expect(sourceOptions).toEqual(["App Pod · Compute Row A", "Batch Pod · Compute Row A"])
    expect(destinationOptions).toContain("Orders Service · Services Row")
    expect(destinationOptions).toContain("Analytics Service · Services Row")
    expect(policyOptions).toEqual(["Preferred spine path"])
  })

  it("updates the active DCN summary when switching to the spine-failover preset", async () => {
    const fixture = TestBed.createComponent(DcnPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const presetButtons = compiled.querySelectorAll(".preset-button")
    const failoverButton = presetButtons[1] as HTMLButtonElement | undefined

    if (!failoverButton) {
      throw new Error("Expected spine-failover DCN preset button to be rendered.")
    }

    failoverButton.click()
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Spine Failover")
    expect(compiled.textContent).toContain("Protect service reachability")
    expect(compiled.textContent).toContain("Web Pod -> Payments API")
    expect(compiled.textContent).toContain(
      "The preferred spine path is still active, but one fabric segment or device is degraded.",
    )
  })

  it("focuses the selected destination service in the DCN details panel", async () => {
    const fixture = TestBed.createComponent(DcnPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const destinationSelect = routeControls?.querySelectorAll("select").item(1)

    if (!(destinationSelect instanceof HTMLSelectElement)) {
      throw new TypeError("Expected DCN destination selector to be rendered.")
    }

    destinationSelect.value = "analytics-service"
    destinationSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("App Pod -> Analytics Service")
    expect(compiled.textContent).toContain("Analytics Service")
    expect(compiled.textContent).toContain(
      "Secondary shared service that uses the same service leaf while keeping the dual-spine fabric intact.",
    )
    expect(compiled.textContent).toContain("Roleservice")
  })

  it("re-focuses the DCN details panel when the selected compute workload is taken offline through the editor", async () => {
    const fixture = TestBed.createComponent(DcnPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const editorSelects = compiled.querySelectorAll(".editor-grid select")
    const statusSelect = editorSelects[1] as HTMLSelectElement | undefined

    if (!statusSelect) {
      throw new Error("Expected DCN status editor selector to be rendered.")
    }

    statusSelect.value = "offline"
    statusSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Batch Pod -> Orders Service")
    expect(compiled.textContent).toContain("Batch Pod")
    expect(compiled.textContent).toContain(
      "Secondary compute workload that can continue reaching shared services if the primary workload goes offline.",
    )
    expect(compiled.textContent).not.toContain(
      "Application workload that uses the leaf-spine fabric to reach shared services with predictable latency.",
    )
  })

  it("shows endpoint-aware guidance when no DCN node is selected", async () => {
    const state = TestBed.inject(DcnStateService)

    state.selectDevice(null)

    const fixture = TestBed.createComponent(DcnPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Select a DCN node")
    expect(compiled.textContent).toContain(
      "Choose a compute node, service node, or click the canvas to inspect any leaf or spine in the DCN topology.",
    )
    expect(compiled.textContent).toContain("Pointer: click a DCN node, drag to pan, wheel to zoom.")
  })
})
