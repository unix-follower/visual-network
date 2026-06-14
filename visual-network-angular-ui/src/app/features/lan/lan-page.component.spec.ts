import { TestBed } from "@angular/core/testing"

import { LanPageComponent } from "./lan-page.component"

describe("LanPageComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LanPageComponent],
    }).compileComponents()
  })

  it("renders the LAN workspace and editor controls", async () => {
    const fixture = TestBed.createComponent(LanPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("LAN presets")
    expect(compiled.textContent).toContain("Branch Office")
    expect(compiled.textContent).toContain("Selected device editor")
    expect(compiled.textContent).toContain("Add or update link")
  })
})
