import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from "@angular/core"

import { ManCanvasComponent } from "./man-canvas.component"
import {
  ManConnection,
  ManConnectionKind,
  ManDevice,
  ManDeviceKind,
  ManDeviceStatus,
  ManDeviceTier,
} from "./man.models"
import { ManStateService } from "./man-state.service"

@Component({
  selector: "app-man-page",
  imports: [ManCanvasComponent],
  template: `
    <section class="man-page">
      <div class="man-layout">
        <aside aria-labelledby="preset-heading" class="panel panel-overview">
          <div>
            <p class="label">Phase 6</p>
            <h2 id="preset-heading">MAN presets</h2>
            <p class="copy">
              Metropolitan area networks link buildings and metro services across a single city,
              prefer primary fiber, and fail over to backup provider handoffs when the preferred
              metro path degrades.
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
              <p class="label">Interactive MAN path</p>
              <h2>{{ activeTopology().name }}</h2>
            </div>
            <p class="copy workspace-summary">{{ activeTopology().summary }}</p>
          </div>

          <div class="metrics-grid" aria-label="MAN summary">
            <div class="metric-card">
              <span class="metric-label">Sites</span>
              <strong>{{ siteCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Services</span>
              <strong>{{ serviceCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Distance</span>
              <strong>{{ totalDistanceLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Delay</span>
              <strong>{{ totalLatencyLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Variance</span>
              <strong>{{ totalJitterLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Packet loss</span>
              <strong>{{ totalPacketLossLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Monthly service</span>
              <strong>{{ totalCostLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Capacity</span>
              <strong>{{ constrainedBandwidthLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Path state</span>
              <strong>{{ pathState() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Resilience</span>
              <strong>{{ redundancySummaryLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Providers</span>
              <strong>{{ carrierSummaryLabel() }}</strong>
            </div>
          </div>

          <div class="route-controls">
            <label class="field">
              <span>Source site</span>
              <select [value]="sourceDeviceId() ?? ''" (change)="onSourceChange($event)">
                @for (device of sourceDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.region }}</option>
                }
              </select>
            </label>

            <label class="field">
              <span>Destination endpoint</span>
              <select [value]="destinationDeviceId() ?? ''" (change)="onDestinationChange($event)">
                @for (device of endpointDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.region }}</option>
                }
              </select>
            </label>
          </div>

          <p class="copy control-hint">
            Pointer: click a metro node, drag to pan, wheel to zoom. Keyboard: arrows change focus,
            Shift+arrows move the view, + and - adjust zoom, 0 resets the viewport. The highlighted
            MAN path reflects the best available route between the selected metro endpoints.
          </p>

          <app-man-canvas
            [topology]="activeTopology()"
            [selectedDeviceId]="selectedDeviceId()"
            [sourceDeviceId]="sourceDeviceId()"
            [destinationDeviceId]="destinationDeviceId()"
            [activePathConnectionIds]="activePathConnectionIds()"
            (deviceSelected)="selectDevice($event)"
          />

          <div class="path-card">
            <span class="status-label">Active MAN path</span>
            <strong>{{ sourceLabel() }} -> {{ destinationLabel() }}</strong>
            <p class="copy">{{ pathSummary() }}</p>
          </div>
        </div>

        <aside aria-labelledby="semantic-heading" class="panel panel-semantics">
          <div>
            <p class="label">Semantic companion</p>
            <h2 id="semantic-heading">Accessible MAN details</h2>
          </div>

          <div class="detail-card">
            <h3>{{ selectedDevice()?.label ?? "Select a metro node" }}</h3>
            <p class="copy">
              {{
                selectedDevice()?.detail ??
                  "Choose a source site or destination endpoint from the controls, or click the canvas to inspect any metro node."
              }}
            </p>

            @if (selectedDevice()) {
              <dl class="detail-list">
                <div>
                  <dt>Role</dt>
                  <dd>{{ selectedDevice()?.role }}</dd>
                </div>
                <div>
                  <dt>Site</dt>
                  <dd>{{ selectedDevice()?.site }}</dd>
                </div>
                <div>
                  <dt>Region</dt>
                  <dd>{{ selectedDevice()?.region }}</dd>
                </div>
                <div>
                  <dt>Tier</dt>
                  <dd>{{ selectedDevice()?.tier }}</dd>
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
            <h3 class="subheading">Path analysis</h3>
            <p class="copy">{{ pathAnalysis() }}</p>
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
                  <span>Site</span>
                  <input
                    type="text"
                    [value]="selectedDevice()?.site ?? ''"
                    (input)="onSiteInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Region</span>
                  <input
                    type="text"
                    [value]="selectedDevice()?.region ?? ''"
                    (input)="onRegionInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Tier</span>
                  <select [value]="selectedDevice()?.tier ?? ''" (change)="onTierChange($event)">
                    @for (tier of deviceTiers; track tier) {
                      <option [value]="tier">{{ tier }}</option>
                    }
                  </select>
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
              <p class="copy">Select a metro site to edit its MAN metadata.</p>
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
              @for (device of activePathDevices(); track device.id) {
                <li>{{ device.label }}</li>
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
                  <span>Priority</span>
                  <input
                    type="number"
                    min="1"
                    [value]="pendingConnectionPriority()"
                    (input)="onPendingConnectionPriorityInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Distance km</span>
                  <input
                    type="number"
                    min="0"
                    [value]="pendingConnectionDistance()"
                    (input)="onPendingConnectionDistanceInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Latency ms</span>
                  <input
                    type="number"
                    min="0"
                    [value]="pendingConnectionLatency()"
                    (input)="onPendingConnectionLatencyInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Jitter ms</span>
                  <input
                    type="number"
                    min="0"
                    [value]="pendingConnectionJitter()"
                    (input)="onPendingConnectionJitterInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Packet loss %</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    [value]="pendingConnectionLoss()"
                    (input)="onPendingConnectionLossInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Bandwidth Mbps</span>
                  <input
                    type="number"
                    min="0"
                    [value]="pendingConnectionBandwidth()"
                    (input)="onPendingConnectionBandwidthInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Provider</span>
                  <input
                    type="text"
                    [value]="pendingConnectionCarrier()"
                    (input)="onPendingConnectionCarrierInput($event)"
                  />
                </label>

                <label class="field">
                  <span>Monthly cost USD</span>
                  <input
                    type="number"
                    min="0"
                    [value]="pendingConnectionCost()"
                    (input)="onPendingConnectionCostInput($event)"
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
              <p class="copy">Select a device to connect it to the rest of the metro network.</p>
            }
          </div>

          <div>
            <h3 class="subheading">Selected device links</h3>

            @if (selectedConnections().length > 0) {
              <ul class="connection-list">
                @for (connection of selectedConnections(); track connection.id) {
                  <li>
                    <span>
                      {{ connection.kind }} to
                      {{
                        labelFor(
                          connection.from === selectedDeviceId() ? connection.to : connection.from
                        )
                      }}
                      via {{ connection.carrier }} ({{ connection.distanceKm }} km,
                      {{ connection.latencyMs }} ms, p{{ connection.priority }})
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
              <p class="copy">The selected device has no direct metro links in this preset.</p>
            }
          </div>

          <div>
            <h3 class="subheading">Active path links</h3>
            <ul class="scope-list">
              @for (connection of activePathConnections(); track connection.id) {
                <li>
                  {{ connection.carrier }} {{ connection.kind }} between
                  {{ labelFor(connection.from) }} and {{ labelFor(connection.to) }} ({{
                    connection.distanceKm
                  }}
                  km, {{ connection.latencyMs }} ms, {{ connection.bandwidthMbps }} Mbps, priority
                  {{ connection.priority }})
                </li>
              }
            </ul>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .man-page {
      padding-bottom: 1.5rem;
    }

    .man-layout {
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

    .preset-list {
      display: grid;
      gap: 0.75rem;
    }

    .preset-button {
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

    .preset-button.is-active {
      border-color: rgba(79, 209, 197, 0.75);
      background: rgba(79, 209, 197, 0.12);
    }

    .preset-button:focus-visible,
    .action-button:focus-visible,
    .link-button:focus-visible,
    .field input:focus-visible,
    .field select:focus-visible,
    .field textarea:focus-visible {
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

    .route-controls {
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
    .scope-list,
    .connection-list {
      margin: 0;
      padding-left: 1.1rem;
      color: #d7e2ef;
      line-height: 1.6;
    }

    .path-list li + li,
    .scope-list li + li,
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
      .man-layout {
        grid-template-columns: 1fr;
      }

      .workspace-header {
        flex-direction: column;
        align-items: start;
      }

      .route-controls,
      .metrics-grid,
      .detail-list,
      .editor-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManPageComponent {
  private readonly state = inject(ManStateService)

  protected readonly deviceKinds: ManDeviceKind[] = [
    "metro-core",
    "building-distribution",
    "access-node",
    "service-handoff",
    "provider-handoff",
  ]
  protected readonly deviceStatuses: ManDeviceStatus[] = ["online", "degraded", "offline"]
  protected readonly deviceTiers: ManDeviceTier[] = ["building", "district", "metro"]
  protected readonly connectionKinds: ManConnectionKind[] = [
    "metro-fiber",
    "metro-ethernet",
    "leased-line",
    "backup-link",
  ]
  protected readonly connectionStrengths: ManConnection["strength"][] = ["strong", "medium", "weak"]
  protected readonly pendingDeviceKind = signal<ManDeviceKind>("building-distribution")
  protected readonly pendingConnectionTarget = signal("")
  protected readonly pendingConnectionKind = signal<ManConnectionKind>("metro-fiber")
  protected readonly pendingConnectionStrength = signal<ManConnection["strength"]>("strong")
  protected readonly pendingConnectionPriority = signal("1")
  protected readonly pendingConnectionDistance = signal("4")
  protected readonly pendingConnectionLatency = signal("18")
  protected readonly pendingConnectionJitter = signal("3")
  protected readonly pendingConnectionLoss = signal("0.1")
  protected readonly pendingConnectionBandwidth = signal("250")
  protected readonly pendingConnectionCarrier = signal("New metro provider")
  protected readonly pendingConnectionCost = signal("2000")

  protected readonly topologies = this.state.topologies
  protected readonly activeTopology = this.state.activeTopology
  protected readonly selectedDevice = this.state.selectedDevice
  protected readonly selectedDeviceId = this.state.selectedDeviceId
  protected readonly sourceDevices = this.state.sourceDevices
  protected readonly endpointDevices = this.state.endpointDevices
  protected readonly sourceDeviceId = this.state.sourceDeviceId
  protected readonly destinationDeviceId = this.state.destinationDeviceId
  protected readonly activePathConnectionIds = this.state.activePathConnectionIds
  protected readonly editableTargets = computed(() =>
    this.activeTopology().devices.filter((device) => device.id !== this.selectedDeviceId()),
  )
  protected readonly activePathDevices = computed(() =>
    this.state
      .activePathDeviceIds()
      .map((deviceId) => ({ id: deviceId, label: this.labelFor(deviceId) })),
  )
  protected readonly activePathLabels = computed(() =>
    this.activePathDevices().map((device) => device.label),
  )
  protected readonly siteCount = computed(
    () =>
      this.activeTopology().devices.filter(
        (device) => device.role === "site" && device.status !== "offline",
      ).length,
  )
  protected readonly serviceCount = computed(
    () =>
      this.activeTopology().devices.filter(
        (device) => device.role === "service" && device.status !== "offline",
      ).length,
  )
  protected readonly activePathConnections = this.state.activePathConnections
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
  protected readonly totalDistanceLabel = computed(() => {
    const totalDistance = this.state.activeDistanceKm()
    return totalDistance === 0 ? "n/a" : `${totalDistance} km`
  })
  protected readonly totalLatencyLabel = computed(() => {
    const totalLatency = this.state.activeLatencyMs()
    return totalLatency === 0 ? "n/a" : `${totalLatency} ms`
  })
  protected readonly totalJitterLabel = computed(() => {
    const totalJitter = this.state.activeJitterMs()
    return totalJitter === 0 ? "n/a" : `${totalJitter} ms`
  })
  protected readonly totalPacketLossLabel = computed(() => {
    const packetLoss = this.state.activePacketLossPct()
    return packetLoss === 0 ? "n/a" : `${packetLoss.toFixed(1)}%`
  })
  protected readonly totalCostLabel = computed(() => {
    const totalCost = this.state.activeCostUsd()
    return totalCost === 0 ? "n/a" : `$${totalCost.toLocaleString()}`
  })
  protected readonly constrainedBandwidthLabel = computed(() => {
    const bandwidth = this.state.activeBandwidthMbps()
    return bandwidth === 0 ? "n/a" : `${bandwidth} Mbps`
  })
  protected readonly carrierSummaryLabel = computed(() => {
    return this.state.carrierSummary()
  })
  protected readonly redundancySummaryLabel = computed(() => this.state.redundancySummary())
  protected readonly serviceCountLabel = computed(() => {
    const services = this.serviceCount()
    return `${services} metro service${services === 1 ? "" : "s"} visible`
  })
  protected readonly sourceLabel = computed(() => this.labelFor(this.sourceDeviceId()))
  protected readonly destinationLabel = computed(() => this.labelFor(this.destinationDeviceId()))
  protected readonly pathState = computed(() => {
    const sourceDeviceId = this.sourceDeviceId()
    const destinationDeviceId = this.destinationDeviceId()

    if (!sourceDeviceId || !destinationDeviceId) {
      return "idle"
    }

    if (sourceDeviceId === destinationDeviceId) {
      return "same-site"
    }

    return this.state.failoverState()
  })
  protected readonly pathSummary = computed(() => {
    const sourceDeviceId = this.sourceDeviceId()
    const destinationDeviceId = this.destinationDeviceId()
    const labels = this.activePathLabels()

    if (!sourceDeviceId || !destinationDeviceId) {
      return "Choose a source site and destination endpoint to inspect the preferred MAN path."
    }

    if (sourceDeviceId === destinationDeviceId) {
      return "Source and destination are the same site, so the MAN path remains local."
    }

    if (this.activePathConnections().length === 0) {
      return "No MAN path is currently available between the selected metro endpoints."
    }

    return `${labels.join(" -> ")} using ${this.pathState()} transport behavior.`
  })
  protected readonly pathAnalysis = computed(() => {
    const pathState = this.pathState()
    const serviceCountLabel = this.serviceCountLabel()

    if (pathState === "blocked") {
      return `The selected metro endpoints are disconnected because the preferred route cannot traverse the available provider handoffs. ${serviceCountLabel}.`
    }

    if (pathState === "same-site") {
      return `Traffic stays local to the selected metro site, so no inter-site MAN transport is required. ${serviceCountLabel}.`
    }

    if (pathState === "idle") {
      return `Choose a source site and destination endpoint to inspect active metro transport decisions. ${serviceCountLabel}.`
    }

    return `State ${pathState}. Resilience ${this.redundancySummaryLabel()}. Total distance ${this.totalDistanceLabel()}, total delay ${this.totalLatencyLabel()}, variance ${this.totalJitterLabel()}, packet loss ${this.totalPacketLossLabel()}, monthly service ${this.totalCostLabel()}, constrained capacity ${this.constrainedBandwidthLabel()}, providers ${this.state.carrierSummary()}, ${serviceCountLabel}, and ${this.activePathConnections().length} metro hops.`
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

  protected addDevice(): void {
    this.state.addDevice(this.pendingDeviceKind())
  }

  protected removeSelectedDevice(): void {
    this.state.removeSelectedDevice()
  }

  protected addOrUpdateConnection(): void {
    const selectedDeviceId = this.selectedDeviceId()
    const targetId = this.pendingConnectionTarget()
    const priority = Number(this.pendingConnectionPriority())
    const distanceKm = Number(this.pendingConnectionDistance())
    const latencyMs = Number(this.pendingConnectionLatency())
    const jitterMs = Number(this.pendingConnectionJitter())
    const packetLossPct = Number(this.pendingConnectionLoss())
    const bandwidthMbps = Number(this.pendingConnectionBandwidth())
    const costUsd = Number(this.pendingConnectionCost())

    if (
      !selectedDeviceId ||
      !targetId ||
      Number.isNaN(priority) ||
      Number.isNaN(distanceKm) ||
      Number.isNaN(latencyMs) ||
      Number.isNaN(jitterMs) ||
      Number.isNaN(packetLossPct) ||
      Number.isNaN(bandwidthMbps) ||
      Number.isNaN(costUsd)
    ) {
      return
    }

    this.state.addOrUpdateManConnection({
      from: selectedDeviceId,
      to: targetId,
      kind: this.pendingConnectionKind(),
      strength: this.pendingConnectionStrength(),
      priority: Math.max(priority, 1),
      distanceKm: Math.max(distanceKm, 0),
      latencyMs: Math.max(latencyMs, 0),
      jitterMs: Math.max(jitterMs, 0),
      packetLossPct: Math.max(packetLossPct, 0),
      bandwidthMbps: Math.max(bandwidthMbps, 0),
      carrier: this.pendingConnectionCarrier().trim() || "New metro provider",
      costUsd: Math.max(costUsd, 0),
    })
  }

  protected removeConnection(connectionId: string): void {
    this.state.removeConnection(connectionId)
  }

  protected onSourceChange(event: Event): void {
    const value = this.selectValue(event)

    if (value) {
      this.state.selectSourceDevice(value)
    }
  }

  protected onDestinationChange(event: Event): void {
    const value = this.selectValue(event)

    if (value && this.endpointDevices().some((device) => device.id === value)) {
      this.state.selectDestinationDevice(value)
      this.state.selectDevice(value)
    }
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

  protected onPendingConnectionPriorityInput(event: Event): void {
    this.setPendingInput(this.pendingConnectionPriority, event)
  }

  protected onPendingConnectionDistanceInput(event: Event): void {
    this.setPendingInput(this.pendingConnectionDistance, event)
  }

  protected onPendingConnectionLatencyInput(event: Event): void {
    this.setPendingInput(this.pendingConnectionLatency, event)
  }

  protected onPendingConnectionJitterInput(event: Event): void {
    this.setPendingInput(this.pendingConnectionJitter, event)
  }

  protected onPendingConnectionLossInput(event: Event): void {
    this.setPendingInput(this.pendingConnectionLoss, event)
  }

  protected onPendingConnectionBandwidthInput(event: Event): void {
    this.setPendingInput(this.pendingConnectionBandwidth, event)
  }

  protected onPendingConnectionCarrierInput(event: Event): void {
    this.setPendingInput(this.pendingConnectionCarrier, event)
  }

  protected onPendingConnectionCostInput(event: Event): void {
    this.setPendingInput(this.pendingConnectionCost, event)
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

  protected onSiteInput(event: Event): void {
    const value = this.inputValue(event)

    if (value !== null) {
      this.state.updateSelectedDevice({ site: value })
    }
  }

  protected onRegionInput(event: Event): void {
    const value = this.inputValue(event)

    if (value !== null) {
      this.state.updateSelectedDevice({ region: value })
    }
  }

  protected onTierChange(event: Event): void {
    const value = this.selectValue(event)

    if (value && this.isDeviceTier(value)) {
      this.state.updateSelectedDevice({ tier: value })
    }
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

  private setPendingInput(targetSignal: { set(value: string): void }, event: Event): void {
    const value = this.inputValue(event)

    if (value !== null) {
      targetSignal.set(value)
    }
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

  private devicePatchForKind(kind: ManDeviceKind): Partial<ManDevice> {
    if (kind === "building-distribution") {
      return {
        kind,
        role: "site",
        tier: "building",
        site: "Metro building",
      }
    }

    if (kind === "provider-handoff") {
      return {
        kind,
        role: "transit",
        tier: "district",
        site: "Provider handoff",
      }
    }

    if (kind === "service-handoff") {
      return {
        kind,
        role: "service",
        tier: "metro",
        site: "Metro service",
      }
    }

    if (kind === "access-node") {
      return {
        kind,
        role: "site",
        tier: "district",
        site: "Access district",
      }
    }

    return {
      kind,
      role: "site",
      tier: "metro",
      site: "Metro core",
    }
  }

  private isDeviceKind(value: string): value is ManDeviceKind {
    return this.deviceKinds.includes(value as ManDeviceKind)
  }

  private isDeviceStatus(value: string): value is ManDeviceStatus {
    return this.deviceStatuses.includes(value as ManDeviceStatus)
  }

  private isDeviceTier(value: string): value is ManDeviceTier {
    return this.deviceTiers.includes(value as ManDeviceTier)
  }

  private isConnectionKind(value: string): value is ManConnectionKind {
    return this.connectionKinds.includes(value as ManConnectionKind)
  }

  private isConnectionStrength(value: string): value is ManConnection["strength"] {
    return this.connectionStrengths.includes(value as ManConnection["strength"])
  }
}
