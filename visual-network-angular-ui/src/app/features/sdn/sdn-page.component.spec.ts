import { TestBed } from "@angular/core/testing"

import { SdnPageComponent } from "./sdn-page.component"
import { SdnStateService } from "./sdn-state.service"

describe("SdnPageComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SdnPageComponent],
    }).compileComponents()
  })

  it("renders the SDN workspace and controller policy controls", async () => {
    const fixture = TestBed.createComponent(SdnPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Phase 7")
    expect(compiled.textContent).toContain("SDN presets")
    expect(compiled.textContent).toContain("Controller Path Override")
    expect(compiled.textContent).toContain("Controller policy")
    expect(compiled.textContent).toContain("Controllers")
    expect(compiled.textContent).toContain("Policy")
    expect(compiled.textContent).toContain("Controller summary")
    expect(compiled.textContent).toContain("Central Controller")
    expect(compiled.textContent).toContain("Latency optimized")
    expect(compiled.textContent).toContain("application services visible")
    expect(compiled.textContent).toContain("Transport")
    expect(compiled.textContent).toContain("Accessible SDN details")
  })

  it("lists SDN site devices as sources, services as destinations, and controller policies in the selector", async () => {
    const fixture = TestBed.createComponent(SdnPageComponent)

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

    expect(sourceOptions).toEqual(["Branch User Edge · Campus West", "Fabric Core · Campus East"])
    expect(destinationOptions).toContain("App Cluster · Services")
    expect(destinationOptions).toContain("Audit Vault · Services")
    expect(policyOptions).toEqual([
      "Latency optimized",
      "Compliance enforced",
      "Resilience priority",
    ])
  })

  it("updates the active SDN path when the controller policy changes", async () => {
    const fixture = TestBed.createComponent(SdnPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const policySelect = routeControls?.querySelectorAll("select")?.[2] as
      | HTMLSelectElement
      | undefined

    if (!policySelect) {
      throw new Error("Expected SDN policy selector to be rendered.")
    }

    policySelect.value = "compliance-enforced"
    policySelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Compliance enforced")
    expect(compiled.textContent).toContain("policy-override")
    expect(compiled.textContent).toContain("Intent enforced")
    expect(compiled.textContent).toContain("Inspected Internet Edge")
    expect(compiled.textContent).toContain("inspected edge")
  })

  it("focuses the selected destination endpoint in the SDN details panel", async () => {
    const fixture = TestBed.createComponent(SdnPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const destinationSelect = routeControls?.querySelectorAll("select")?.[1] as
      | HTMLSelectElement
      | undefined

    if (!destinationSelect) {
      throw new Error("Expected SDN destination selector to be rendered.")
    }

    destinationSelect.value = "audit-vault"
    destinationSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Branch User Edge -> Audit Vault")
    expect(compiled.textContent).toContain("Audit Vault")
    expect(compiled.textContent).toContain(
      "Compliance-sensitive service that demonstrates controller steering through an inspected path.",
    )
    expect(compiled.textContent).toContain("Roleservice")
  })

  it("re-focuses the SDN details panel when the selected source node is taken offline through the editor", async () => {
    const fixture = TestBed.createComponent(SdnPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const editorSelects = compiled.querySelectorAll(".editor-grid select")
    const statusSelect = editorSelects[1] as HTMLSelectElement | undefined

    if (!statusSelect) {
      throw new Error("Expected SDN status editor selector to be rendered.")
    }

    statusSelect.value = "offline"
    statusSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Fabric Core -> App Cluster")
    expect(compiled.textContent).toContain("Fabric Core")
    expect(compiled.textContent).toContain(
      "Policy-enforced fabric switch that receives controller decisions and forwards traffic toward shared services.",
    )
    expect(compiled.textContent).not.toContain(
      "User-facing edge switch whose flow can be steered by the SDN controller across multiple transport intents.",
    )
  })

  it("shows endpoint-aware guidance when no SDN node is selected", async () => {
    const state = TestBed.inject(SdnStateService)

    state.selectDevice(null)

    const fixture = TestBed.createComponent(SdnPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Select an SDN node")
    expect(compiled.textContent).toContain(
      "Choose a source edge, destination endpoint, or click the canvas to inspect any controller, fabric, or service node.",
    )
    expect(compiled.textContent).toContain(
      "Pointer: click an SDN node, drag to pan, wheel to zoom.",
    )
  })
})
