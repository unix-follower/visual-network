import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from "@angular/core"

import { LanCanvasComponent } from "./lan-canvas.component"
import { LanStateService } from "./lan-state.service"
import { LanConnection, LanConnectionKind, LanDeviceKind, LanDeviceStatus } from "./lan.models"

@Component({
  selector: "app-lan-page",
  imports: [LanCanvasComponent],
  template: `
    <section class="lan-page">
      <div class="lan-layout">
        <aside aria-labelledby="preset-heading" class="panel panel-presets">
          <div>
            <p class="label">Phase 2</p>
            <h2 id="preset-heading">LAN presets</h2>
            <p class="copy">
              Shared local-area layouts that extend the Phase 1 interaction model into office and
              infrastructure spaces.
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

          <div class="metrics-grid" aria-label="Topology summary">
            <div class="metric-card">
              <span class="metric-label">Devices</span>
              <strong>{{ activeTopology().devices.length }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Links</span>
              <strong>{{ activeTopology().connections.length }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Offline</span>
              <strong>{{ offlineDeviceCount() }}</strong>
            </div>
          </div>

          <p class="copy control-hint">
            Pointer: click a node, drag to pan, wheel to zoom. Keyboard: arrows change device,
            Shift+arrows move the view, + and - adjust zoom, 0 resets the viewport.
          </p>

          <app-lan-canvas
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
              Canvas meaning is mirrored here as structured LAN state so the topology stays
              keyboard-friendly.
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
                  <dt>Adjacency</dt>
                  <dd>{{ selectedConnectionCount() }} links</dd>
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
            <h3 class="subheading">Selected device editor</h3>

            @if (selectedDevice()) {
              <div class="editor-grid">
                <label class="field field-wide">
                  <span>Label</span>
                  <input
                    type="text"
                    [value]="selectedDevice()?.label ?? ''"
                    (input)="onLabelInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Kind</span>
                  <select [value]="selectedDevice()?.kind ?? ''" (change)="onKindChange($event)">
                    @for (kind of deviceKinds; track kind) {
                      <option [value]="kind">{{ kind }}</option>
                    }
                  </select>
                </label>

                <label class="field">
                  <span>Status</span>
                  <select
                    [value]="selectedDevice()?.status ?? ''"
                    (change)="onStatusChange($event)"
                  >
                    @for (status of deviceStatuses; track status) {
                      <option [value]="status">{{ status }}</option>
                    }
                  </select>
                </label>

                <label class="field field-wide">
                  <span>Detail</span>
                  <textarea rows="3" (input)="onDetailInput($event)">{{
                    selectedDevice()?.detail ?? ""
                  }}</textarea>
                </label>
              </div>

              <div class="editor-actions">
                <button type="button" class="action-button" (click)="removeSelectedDevice()">
                  Remove device
                </button>
              </div>
            } @else {
              <p class="copy">Select a device to edit its local topology metadata.</p>
            }
          </div>

          <div>
            <h3 class="subheading">Add device</h3>
            <div class="inline-controls">
              <label class="field field-compact">
                <span>Kind</span>
                <select [value]="pendingDeviceKind()" (change)="onPendingDeviceKindChange($event)">
                  @for (kind of deviceKinds; track kind) {
                    <option [value]="kind">{{ kind }}</option>
                  }
                </select>
              </label>

              <button type="button" class="action-button" (click)="addDevice()">Add node</button>
            </div>
          </div>

          <div>
            <h3 class="subheading">Link selected device</h3>

            @if (selectedDevice()) {
              <div class="inline-controls">
                <label class="field field-compact">
                  <span>Target</span>
                  <select
                    [value]="pendingConnectionTarget()"
                    (change)="onPendingConnectionTargetChange($event)"
                  >
                    @for (device of editableTargets(); track device.id) {
                      <option [value]="device.id">{{ device.label }}</option>
                    }
                  </select>
                </label>

                <label class="field field-compact">
                  <span>Kind</span>
                  <select
                    [value]="pendingConnectionKind()"
                    (change)="onPendingConnectionKindChange($event)"
                  >
                    @for (kind of connectionKinds; track kind) {
                      <option [value]="kind">{{ kind }}</option>
                    }
                  </select>
                </label>

                <label class="field field-compact">
                  <span>Strength</span>
                  <select
                    [value]="pendingConnectionStrength()"
                    (change)="onPendingConnectionStrengthChange($event)"
                  >
                    @for (strength of connectionStrengths; track strength) {
                      <option [value]="strength">{{ strength }}</option>
                    }
                  </select>
                </label>

                <button
                  type="button"
                  class="action-button"
                  [disabled]="editableTargets().length === 0"
                  (click)="addOrUpdateConnection()"
                >
                  Add or update link
                </button>
              </div>
            } @else {
              <p class="copy">Select a device to connect it to the rest of the LAN.</p>
            }
          </div>

          <div>
            <h3 class="subheading">Connections</h3>
            <ul class="connection-list">
              @for (connection of activeTopology().connections; track connection.id) {
                <li>
                  <span>
                    {{ connection.kind }} link between {{ labelFor(connection.from) }} and
                    {{ labelFor(connection.to) }} ({{ connection.strength }})
                  </span>
                  <button
                    type="button"
                    class="link-button"
                    (click)="removeConnection(connection.id)"
                  >
                    Remove
                  </button>
                </li>
              }
            </ul>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .lan-page {
      padding-bottom: 1.5rem;
    }

    .lan-layout {
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

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .metric-card {
      display: grid;
      gap: 0.3rem;
      padding: 0.9rem 1rem;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.04);
    }

    .metric-card strong {
      font-size: 1.5rem;
      line-height: 1;
    }

    .metric-label {
      color: #9fb3c8;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
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
      .lan-layout {
        grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
      }

      .panel-details {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 900px) {
      .lan-layout {
        grid-template-columns: 1fr;
      }

      .workspace-header {
        flex-direction: column;
        align-items: start;
      }

      .metrics-grid,
      .detail-list,
      .editor-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanPageComponent {
  private readonly state = inject(LanStateService)
  protected readonly deviceKinds: LanDeviceKind[] = [
    "router",
    "switch",
    "access-point",
    "server",
    "workstation",
    "printer",
  ]
  protected readonly deviceStatuses: LanDeviceStatus[] = ["online", "degraded", "offline"]
  protected readonly connectionKinds: LanConnectionKind[] = [
    "ethernet",
    "trunk",
    "wireless",
    "uplink",
  ]
  protected readonly connectionStrengths: LanConnection["strength"][] = ["strong", "medium", "weak"]
  protected readonly pendingDeviceKind = signal<LanDeviceKind>("switch")
  protected readonly pendingConnectionTarget = signal("")
  protected readonly pendingConnectionKind = signal<LanConnectionKind>("ethernet")
  protected readonly pendingConnectionStrength = signal<LanConnection["strength"]>("strong")

  protected readonly topologies = this.state.topologies
  protected readonly activeTopology = this.state.activeTopology
  protected readonly selectedDevice = this.state.selectedDevice
  protected readonly selectedDeviceId = this.state.selectedDeviceId
  protected readonly editableTargets = computed(() =>
    this.activeTopology().devices.filter((device) => device.id !== this.selectedDeviceId()),
  )
  protected readonly selectedConnectionCount = computed(() => {
    const selectedDeviceId = this.selectedDeviceId()

    if (!selectedDeviceId) {
      return 0
    }

    return this.activeTopology().connections.filter(
      (connection) => connection.from === selectedDeviceId || connection.to === selectedDeviceId,
    ).length
  })
  protected readonly offlineDeviceCount = computed(
    () => this.activeTopology().devices.filter((device) => device.status === "offline").length,
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

  private isDeviceKind(value: string): value is LanDeviceKind {
    return this.deviceKinds.includes(value as LanDeviceKind)
  }

  private isDeviceStatus(value: string): value is LanDeviceStatus {
    return this.deviceStatuses.includes(value as LanDeviceStatus)
  }

  private isConnectionKind(value: string): value is LanConnectionKind {
    return this.connectionKinds.includes(value as LanConnectionKind)
  }

  private isConnectionStrength(value: string): value is LanConnection["strength"] {
    return this.connectionStrengths.includes(value as LanConnection["strength"])
  }
}
