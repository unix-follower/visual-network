import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from "@angular/core"

import { PanCanvasComponent } from "./pan-canvas.component"
import { PanStateService } from "./pan-state.service"
import { PanConnection, PanConnectionKind, PanDeviceKind, PanDeviceStatus } from "./pan.models"

@Component({
  selector: "app-pan-page",
  imports: [PanCanvasComponent],
  template: `
    <section class="pan-page">
      <div class="pan-layout">
        <aside aria-labelledby="preset-heading" class="panel panel-presets">
          <div>
            <p class="label">Phase 1</p>
            <h2 id="preset-heading">PAN presets</h2>
            <p class="copy">
              Stable starter layouts for the shared node, link, and metadata model used in later
              phases.
            </p>
          </div>

          <div class="preset-list">
            @for (topology of topologies(); track topology.id) {
              <button
                type="button"
                class="preset-button"
                [class.is-active]="topology.id === activeTopology().id"
                (click)="selectTopology(topology.id)"
              >
                <span class="preset-name">{{ topology.name }}</span>
                <span class="copy">{{ topology.summary }}</span>
              </button>
            }
          </div>
        </aside>

        <div class="panel panel-workspace">
          <div class="workspace-header">
            <div>
              <p class="label">Interactive topology</p>
              <h2>{{ activeTopology().name }}</h2>
            </div>
            <p class="copy workspace-summary">{{ activeTopology().summary }}</p>
          </div>

          <p class="copy control-hint">
            Pointer: click a node, drag to pan, wheel to zoom. Keyboard: arrows change device,
            Shift+arrows move the view, + and - adjust zoom, 0 resets the viewport.
          </p>

          <app-pan-canvas
            [topology]="activeTopology()"
            [selectedDeviceId]="selectedDeviceId()"
            (deviceSelected)="selectDevice($event)"
          />
        </div>

        <aside aria-labelledby="semantic-heading" class="panel panel-details">
          <div>
            <p class="label">Semantic companion</p>
            <h2 id="semantic-heading">Accessible details</h2>
            <p class="copy">
              Canvas meaning is mirrored here as keyboard-friendly structured information.
            </p>
          </div>

          <div class="detail-card">
            <h3>{{ selectedDevice()?.label ?? "Select a device" }}</h3>
            <p class="copy">
              {{ selectedDevice()?.detail ?? "Choose a node from the list or click the canvas." }}
            </p>

            @if (selectedDevice()) {
              <dl class="detail-list">
                <div>
                  <dt>Type</dt>
                  <dd>{{ selectedDevice()?.kind }}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{{ selectedDevice()?.status }}</dd>
                </div>
                <div>
                  <dt>Battery</dt>
                  <dd>{{ batteryText() }}</dd>
                </div>
              </dl>
            }
          </div>

          <div>
            <h3 class="subheading">Devices</h3>
            <div class="device-list">
              @for (device of activeTopology().devices; track device.id) {
                <button
                  type="button"
                  class="device-button"
                  [class.is-active]="device.id === selectedDeviceId()"
                  (click)="selectDevice(device.id)"
                >
                  <span>{{ device.label }}</span>
                  <span class="copy">{{ device.kind }} · {{ device.status }}</span>
                </button>
              }
            </div>
          </div>

          <div>
            <h3 class="subheading">Connections</h3>
            <ul class="connection-list">
              @for (connection of activeTopology().connections; track connection.id) {
                <li>
                  {{ connection.kind }} link between {{ labelFor(connection.from) }} and
                  {{ labelFor(connection.to) }} ({{ connection.strength }})
                </li>
              }
            </ul>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .pan-page {
      padding-bottom: 1.5rem;
    }

    .pan-layout {
      display: grid;
      grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr) minmax(20rem, 24rem);
      gap: 1rem;
      align-items: start;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding: 1.25rem;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 28px;
      background: rgba(8, 19, 31, 0.68);
    }

    .label {
      margin: 0 0 0.45rem;
      color: #4fd1c5;
      font-size: 0.74rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .copy {
      color: #d7e2ef;
      line-height: 1.5;
    }

    h2,
    h3,
    p {
      margin: 0;
    }

    h2 {
      font-size: 1.45rem;
      line-height: 1.1;
    }

    .preset-list,
    .device-list {
      display: grid;
      gap: 0.75rem;
    }

    .preset-button,
    .device-button {
      display: grid;
      gap: 0.25rem;
      width: 100%;
      padding: 0.9rem 1rem;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.04);
      color: #f4f8fb;
      text-align: left;
      cursor: pointer;
    }

    .preset-button.is-active,
    .device-button.is-active {
      border-color: rgba(79, 209, 197, 0.75);
      background: rgba(79, 209, 197, 0.12);
    }

    .preset-button:focus-visible,
    .device-button:focus-visible {
      outline: 3px solid #ffe082;
      outline-offset: 3px;
    }

    .preset-name {
      font-weight: 700;
    }

    .workspace-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: end;
    }

    .workspace-summary {
      max-width: 24rem;
    }

    .control-hint {
      padding: 0.9rem 1rem;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.04);
    }

    .detail-card {
      padding: 1rem;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.04);
    }

    .editor-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .field {
      display: grid;
      gap: 0.35rem;
      color: #d7e2ef;
      font-size: 0.92rem;
    }

    .field span {
      color: #9fb3c8;
    }

    .field input,
    .field select,
    .field textarea {
      width: 100%;
      padding: 0.7rem 0.8rem;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.04);
      color: #f4f8fb;
      font: inherit;
    }

    .field input:focus-visible,
    .field select:focus-visible,
    .field textarea:focus-visible {
      outline: 3px solid #ffe082;
      outline-offset: 3px;
    }

    .field-wide {
      grid-column: 1 / -1;
    }

    .inline-controls,
    .editor-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: end;
    }

    .field-compact {
      min-width: 12rem;
    }

    .action-button,
    .link-button {
      min-height: 2.5rem;
      padding: 0.65rem 0.95rem;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      color: #f4f8fb;
      cursor: pointer;
    }

    .action-button:focus-visible,
    .link-button:focus-visible {
      outline: 3px solid #ffe082;
      outline-offset: 3px;
    }

    .action-button[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .detail-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
      margin: 1rem 0 0;
    }

    .detail-list dt {
      color: #9fb3c8;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .detail-list dd {
      margin: 0.3rem 0 0;
      font-weight: 600;
    }

    .subheading {
      margin-bottom: 0.7rem;
    }

    .connection-list {
      margin: 0;
      padding-left: 1.1rem;
      color: #d7e2ef;
      line-height: 1.5;
    }

    .connection-list li + li {
      margin-top: 0.55rem;
    }

    .connection-list li {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
    }

    @media (max-width: 1260px) {
      .pan-layout {
        grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
      }

      .panel-details {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 900px) {
      .pan-layout {
        grid-template-columns: 1fr;
      }

      .workspace-header {
        flex-direction: column;
        align-items: start;
      }

      .detail-list {
        grid-template-columns: 1fr;
      }

      .editor-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanPageComponent {
  private readonly state = inject(PanStateService)
  protected readonly deviceKinds: PanDeviceKind[] = [
    "phone",
    "laptop",
    "tablet",
    "watch",
    "headset",
    "printer",
    "hotspot",
  ]
  protected readonly deviceStatuses: PanDeviceStatus[] = ["online", "idle", "offline"]
  protected readonly connectionKinds: PanConnectionKind[] = [
    "usb",
    "bluetooth",
    "wifi",
    "tethering",
  ]
  protected readonly connectionStrengths: PanConnection["strength"][] = ["strong", "medium", "weak"]
  protected readonly pendingDeviceKind = signal<PanDeviceKind>("phone")
  protected readonly pendingConnectionTarget = signal("")
  protected readonly pendingConnectionKind = signal<PanConnectionKind>("wifi")
  protected readonly pendingConnectionStrength = signal<PanConnection["strength"]>("medium")

  protected readonly topologies = this.state.topologies
  protected readonly activeTopology = this.state.activeTopology
  protected readonly selectedDevice = this.state.selectedDevice
  protected readonly selectedDeviceId = this.state.selectedDeviceId
  protected readonly editableTargets = computed(() =>
    this.activeTopology().devices.filter((device) => device.id !== this.selectedDeviceId()),
  )
  protected readonly selectedConnections = computed(() => {
    const selectedDeviceId = this.selectedDeviceId()

    if (!selectedDeviceId) {
      return []
    }

    return this.activeTopology().connections.filter(
      (connection) => connection.from === selectedDeviceId || connection.to === selectedDeviceId,
    )
  })
  protected readonly batteryText = computed(() => {
    const batteryLevel = this.selectedDevice()?.batteryLevel
    return batteryLevel === undefined ? "n/a" : `${batteryLevel}%`
  })

  constructor() {
    effect(() => {
      const targets = this.editableTargets()
      const pendingTarget = this.pendingConnectionTarget()

      if (targets.length === 0) {
        if (pendingTarget !== "") {
          this.pendingConnectionTarget.set("")
        }

        return
      }

      if (!targets.some((device) => device.id === pendingTarget)) {
        this.pendingConnectionTarget.set(targets[0].id)
      }
    })
  }

  protected selectTopology(topologyId: string): void {
    this.state.selectTopology(topologyId)
  }

  protected selectDevice(deviceId: string | null): void {
    this.state.selectDevice(deviceId)
  }

  protected labelFor(deviceId: string): string {
    return this.activeTopology().devices.find((device) => device.id === deviceId)?.label ?? deviceId
  }

  protected addDevice(): void {
    this.state.addDevice(this.pendingDeviceKind())
  }

  protected removeSelectedDevice(): void {
    this.state.removeSelectedDevice()
  }

  protected addOrUpdateConnection(): void {
    const selectedDeviceId = this.selectedDeviceId()

    if (!selectedDeviceId) {
      return
    }

    this.state.addOrUpdateConnection({
      from: selectedDeviceId,
      to: this.pendingConnectionTarget(),
      kind: this.pendingConnectionKind(),
      strength: this.pendingConnectionStrength(),
    })
  }

  protected removeConnection(connectionId: string): void {
    this.state.removeConnection(connectionId)
  }

  protected onPendingDeviceKindChange(event: Event): void {
    const value = this.selectValue(event)

    if (value && this.isDeviceKind(value)) {
      this.pendingDeviceKind.set(value)
    }
  }

  protected onPendingConnectionTargetChange(event: Event): void {
    const value = this.selectValue(event)

    if (value !== null) {
      this.pendingConnectionTarget.set(value)
    }
  }

  protected onPendingConnectionKindChange(event: Event): void {
    const value = this.selectValue(event)

    if (value && this.isConnectionKind(value)) {
      this.pendingConnectionKind.set(value)
    }
  }

  protected onPendingConnectionStrengthChange(event: Event): void {
    const value = this.selectValue(event)

    if (value && this.isConnectionStrength(value)) {
      this.pendingConnectionStrength.set(value)
    }
  }

  protected onLabelInput(event: Event): void {
    const value = this.inputValue(event)

    if (value !== null) {
      this.state.updateSelectedDevice({ label: value })
    }
  }

  protected onKindChange(event: Event): void {
    const value = this.selectValue(event)

    if (value && this.isDeviceKind(value)) {
      this.state.updateSelectedDevice({ kind: value })
    }
  }

  protected onStatusChange(event: Event): void {
    const value = this.selectValue(event)

    if (value && this.isDeviceStatus(value)) {
      this.state.updateSelectedDevice({ status: value })
    }
  }

  protected onBatteryInput(event: Event): void {
    const value = this.inputValue(event)

    if (value === null) {
      return
    }

    const numericValue = Number(value)

    if (value === "" || Number.isNaN(numericValue)) {
      this.state.updateSelectedDevice({ batteryLevel: undefined })
      return
    }

    this.state.updateSelectedDevice({ batteryLevel: Math.max(0, Math.min(100, numericValue)) })
  }

  protected onDetailInput(event: Event): void {
    const target = event.target

    if (!(target instanceof HTMLTextAreaElement)) {
      return
    }

    this.state.updateSelectedDevice({ detail: target.value })
  }

  private inputValue(event: Event): string | null {
    const target = event.target

    if (!(target instanceof HTMLInputElement)) {
      return null
    }

    return target.value
  }

  private selectValue(event: Event): string | null {
    const target = event.target

    if (!(target instanceof HTMLSelectElement)) {
      return null
    }

    return target.value
  }

  private isDeviceKind(value: string): value is PanDeviceKind {
    return this.deviceKinds.includes(value as PanDeviceKind)
  }

  private isDeviceStatus(value: string): value is PanDeviceStatus {
    return this.deviceStatuses.includes(value as PanDeviceStatus)
  }

  private isConnectionKind(value: string): value is PanConnectionKind {
    return this.connectionKinds.includes(value as PanConnectionKind)
  }

  private isConnectionStrength(value: string): value is PanConnection["strength"] {
    return this.connectionStrengths.includes(value as PanConnection["strength"])
  }
}
