import { TestBed } from "@angular/core/testing"

import { SanPageComponent } from "./san-page.component"
import { SanStateService } from "./san-state.service"

describe("SanPageComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SanPageComponent],
    }).compileComponents()
  })

  it("renders the SAN workspace and failover controls", async () => {
    const fixture = TestBed.createComponent(SanPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Phase 8")
    expect(compiled.textContent).toContain("SAN presets")
    expect(compiled.textContent).toContain("Primary Backup Storage")
    expect(compiled.textContent).toContain("Failover posture")
    expect(compiled.textContent).toContain("Storage controllers")
    expect(compiled.textContent).toContain("Replication")
    expect(compiled.textContent).toContain("Controller summary")
    expect(compiled.textContent).toContain("Storage Controller")
    expect(compiled.textContent).toContain("Automatic failover")
    expect(compiled.textContent).toContain("storage targets online")
    expect(compiled.textContent).toContain("Throughput")
    expect(compiled.textContent).toContain("Accessible SAN details")
  })

  it("lists SAN initiators as sources, arrays as destinations, and failover postures in the selector", async () => {
    const fixture = TestBed.createComponent(SanPageComponent)

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

    expect(sourceOptions).toEqual(["App Host · Cluster A", "Batch Host · Cluster B"])
    expect(destinationOptions).toContain("Primary Array · Row A")
    expect(destinationOptions).toContain("Backup Array · Row B")
    expect(policyOptions).toEqual(["Automatic failover"])
  })

  it("updates the active SAN summary when switching to the dual-fabric preset", async () => {
    const fixture = TestBed.createComponent(SanPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const presetButtons = compiled.querySelectorAll(".preset-button")
    const dualFabricButton = presetButtons[1] as HTMLButtonElement | undefined

    if (!dualFabricButton) {
      throw new Error("Expected dual-fabric SAN preset button to be rendered.")
    }

    dualFabricButton.click()
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Dual Fabric Storage")
    expect(compiled.textContent).toContain("Protected primary")
    expect(compiled.textContent).toContain("Analytics Host")
  })

  it("focuses the selected destination storage target in the SAN details panel", async () => {
    const fixture = TestBed.createComponent(SanPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const destinationSelect = routeControls?.querySelectorAll("select")?.[1] as
      | HTMLSelectElement
      | undefined

    if (!destinationSelect) {
      throw new Error("Expected SAN destination selector to be rendered.")
    }

    destinationSelect.value = "backup-array"
    destinationSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("App Host -> Backup Array")
    expect(compiled.textContent).toContain("Backup Array")
    expect(compiled.textContent).toContain(
      "Replicated backup storage target that takes over production traffic when the primary array is unavailable.",
    )
    expect(compiled.textContent).toContain("Roletarget")
  })

  it("re-focuses the SAN details panel when the selected source host is taken offline through the editor", async () => {
    const fixture = TestBed.createComponent(SanPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const editorSelects = compiled.querySelectorAll(".editor-grid select")
    const statusSelect = editorSelects[1] as HTMLSelectElement | undefined

    if (!statusSelect) {
      throw new Error("Expected SAN status editor selector to be rendered.")
    }

    statusSelect.value = "offline"
    statusSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Batch Host -> Primary Array")
    expect(compiled.textContent).toContain("Batch Host")
    expect(compiled.textContent).toContain(
      "Secondary initiator that can take over storage access if the primary application host is unavailable.",
    )
    expect(compiled.textContent).not.toContain(
      "Primary application host that prefers the low-latency storage fabric path to the main array.",
    )
  })

  it("shows endpoint-aware guidance when no SAN node is selected", async () => {
    const state = TestBed.inject(SanStateService)

    state.selectDevice(null)

    const fixture = TestBed.createComponent(SanPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Select a SAN node")
    expect(compiled.textContent).toContain(
      "Choose an initiator host, storage target, or click the canvas to inspect any controller, fabric, or array in the SAN topology.",
    )
    expect(compiled.textContent).toContain("Pointer: click a SAN node, drag to pan, wheel to zoom.")
  })
})
