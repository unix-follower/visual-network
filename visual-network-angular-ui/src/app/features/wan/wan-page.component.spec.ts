import { TestBed } from "@angular/core/testing"

import { WanPageComponent } from "./wan-page.component"
import { WanStateService } from "./wan-state.service"

describe("WanPageComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WanPageComponent],
    }).compileComponents()
  })

  it("renders the WAN workspace and editing controls", async () => {
    const fixture = TestBed.createComponent(WanPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("WAN presets")
    expect(compiled.textContent).toContain("Regional Failover")
    expect(compiled.textContent).toContain("Interactive WAN path")
    expect(compiled.textContent).toContain("Accessible WAN details")
    expect(compiled.textContent).toContain("Jitter")
    expect(compiled.textContent).toContain("Packet loss")
    expect(compiled.textContent).toContain("Monthly cost")
    expect(compiled.textContent).toContain("Bandwidth")
    expect(compiled.textContent).toContain("Carriers")
    expect(compiled.textContent).toContain("Selected device editor")
    expect(compiled.textContent).toContain("Add device")
    expect(compiled.textContent).toContain("Add or update link")
  })

  it("renders failover telemetry for a downstream cloud destination", async () => {
    const state = TestBed.inject(WanStateService)

    state.selectDestinationDevice("cloud-erp")
    state.selectDevice("carrier-mpls")
    state.updateSelectedDevice({ status: "offline" })

    const fixture = TestBed.createComponent(WanPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Path state")
    expect(compiled.textContent).toContain("failover")
    expect(compiled.textContent).toContain("96 ms")
    expect(compiled.textContent).toContain("22 ms")
    expect(compiled.textContent).toContain("1.5%")
    expect(compiled.textContent).toContain("$6,000")
    expect(compiled.textContent).toContain("300 Mbps")
    expect(compiled.textContent).toContain("Carrier B, Metro Fiber, Cloud Fabric")
    expect(compiled.textContent).toContain("Branch West -> Cloud ERP")
    expect(compiled.textContent).toContain("using failover transport behavior")
  })

  it("renders blocked path messaging when no branch transport path remains", async () => {
    const state = TestBed.inject(WanStateService)

    state.selectDevice("carrier-mpls")
    state.updateSelectedDevice({ status: "offline" })
    state.selectDevice("carrier-internet")
    state.updateSelectedDevice({ status: "offline" })

    const fixture = TestBed.createComponent(WanPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Path state")
    expect(compiled.textContent).toContain("blocked")
    expect(compiled.textContent).toContain("n/a")
    expect(compiled.textContent).toContain("No WAN carriers active.")
    expect(compiled.textContent).toContain(
      "No WAN path is currently available between the selected sites.",
    )
    expect(compiled.textContent).toContain(
      "The selected sites are disconnected because the preferred route cannot traverse the available carrier edges.",
    )
  })

  it("renders local-path messaging when source and destination are the same site", async () => {
    const state = TestBed.inject(WanStateService)

    state.selectDestinationDevice("branch-west")

    const fixture = TestBed.createComponent(WanPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("Path state")
    expect(compiled.textContent).toContain("same-site")
    expect(compiled.textContent).toContain("Branch West -> Branch West")
    expect(compiled.textContent).toContain(
      "Source and destination are the same site, so the WAN path remains local.",
    )
    expect(compiled.textContent).toContain(
      "Traffic stays local to the selected site, so no inter-site WAN transport is required.",
    )
    expect(compiled.textContent).toContain("No WAN carriers active.")
  })
})
