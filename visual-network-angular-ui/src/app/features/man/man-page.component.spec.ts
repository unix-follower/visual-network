import { TestBed } from "@angular/core/testing"

import { ManPageComponent } from "./man-page.component"
import { ManStateService } from "./man-state.service"

describe("ManPageComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManPageComponent],
    }).compileComponents()
  })

  it("renders the MAN workspace and editing controls", async () => {
    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const siteMetric = [...compiled.querySelectorAll(".metric-card")].find((card) =>
      card.textContent?.includes("Sites"),
    )
    const serviceMetric = [...compiled.querySelectorAll(".metric-card")].find((card) =>
      card.textContent?.includes("Services"),
    )

    expect(compiled.textContent).toContain("MAN presets")
    expect(compiled.textContent).toContain("Downtown Resilience Ring")
    expect(compiled.textContent).toContain("Interactive MAN path")
    expect(compiled.textContent).toContain("Accessible MAN details")
    expect(compiled.textContent).toContain("Distance")
    expect(compiled.textContent).toContain("Services")
    expect(compiled.textContent).toContain("Variance")
    expect(compiled.textContent).toContain("Packet loss")
    expect(compiled.textContent).toContain("Monthly service")
    expect(compiled.textContent).toContain("Capacity")
    expect(compiled.textContent).toContain("Resilience")
    expect(compiled.textContent).toContain("Providers")
    expect(compiled.textContent).toContain("Provider")
    expect(compiled.textContent).toContain("Selected device editor")
    expect(compiled.textContent).toContain("Add device")
    expect(compiled.textContent).toContain("Add or update link")
    expect(compiled.textContent).toContain("Destination endpoint")
    expect(compiled.textContent).toContain("1 metro service visible")
    expect(siteMetric?.textContent).toContain("3")
    expect(serviceMetric?.textContent).toContain("1")
  })

  it("lists only site devices in the MAN source selector while keeping services as destinations", async () => {
    const fixture = TestBed.createComponent(ManPageComponent)

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

    expect(sourceOptions).toEqual([
      "North Tower · Downtown",
      "Metro Core · Central Loop",
      "South Campus · Riverfront",
    ])
    expect(destinationOptions).toContain("Metro DC · Central Loop")
  })

  it("focuses the selected destination endpoint in the MAN details panel", async () => {
    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const destinationSelect = routeControls?.querySelectorAll("select")?.[1] as
      | HTMLSelectElement
      | undefined

    expect(compiled.textContent).toContain("North Tower")

    if (!destinationSelect) {
      throw new Error("Expected MAN destination selector to be rendered.")
    }

    destinationSelect.value = "metro-dc"
    destinationSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("North Tower -> Metro DC")
    expect(compiled.textContent).toContain("Metro DC")
    expect(compiled.textContent).toContain(
      "Metro data-center service handoff that terminates the preferred city path for shared enterprise services.",
    )
    expect(compiled.textContent).toContain("Roleservice")
  })

  it("focuses the selected source site in the MAN details panel", async () => {
    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const sourceSelect = routeControls?.querySelectorAll("select")?.[0] as
      | HTMLSelectElement
      | undefined

    expect(compiled.textContent).toContain("North Tower -> Metro Core")

    if (!sourceSelect) {
      throw new Error("Expected MAN source selector to be rendered.")
    }

    sourceSelect.value = "south-campus"
    sourceSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("South Campus -> Metro Core")
    expect(compiled.textContent).toContain("South Campus")
    expect(compiled.textContent).toContain(
      "Secondary metro building that stays on the same city ring and shares the core aggregation point.",
    )
    expect(compiled.textContent).toContain("Rolesite")
  })

  it("renders endpoint-aware guidance when no MAN node is selected", async () => {
    const state = TestBed.inject(ManStateService)

    state.selectDevice(null)

    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Select a metro node")
    expect(compiled.textContent).toContain(
      "Choose a source site or destination endpoint from the controls, or click the canvas to inspect any metro node.",
    )
    expect(compiled.textContent).toContain(
      "Pointer: click a metro node, drag to pan, wheel to zoom. Keyboard: arrows change focus",
    )
  })

  it("re-focuses the MAN details panel when the selected destination endpoint goes offline", async () => {
    const state = TestBed.inject(ManStateService)

    state.selectDestinationDevice("metro-dc")
    state.selectDevice("metro-dc")
    state.updateSelectedDevice({ status: "offline" })

    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("North Tower -> Metro Core")
    expect(compiled.textContent).toContain("Metro Core")
    expect(compiled.textContent).toContain(
      "Central metro aggregation node that concentrates building traffic before handing shared services into the city core.",
    )
    expect(compiled.textContent).not.toContain(
      "Metro data-center service handoff that terminates the preferred city path for shared enterprise services.",
    )
  })

  it("re-focuses the MAN details panel when the selected source site goes offline", async () => {
    const state = TestBed.inject(ManStateService)

    state.selectDevice("north-tower")
    state.updateSelectedDevice({ status: "offline" })

    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Metro Core -> South Campus")
    expect(compiled.textContent).toContain("Metro Core")
    expect(compiled.textContent).toContain(
      "Central metro aggregation node that concentrates building traffic before handing shared services into the city core.",
    )
    expect(compiled.textContent).not.toContain(
      "Downtown building distribution node that prefers the primary metro fiber ring but can fail over to a metro ethernet handoff.",
    )
  })

  it("re-focuses the MAN details panel when the selected source site is taken offline through the editor", async () => {
    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const editorSelects = compiled.querySelectorAll(".editor-grid select")
    const statusSelect = editorSelects[1] as HTMLSelectElement | undefined

    if (!statusSelect) {
      throw new Error("Expected MAN status editor selector to be rendered.")
    }

    statusSelect.value = "offline"
    statusSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Metro Core -> South Campus")
    expect(compiled.textContent).toContain("Metro Core")
    expect(compiled.textContent).toContain(
      "Central metro aggregation node that concentrates building traffic before handing shared services into the city core.",
    )
    expect(compiled.textContent).not.toContain(
      "Downtown building distribution node that prefers the primary metro fiber ring but can fail over to a metro ethernet handoff.",
    )
  })

  it("switches MAN presets through the page controls and refreshes the active workspace context", async () => {
    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const presetButtons = [...compiled.querySelectorAll(".preset-button")]
    const cityMeshButton = presetButtons.find((button) =>
      button.textContent?.includes("City Handoff Mesh"),
    )

    if (!(cityMeshButton instanceof HTMLButtonElement)) {
      throw new Error("Expected City Handoff Mesh preset button to be rendered.")
    }

    cityMeshButton.click()
    fixture.detectChanges()

    const siteMetric = [...compiled.querySelectorAll(".metric-card")].find((card) =>
      card.textContent?.includes("Sites"),
    )
    const serviceMetric = [...compiled.querySelectorAll(".metric-card")].find((card) =>
      card.textContent?.includes("Services"),
    )
    const routeControls = compiled.querySelector(".route-controls")
    const selects = routeControls?.querySelectorAll("select")
    const sourceOptions = [...(selects?.[0].querySelectorAll("option") ?? [])].map(
      (option) => option.textContent?.trim() ?? "",
    )
    const destinationOptions = [...(selects?.[1].querySelectorAll("option") ?? [])].map(
      (option) => option.textContent?.trim() ?? "",
    )

    expect(compiled.textContent).toContain("City Handoff Mesh")
    expect(compiled.textContent).toContain("Harbor Campus -> Innovation Hub")
    expect(compiled.textContent).toContain("Harbor Campus")
    expect(compiled.textContent).toContain(
      "Harbor-side campus that consumes metro services and can switch to a slower backup path during provider degradation.",
    )
    expect(siteMetric?.textContent).toContain("2")
    expect(serviceMetric?.textContent).toContain("2")
    expect(sourceOptions).toEqual([
      "Harbor Campus · Harbor District",
      "Innovation Hub · Innovation District",
    ])
    expect(destinationOptions).toContain("Media Exchange · Market Street")
    expect(destinationOptions).toContain("City Archive · Market Street")
  })

  it("re-focuses the MAN details panel to the normalized source when switching presets from a selected destination endpoint", async () => {
    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const routeControls = compiled.querySelector(".route-controls")
    const destinationSelect = routeControls?.querySelectorAll("select")?.[1] as
      | HTMLSelectElement
      | undefined
    const presetButtons = [...compiled.querySelectorAll(".preset-button")]
    const cityMeshButton = presetButtons.find((button) =>
      button.textContent?.includes("City Handoff Mesh"),
    )

    if (!destinationSelect) {
      throw new Error("Expected MAN destination selector to be rendered.")
    }

    if (!(cityMeshButton instanceof HTMLButtonElement)) {
      throw new Error("Expected City Handoff Mesh preset button to be rendered.")
    }

    destinationSelect.value = "metro-dc"
    destinationSelect.dispatchEvent(new Event("change"))
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Metro DC")
    expect(compiled.textContent).toContain("Roleservice")

    cityMeshButton.click()
    fixture.detectChanges()

    expect(compiled.textContent).toContain("Harbor Campus -> Innovation Hub")
    expect(compiled.textContent).toContain("Harbor Campus")
    expect(compiled.textContent).toContain(
      "Harbor-side campus that consumes metro services and can switch to a slower backup path during provider degradation.",
    )
    expect(compiled.textContent).not.toContain(
      "Metro data-center service handoff that terminates the preferred city path for shared enterprise services.",
    )
  })

  it("renders failover telemetry for a downstream metro service destination", async () => {
    const state = TestBed.inject(ManStateService)

    state.selectDestinationDevice("metro-dc")
    state.selectDevice("provider-primary")
    state.updateSelectedDevice({ status: "offline" })

    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Path state")
    expect(compiled.textContent).toContain("failover")
    expect(compiled.textContent).toContain("Backup active")
    expect(compiled.textContent).toContain("19 km")
    expect(compiled.textContent).toContain("20 ms")
    expect(compiled.textContent).toContain("6 ms")
    expect(compiled.textContent).toContain("0.4%")
    expect(compiled.textContent).toContain("$3,950")
    expect(compiled.textContent).toContain("400 Mbps")
    expect(compiled.textContent).toContain("Metro Ethernet B, Civic Dark Fiber")
    expect(compiled.textContent).toContain("North Tower -> Metro DC")
    expect(compiled.textContent).toContain("using failover transport behavior")
    expect(compiled.textContent).toContain("Resilience Backup active.")
  })

  it("renders degraded telemetry for the city handoff mesh preset", async () => {
    const state = TestBed.inject(ManStateService)

    state.selectTopology("city-handoff-mesh")

    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement
    const siteMetric = [...compiled.querySelectorAll(".metric-card")].find((card) =>
      card.textContent?.includes("Sites"),
    )
    const serviceMetric = [...compiled.querySelectorAll(".metric-card")].find((card) =>
      card.textContent?.includes("Services"),
    )

    expect(compiled.textContent).toContain("Path state")
    expect(compiled.textContent).toContain("degraded")
    expect(compiled.textContent).toContain("Primary degraded")
    expect(compiled.textContent).toContain("11 km")
    expect(compiled.textContent).toContain("11 ms")
    expect(compiled.textContent).toContain("4 ms")
    expect(compiled.textContent).toContain("0.3%")
    expect(compiled.textContent).toContain("$2,850")
    expect(compiled.textContent).toContain("550 Mbps")
    expect(compiled.textContent).toContain("Metro Mesh West")
    expect(compiled.textContent).toContain("Harbor Campus -> Innovation Hub")
    expect(compiled.textContent).toContain("using degraded transport behavior")
    expect(compiled.textContent).toContain("Resilience Primary degraded.")
    expect(compiled.textContent).toContain("2 metro services visible")
    expect(siteMetric?.textContent).toContain("2")
    expect(serviceMetric?.textContent).toContain("2")
  })

  it("updates rendered metro link telemetry after editing an active route link", async () => {
    const state = TestBed.inject(ManStateService)

    state.selectDevice("north-tower")

    const fixture = TestBed.createComponent(ManPageComponent)
    const component = fixture.componentInstance as ManPageComponent & {
      pendingConnectionTarget: { set(value: string): void }
      pendingConnectionKind: { set(value: string): void }
      pendingConnectionStrength: { set(value: string): void }
      pendingConnectionPriority: { set(value: string): void }
      pendingConnectionDistance: { set(value: string): void }
      pendingConnectionLatency: { set(value: string): void }
      pendingConnectionJitter: { set(value: string): void }
      pendingConnectionLoss: { set(value: string): void }
      pendingConnectionBandwidth: { set(value: string): void }
      pendingConnectionCarrier: { set(value: string): void }
      pendingConnectionCost: { set(value: string): void }
      addOrUpdateConnection(): void
    }

    await fixture.whenStable()
    fixture.detectChanges()

    component.pendingConnectionTarget.set("provider-primary")
    component.pendingConnectionKind.set("metro-fiber")
    component.pendingConnectionStrength.set("strong")
    component.pendingConnectionPriority.set("1")
    component.pendingConnectionDistance.set("9")
    component.pendingConnectionLatency.set("10")
    component.pendingConnectionJitter.set("2")
    component.pendingConnectionLoss.set("0")
    component.pendingConnectionBandwidth.set("900")
    component.pendingConnectionCarrier.set("Metro Fiber A")
    component.pendingConnectionCost.set("2000")
    component.addOrUpdateConnection()

    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("13 km")
    expect(compiled.textContent).toContain("13 ms")
    expect(compiled.textContent).toContain("via Metro Fiber A (9 km, 10 ms, p1)")
  })

  it("renders blocked path messaging when no branch transport path remains", async () => {
    const state = TestBed.inject(ManStateService)

    state.selectDevice("provider-primary")
    state.updateSelectedDevice({ status: "offline" })
    state.selectDevice("provider-backup")
    state.updateSelectedDevice({ status: "offline" })

    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Path state")
    expect(compiled.textContent).toContain("blocked")
    expect(compiled.textContent).toContain("n/a")
    expect(compiled.textContent).toContain("No metro providers active.")
    expect(compiled.textContent).toContain(
      "No MAN path is currently available between the selected metro endpoints.",
    )
    expect(compiled.textContent).toContain(
      "The selected metro endpoints are disconnected because the preferred route cannot traverse the available provider handoffs.",
    )
  })

  it("renders local-path messaging when source and destination are the same site", async () => {
    const state = TestBed.inject(ManStateService)

    state.selectDestinationDevice("north-tower")

    const fixture = TestBed.createComponent(ManPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Path state")
    expect(compiled.textContent).toContain("same-site")
    expect(compiled.textContent).toContain("North Tower -> North Tower")
    expect(compiled.textContent).toContain(
      "Source and destination are the same site, so the MAN path remains local.",
    )
    expect(compiled.textContent).toContain(
      "Traffic stays local to the selected metro site, so no inter-site MAN transport is required.",
    )
    expect(compiled.textContent).toContain("No metro providers active.")
  })
})
