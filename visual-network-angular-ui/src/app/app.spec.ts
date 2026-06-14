import { TestBed } from "@angular/core/testing"
import { provideRouter } from "@angular/router"

import { App } from "./app"
import { routes } from "./app.routes"

describe("App", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents()
  })

  it("should create the app", () => {
    const fixture = TestBed.createComponent(App)
    const app = fixture.componentInstance
    expect(app).toBeTruthy()
  })

  it("should render shell copy", async () => {
    const fixture = TestBed.createComponent(App)
    await fixture.whenStable()
    fixture.detectChanges()
    const compiled = fixture.nativeElement as HTMLElement
    expect(compiled.querySelector("h1")?.textContent).toContain("Visual Networks")
    expect(compiled.textContent).toContain(
      "Phases 1 through 13 establish the reusable visualization shell",
    )
    expect(compiled.textContent).toContain("Phase 2: LAN")
    expect(compiled.textContent).toContain("Phase 3: Routing & Switching")
    expect(compiled.textContent).toContain("Phase 4: WLAN")
    expect(compiled.textContent).toContain("Phase 5: WAN")
    expect(compiled.textContent).toContain("Phase 6: MAN")
    expect(compiled.textContent).toContain("Phase 7: SDN")
    expect(compiled.textContent).toContain("Phase 8: SAN")
    expect(compiled.textContent).toContain("Phase 9: DCN")
    expect(compiled.textContent).toContain("Phase 10: CEN")
    expect(compiled.textContent).toContain("Phase 11: Network Security")
    expect(compiled.textContent).toContain("Phase 12: Network Management & Automation")
    expect(compiled.textContent).toContain("Phase 13: Enterprise Network")
  })
})
