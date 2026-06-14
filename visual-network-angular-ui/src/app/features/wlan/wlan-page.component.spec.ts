import { TestBed } from "@angular/core/testing"

import { WlanPageComponent } from "./wlan-page.component"

describe("WlanPageComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WlanPageComponent],
    }).compileComponents()
  })

  it("renders the WLAN workspace and association controls", async () => {
    const fixture = TestBed.createComponent(WlanPageComponent)

    await fixture.whenStable()
    fixture.detectChanges()

    const compiled = fixture.nativeElement as HTMLElement

    expect(compiled.textContent).toContain("WLAN presets")
    expect(compiled.textContent).toContain("Office Roaming")
    expect(compiled.textContent).toContain("Preferred access point")
    expect(compiled.textContent).toContain("Accessible WLAN details")
    expect(compiled.textContent).toContain("Selected device editor")
    expect(compiled.textContent).toContain("Add device")
    expect(compiled.textContent).toContain("Add or update link")
  })
})
