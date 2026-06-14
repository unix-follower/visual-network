import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core"

import { RoutingSwitchingCanvasComponent } from "./routing-switching-canvas.component"
import { RoutingSwitchingStateService } from "./routing-switching-state.service"

@Component({
  selector: "app-routing-switching-page",
  imports: [RoutingSwitchingCanvasComponent],
  template: `
    <section class="routing-page">
      <div class="routing-layout">
        <aside aria-labelledby="preset-heading" class="panel panel-overview">
          <div>
            <p class="label">Phase 3</p>
            <h2 id="preset-heading">Routing presets</h2>
            <p class="copy">
              Routing and Switching now builds on the shared topology foundation with a canonical
              path between selected endpoints.
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
              <p class="label">Interactive route</p>
              <h2>{{ activeTopology().name }}</h2>
            </div>
            <p class="copy workspace-summary">{{ activeTopology().summary }}</p>
          </div>

          <div class="metrics-grid" aria-label="Route summary">
            <div class="metric-card">
              <span class="metric-label">Devices</span>
              <strong>{{ activeTopology().devices.length }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Hops</span>
              <strong>{{ hopCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Path status</span>
              <strong>{{ pathStatus() }}</strong>
            </div>
          </div>

          <div class="route-controls">
            <label class="field">
              <span>Source</span>
              <select [value]="sourceDeviceId() ?? ''" (change)="onSourceChange($event)">
                @for (device of endpointDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.segment }}</option>
                }
              </select>
            </label>

            <label class="field">
              <span>Destination</span>
              <select [value]="destinationDeviceId() ?? ''" (change)="onDestinationChange($event)">
                @for (device of endpointDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.segment }}</option>
                }
              </select>
            </label>
          </div>

          <p class="copy control-hint">
            Pointer: click a node, drag to pan, wheel to zoom. Keyboard: arrows change device,
            Shift+arrows move the view, + and - adjust zoom, 0 resets the viewport. The highlighted
            route follows the selected source and destination.
          </p>

          <app-routing-switching-canvas
            [topology]="activeTopology()"
            [selectedDeviceId]="selectedDeviceId()"
            [sourceDeviceId]="sourceDeviceId()"
            [destinationDeviceId]="destinationDeviceId()"
            [activePathConnectionIds]="activePathConnectionIds()"
            (deviceSelected)="selectDevice($event)"
          />

          <div class="path-card">
            <span class="status-label">Active path</span>
            <strong>{{ sourceLabel() }} -> {{ destinationLabel() }}</strong>
            <p class="copy">{{ pathSummary() }}</p>
          </div>
        </div>

        <aside aria-labelledby="semantic-heading" class="panel panel-scope">
          <div>
            <p class="label">Semantic companion</p>
            <h2 id="semantic-heading">Accessible route details</h2>
          </div>

          <div class="detail-card">
            <h3>{{ selectedDevice()?.label ?? "Select a device" }}</h3>
            <p class="copy">
              {{ selectedDevice()?.detail ?? "Choose a device from the list or click the canvas." }}
            </p>

            @if (selectedDevice()) {
              <dl class="detail-list">
                <div>
                  <dt>Role</dt>
                  <dd>{{ selectedDevice()?.role }}</dd>
                </div>
                <div>
                  <dt>Segment</dt>
                  <dd>{{ selectedDevice()?.segment }}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{{ selectedDevice()?.status }}</dd>
                </div>
              </dl>
            }
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
                  <span class="copy">{{ device.role }} · {{ device.segment }}</span>
                </button>
              }
            </div>
          </div>

          <div>
            <h3 class="subheading">Path links</h3>
            <ul class="scope-list">
              @for (connection of activePathConnections(); track connection.id) {
                <li>
                  {{ connection.kind }} between {{ labelFor(connection.from) }} and
                  {{ labelFor(connection.to) }} (metric {{ connection.metric }},
                  {{ connection.strength }})
                </li>
              }
            </ul>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .routing-page {
      padding-bottom: 1.5rem;
    }

    .routing-layout {
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
    .field select:focus-visible {
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
    .detail-card {
      display: grid;
      gap: 0.65rem;
      padding: 1rem;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.04);
    }

    .status-label,
    .metric-label,
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

    .field select {
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

    .path-list,
    .scope-list {
      margin: 0;
      padding-left: 1.1rem;
      color: #d7e2ef;
      line-height: 1.6;
    }

    .scope-list li + li,
    .path-list li + li {
      margin-top: 0.55rem;
    }

    @media (max-width: 1180px) {
      .routing-layout {
        grid-template-columns: 1fr;
      }

      .workspace-header {
        flex-direction: column;
        align-items: start;
      }

      .route-controls,
      .metrics-grid,
      .detail-list {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutingSwitchingPageComponent {
  private readonly state = inject(RoutingSwitchingStateService)

  protected readonly topologies = this.state.topologies
  protected readonly activeTopology = this.state.activeTopology
  protected readonly selectedDevice = this.state.selectedDevice
  protected readonly selectedDeviceId = this.state.selectedDeviceId
  protected readonly endpointDevices = this.state.endpointDevices
  protected readonly sourceDeviceId = this.state.sourceDeviceId
  protected readonly destinationDeviceId = this.state.destinationDeviceId
  protected readonly activePathConnectionIds = this.state.activePathConnectionIds
  protected readonly activePathLabels = computed(() =>
    this.state.activePathDeviceIds().map((deviceId) => this.labelFor(deviceId)),
  )
  protected readonly activePathConnections = computed(() => {
    const activeConnectionIds = new Set(this.activePathConnectionIds())
    return this.activeTopology().connections.filter((connection) =>
      activeConnectionIds.has(connection.id),
    )
  })
  protected readonly hopCount = computed(() => Math.max(this.activePathLabels().length - 1, 0))
  protected readonly pathStatus = computed(() => {
    const connections = this.activePathConnections()

    if (connections.length === 0) {
      return "idle"
    }

    return connections.some((connection) => connection.strength !== "strong")
      ? "degraded"
      : "active"
  })
  protected readonly sourceLabel = computed(() => this.labelFor(this.sourceDeviceId()))
  protected readonly destinationLabel = computed(() => this.labelFor(this.destinationDeviceId()))
  protected readonly pathSummary = computed(() => {
    const labels = this.activePathLabels()

    if (labels.length === 0) {
      return "Choose source and destination endpoints to inspect the canonical route."
    }

    if (labels.length === 1) {
      return "Source and destination are the same endpoint, so no routed handoff is required."
    }

    return `${labels.join(" -> ")} with ${this.hopCount()} hops.`
  })

  protected selectTopology(topologyId: string): void {
    this.state.selectTopology(topologyId)
  }

  protected selectDevice(deviceId: string | null): void {
    this.state.selectDevice(deviceId)
  }

  protected onSourceChange(event: Event): void {
    const value = this.selectValue(event)

    if (value) {
      this.state.selectSourceDevice(value)
    }
  }

  protected onDestinationChange(event: Event): void {
    const value = this.selectValue(event)

    if (value) {
      this.state.selectDestinationDevice(value)
    }
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

    return target.value
  }
}
