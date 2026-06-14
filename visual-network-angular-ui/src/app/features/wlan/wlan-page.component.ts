import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from "@angular/core"

import { WlanCanvasComponent } from "./wlan-canvas.component"
import {
  WlanConnection,
  WlanConnectionKind,
  WlanDevice,
  WlanDeviceKind,
  WlanDeviceStatus,
} from "./wlan.models"
import { WlanStateService } from "./wlan-state.service"

@Component({
  selector: "app-wlan-page",
  imports: [WlanCanvasComponent],
  template: `
    <section class="wlan-page">
      <div class="wlan-layout">
        <aside aria-labelledby="preset-heading" class="panel panel-overview">
          <div>
            <p class="label">Phase 4</p>
            <h2 id="preset-heading">WLAN presets</h2>
            <p class="copy">
              Wireless LANs add overlapping access point coverage, roaming choices, and signal-aware
              client association.
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
              <p class="label">Interactive association</p>
              <h2>{{ activeTopology().name }}</h2>
            </div>
            <p class="copy workspace-summary">{{ activeTopology().summary }}</p>
          </div>

          <div class="metrics-grid" aria-label="Wireless summary">
            <div class="metric-card">
              <span class="metric-label">Access points</span>
              <strong>{{ accessPoints().length }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Clients</span>
              <strong>{{ clients().length }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Signal</span>
              <strong>{{ signalHeadline() }}</strong>
            </div>
          </div>

          <div class="association-controls">
            <label class="field">
              <span>Client</span>
              <select [value]="selectedClientId() ?? ''" (change)="onClientChange($event)">
                @for (client of clients(); track client.id) {
                  <option [value]="client.id">{{ client.label }} - {{ client.zone }}</option>
                }
              </select>
            </label>

            <label class="field">
              <span>Preferred access point</span>
              <select
                [value]="preferredAccessPointId() ?? ''"
                (change)="onAccessPointChange($event)"
              >
                <option value="">Auto select strongest AP</option>
                @for (accessPoint of accessPoints(); track accessPoint.id) {
                  <option [value]="accessPoint.id">
                    {{ accessPoint.label }} - {{ accessPoint.channel }}
                  </option>
                }
              </select>
            </label>
          </div>

          <p class="copy control-hint">
            Pointer: click a device, drag to pan, wheel to zoom. Keyboard: arrows change device,
            Shift+arrows move the view, + and - adjust zoom, 0 resets the viewport. Coverage rings
            show AP reach, and the highlighted path follows the selected client association toward
            the gateway.
          </p>

          <app-wlan-canvas
            [topology]="activeTopology()"
            [selectedDeviceId]="selectedDeviceId()"
            [highlightedAccessPointId]="activeAssociation().accessPointId"
            [activePathConnectionIds]="activePathConnectionIds()"
            (deviceSelected)="selectDevice($event)"
          />

          <div class="path-card">
            <span class="status-label">Active association</span>
            <strong>{{ associationHeadline() }}</strong>
            <p class="copy">{{ associationSummary() }}</p>
          </div>
        </div>

        <aside aria-labelledby="semantic-heading" class="panel panel-semantics">
          <div>
            <p class="label">Semantic companion</p>
            <h2 id="semantic-heading">Accessible WLAN details</h2>
          </div>

          <div class="detail-card">
            <h3>{{ selectedDevice()?.label ?? "Select a device" }}</h3>
            <p class="copy">
              {{
                selectedDevice()?.detail ??
                  "Choose a client or access point from the list or click the canvas."
              }}
            </p>

            @if (selectedDevice()) {
              <dl class="detail-list">
                <div>
                  <dt>Role</dt>
                  <dd>{{ selectedDevice()?.role }}</dd>
                </div>
                <div>
                  <dt>Zone</dt>
                  <dd>{{ selectedDevice()?.zone }}</dd>
                </div>
                <div>
                  <dt>Band</dt>
                  <dd>{{ selectedDevice()?.band }}</dd>
                </div>
                <div>
                  <dt>Channel</dt>
                  <dd>{{ selectedDevice()?.channel }}</dd>
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

          <div class="association-card">
            <h3 class="subheading">Association details</h3>
            <p class="copy">{{ associationDetailText() }}</p>
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

                <label class="field">
                  <span>Band</span>
                  <select [value]="selectedDevice()?.band ?? ''" (change)="onBandChange($event)">
                    @for (band of deviceBands; track band) {
                      <option [value]="band">{{ band }}</option>
                    }
                  </select>
                </label>

                <label class="field">
                  <span>Zone</span>
                  <input
                    type="text"
                    [value]="selectedDevice()?.zone ?? ''"
                    (input)="onZoneInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Channel</span>
                  <input
                    type="text"
                    [value]="selectedDevice()?.channel ?? ''"
                    (input)="onChannelInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Coverage radius</span>
                  <input
                    type="number"
                    min="0"
                    [value]="selectedDevice()?.coverageRadius ?? 0"
                    (input)="onCoverageRadiusInput($event)"
                  />
                </label>

                <label class="field field-wide">
                  <span>Detail</span>
                  <textarea
                    rows="3"
                    [value]="selectedDevice()?.detail ?? ''"
                    (input)="onDetailInput($event)"
                  ></textarea>
                </label>
              </div>

              <div class="editor-actions">
                <button type="button" class="action-button" (click)="removeSelectedDevice()">
                  Remove device
                </button>
              </div>
            } @else {
              <p class="copy">Select a device to edit its wireless metadata.</p>
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

              <button type="button" class="action-button" (click)="addDevice()">Add device</button>
            </div>
          </div>

          <div>
            <h3 class="subheading">Path hops</h3>
            <ol class="path-list">
              @for (deviceLabel of activePathLabels(); track deviceLabel) {
                <li>{{ deviceLabel }}</li>
              }
            </ol>
          </div>

          <div>
            <h3 class="subheading">Link selected device</h3>

            @if (selectedDevice()) {
              <div class="editor-grid">
                <label class="field">
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

                <label class="field">
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

                <label class="field">
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

                <label class="field">
                  <span>RSSI dBm</span>
                  <input
                    type="number"
                    [value]="pendingConnectionRssi()"
                    (input)="onPendingConnectionRssiInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Throughput Mbps</span>
                  <input
                    type="number"
                    min="0"
                    [value]="pendingConnectionThroughput()"
                    (input)="onPendingConnectionThroughputInput($event)"
                  />
                </label>
              </div>

              <div class="editor-actions">
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
              <p class="copy">Select a device to connect it to the rest of the WLAN.</p>
            }
          </div>

          <div>
            <h3 class="subheading">Selected device links</h3>

            @if (selectedConnections().length > 0) {
              <ul class="connection-list">
                @for (connection of selectedConnections(); track connection.id) {
                  <li>
                    <span>
                      {{ connection.kind }} between {{ labelFor(connection.from) }} and
                      {{ labelFor(connection.to) }} ({{ connection.strength }},
                      {{ connection.rssi }} dBm, {{ connection.throughputMbps }} Mbps)
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
            } @else {
              <p class="copy">The selected device has no direct links in this preset.</p>
            }
          </div>

          <div>
            <h3 class="subheading">Access points</h3>
            <div class="device-list">
              @for (accessPoint of accessPoints(); track accessPoint.id) {
                <button
                  type="button"
                  class="device-button"
                  [class.is-active]="accessPoint.id === activeAssociation().accessPointId"
                  (click)="selectPreferredAccessPoint(accessPoint.id)"
                >
                  <span>{{ accessPoint.label }}</span>
                  <span class="copy">{{ accessPoint.zone }} - {{ accessPoint.channel }}</span>
                </button>
              }
            </div>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .wlan-page {
      padding-bottom: 1.5rem;
    }

    .wlan-layout {
      display: grid;
      grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr) minmax(18rem, 22rem);
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
      margin: 0;
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

    .workspace-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: end;
    }

    .workspace-summary {
      max-width: 24rem;
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
    .device-button:focus-visible,
    .field input:focus-visible,
    .field select:focus-visible,
    .field textarea:focus-visible,
    .action-button:focus-visible,
    .link-button:focus-visible {
      outline: 3px solid #ffe082;
      outline-offset: 3px;
    }

    .preset-name {
      font-weight: 700;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .metric-card,
    .path-card,
    .detail-card,
    .association-card {
      display: grid;
      gap: 0.65rem;
      padding: 1rem;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.04);
    }

    .metric-label,
    .status-label,
    dt {
      color: #9fb3c8;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .metric-card strong,
    .path-card strong {
      font-size: 1.35rem;
      line-height: 1.1;
    }

    .association-controls {
      display: grid;
      gap: 0.85rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
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

    .control-hint {
      padding: 0.9rem 1rem;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.04);
    }

    .detail-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
      margin: 1rem 0 0;
    }

    dd {
      margin: 0.3rem 0 0;
      font-weight: 600;
    }

    .subheading {
      margin-bottom: 0.7rem;
    }

    .editor-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
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

    .action-button[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .path-list,
    .connection-list {
      margin: 0;
      padding-left: 1.1rem;
      color: #d7e2ef;
      line-height: 1.6;
    }

    .path-list li + li,
    .connection-list li + li {
      margin-top: 0.55rem;
    }

    .connection-list li {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
    }

    @media (max-width: 1180px) {
      .wlan-layout {
        grid-template-columns: 1fr;
      }

      .workspace-header {
        flex-direction: column;
        align-items: start;
      }

      .association-controls,
      .metrics-grid,
      .detail-list,
      .editor-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WlanPageComponent {
  private readonly state = inject(WlanStateService)

  protected readonly deviceKinds: WlanDeviceKind[] = [
    "access-point",
    "client",
    "controller",
    "gateway",
  ]
  protected readonly deviceStatuses: WlanDeviceStatus[] = ["online", "degraded", "offline"]
  protected readonly deviceBands: WlanDevice["band"][] = [
    "dual-band",
    "tri-band",
    "6-ghz",
    "wired-only",
  ]
  protected readonly connectionKinds: WlanConnectionKind[] = [
    "wireless-link",
    "wired-uplink",
    "mesh-backhaul",
  ]
  protected readonly connectionStrengths: WlanConnection["strength"][] = [
    "strong",
    "medium",
    "weak",
  ]
  protected readonly pendingDeviceKind = signal<WlanDeviceKind>("client")
  protected readonly pendingConnectionTarget = signal("")
  protected readonly pendingConnectionKind = signal<WlanConnectionKind>("wireless-link")
  protected readonly pendingConnectionStrength = signal<WlanConnection["strength"]>("strong")
  protected readonly pendingConnectionRssi = signal("-55")
  protected readonly pendingConnectionThroughput = signal("600")

  protected readonly topologies = this.state.topologies
  protected readonly activeTopology = this.state.activeTopology
  protected readonly selectedDevice = this.state.selectedDevice
  protected readonly selectedDeviceId = this.state.selectedDeviceId
  protected readonly accessPoints = this.state.accessPoints
  protected readonly clients = this.state.clients
  protected readonly selectedClientId = this.state.selectedClientId
  protected readonly preferredAccessPointId = this.state.preferredAccessPointId
  protected readonly activeAssociation = this.state.activeAssociation
  protected readonly activePathConnectionIds = this.state.activePathConnectionIds
  protected readonly editableTargets = computed(() =>
    this.activeTopology().devices.filter((device) => device.id !== this.selectedDeviceId()),
  )
  protected readonly activePathLabels = computed(() =>
    this.state.activePathDeviceIds().map((deviceId) => this.labelFor(deviceId)),
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
  protected readonly selectedConnectionCount = computed(() => this.selectedConnections().length)
  protected readonly signalHeadline = computed(() => {
    const signalRssi = this.activeAssociation().signalRssi
    return signalRssi === null ? "n/a" : `${signalRssi} dBm`
  })
  protected readonly associationHeadline = computed(() => {
    const clientLabel = this.labelFor(this.activeAssociation().clientId)
    const accessPointLabel = this.labelFor(this.activeAssociation().accessPointId)
    return `${clientLabel} -> ${accessPointLabel}`
  })
  protected readonly associationSummary = computed(() => {
    const association = this.activeAssociation()

    if (!association.accessPointId) {
      return "Choose a client or preferred access point to inspect the active wireless association."
    }

    const pathLength = Math.max(association.pathDeviceIds.length - 1, 0)
    return `${association.roamingState} association, ${this.state.signalSummary()}, ${pathLength} hops to the gateway.`
  })
  protected readonly associationDetailText = computed(() => {
    const association = this.activeAssociation()

    if (!association.accessPointId) {
      return "No direct wireless path is available from the selected client to an access point in this preset."
    }

    const selectionMode = this.preferredAccessPointId()
      ? "manual preference"
      : "strongest signal auto-selection"
    return `${this.labelFor(association.clientId)} uses ${this.labelFor(association.accessPointId)} via ${selectionMode}. Signal ${this.state.signalSummary()}. Gateway target: ${this.labelFor(association.gatewayId)}.`
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

    const selectedDevice = this.activeTopology().devices.find((device) => device.id === deviceId)

    if (!selectedDevice) {
      return
    }

    if (selectedDevice.kind === "client") {
      this.state.selectClient(selectedDevice.id)
      return
    }

    if (selectedDevice.kind === "access-point") {
      this.state.selectPreferredAccessPoint(selectedDevice.id)
    }
  }

  protected selectPreferredAccessPoint(accessPointId: string): void {
    this.state.selectPreferredAccessPoint(accessPointId)
    this.state.selectDevice(accessPointId)
  }

  protected addDevice(): void {
    this.state.addDevice(this.pendingDeviceKind())
  }

  protected removeSelectedDevice(): void {
    this.state.removeSelectedDevice()
  }

  protected addOrUpdateConnection(): void {
    const selectedDeviceId = this.selectedDeviceId()
    const targetId = this.pendingConnectionTarget()
    const rssi = Number(this.pendingConnectionRssi())
    const throughputMbps = Number(this.pendingConnectionThroughput())

    if (!selectedDeviceId || !targetId || Number.isNaN(rssi) || Number.isNaN(throughputMbps)) {
      return
    }

    this.state.addOrUpdateWlanConnection({
      from: selectedDeviceId,
      to: targetId,
      kind: this.pendingConnectionKind(),
      strength: this.pendingConnectionStrength(),
      rssi,
      throughputMbps,
    })
  }

  protected removeConnection(connectionId: string): void {
    this.state.removeConnection(connectionId)
  }

  protected onClientChange(event: Event): void {
    const value = this.selectValue(event)

    if (!value) {
      return
    }

    this.state.selectClient(value)
  }

  protected onAccessPointChange(event: Event): void {
    this.state.selectPreferredAccessPoint(this.selectValue(event))
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

  protected onPendingConnectionRssiInput(event: Event): void {
    const value = this.inputValue(event)

    if (value !== null) {
      this.pendingConnectionRssi.set(value)
    }
  }

  protected onPendingConnectionThroughputInput(event: Event): void {
    const value = this.inputValue(event)

    if (value !== null) {
      this.pendingConnectionThroughput.set(value)
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
      this.state.updateSelectedDevice(this.devicePatchForKind(value))
    }
  }

  protected onStatusChange(event: Event): void {
    const value = this.selectValue(event)

    if (value && this.isDeviceStatus(value)) {
      this.state.updateSelectedDevice({ status: value })
    }
  }

  protected onBandChange(event: Event): void {
    const value = this.selectValue(event)

    if (value && this.isDeviceBand(value)) {
      this.state.updateSelectedDevice({ band: value })
    }
  }

  protected onZoneInput(event: Event): void {
    const value = this.inputValue(event)

    if (value !== null) {
      this.state.updateSelectedDevice({ zone: value })
    }
  }

  protected onChannelInput(event: Event): void {
    const value = this.inputValue(event)

    if (value !== null) {
      this.state.updateSelectedDevice({ channel: value })
    }
  }

  protected onCoverageRadiusInput(event: Event): void {
    const value = this.inputValue(event)

    if (value === null) {
      return
    }

    const coverageRadius = Number(value)

    if (Number.isNaN(coverageRadius)) {
      return
    }

    this.state.updateSelectedDevice({ coverageRadius: Math.max(coverageRadius, 0) })
  }

  protected onDetailInput(event: Event): void {
    const target = event.target

    if (!(target instanceof HTMLTextAreaElement)) {
      return
    }

    this.state.updateSelectedDevice({ detail: target.value })
  }

  protected labelFor(deviceId: string | null): string {
    if (!deviceId) {
      return "Unset"
    }

    return this.activeTopology().devices.find((device) => device.id === deviceId)?.label ?? deviceId
  }

  private selectValue(event: Event): string | null {
    const target = event.target

    if (!(target instanceof HTMLSelectElement)) {
      return null
    }

    return target.value || null
  }

  private inputValue(event: Event): string | null {
    const target = event.target

    if (!(target instanceof HTMLInputElement)) {
      return null
    }

    return target.value
  }

  private devicePatchForKind(kind: WlanDeviceKind): Partial<WlanDevice> {
    if (kind === "client") {
      return {
        kind,
        role: "endpoint",
        band: "dual-band",
        channel: "Client auto",
        coverageRadius: 0,
      }
    }

    if (kind === "gateway") {
      return {
        kind,
        role: "edge",
        band: "wired-only",
        channel: "Mgmt",
        coverageRadius: 0,
      }
    }

    if (kind === "controller") {
      return {
        kind,
        role: "control",
        band: "wired-only",
        channel: "Mgmt",
        coverageRadius: 0,
      }
    }

    return {
      kind,
      role: "access",
      band: "dual-band",
      channel: "5 GHz ch 36",
      coverageRadius: 135,
    }
  }

  private isDeviceKind(value: string): value is WlanDeviceKind {
    return this.deviceKinds.includes(value as WlanDeviceKind)
  }

  private isDeviceStatus(value: string): value is WlanDeviceStatus {
    return this.deviceStatuses.includes(value as WlanDeviceStatus)
  }

  private isDeviceBand(value: string): value is WlanDevice["band"] {
    return this.deviceBands.includes(value as WlanDevice["band"])
  }

  private isConnectionKind(value: string): value is WlanConnectionKind {
    return this.connectionKinds.includes(value as WlanConnectionKind)
  }

  private isConnectionStrength(value: string): value is WlanConnection["strength"] {
    return this.connectionStrengths.includes(value as WlanConnection["strength"])
  }
}
