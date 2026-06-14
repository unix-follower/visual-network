import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core"

import { BcdrCanvasComponent } from "./bcdr-canvas.component"
import { BcdrStateService } from "./bcdr-state.service"

@Component({
  selector: "app-bcdr-page",
  imports: [BcdrCanvasComponent],
  template: `
    <section class="bcdr-page">
      <div class="bcdr-layout">
        <aside aria-labelledby="preset-heading" class="panel panel-overview">
          <div>
            <p class="label">Phase 13</p>
            <h2 id="preset-heading">Enterprise continuity presets</h2>
            <p class="copy">
              Enterprise networks must keep business applications available across sites. This first
              slice focuses on recovery readiness, replica health, and deterministic promotion of a
              recovery application when the primary site can no longer serve traffic.
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
              <p class="label">Interactive continuity workspace</p>
              <h2>{{ activeTopology().name }}</h2>
            </div>
            <p class="copy workspace-summary">{{ activeTopology().summary }}</p>
          </div>

          <div class="metrics-grid" aria-label="Enterprise continuity summary">
            <div class="metric-card">
              <span class="metric-label">Enterprise sources</span
              ><strong>{{ sourceCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Application sites</span
              ><strong>{{ serviceCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Controllers</span><strong>{{ controllerCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Recovery strategy</span
              ><strong>{{ ruleSummary() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Primary health</span
              ><strong>{{ primaryHealthLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Recovery state</span
              ><strong>{{ recoveryStateLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Active action</span
              ><strong>{{ actionSummaryLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Standby readiness</span
              ><strong>{{ standbyReadinessLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Sync status</span><strong>{{ syncSummaryLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Latency</span><strong>{{ totalLatencyLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Jitter</span><strong>{{ totalJitterLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Throughput</span
              ><strong>{{ constrainedThroughputLabel() }}</strong>
            </div>
            <div class="metric-card metric-card-wide">
              <span class="metric-label">Continuity transport</span
              ><strong>{{ carrierSummaryLabel() }}</strong>
            </div>
            <div class="metric-card metric-card-wide">
              <span class="metric-label">Site traversal</span
              ><strong>{{ siteSummaryLabel() }}</strong>
            </div>
            <div class="metric-card metric-card-wide">
              <span class="metric-label">Readiness summary</span
              ><strong>{{ readinessSummaryLabel() }}</strong>
            </div>
          </div>

          <div class="route-controls">
            <label class="field">
              <span>Enterprise source</span>
              <select [value]="sourceDeviceId() ?? ''" (change)="onSourceChange($event)">
                @for (device of sourceDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.domain }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Application site</span>
              <select [value]="destinationDeviceId() ?? ''" (change)="onDestinationChange($event)">
                @for (device of endpointDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.region }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Recovery strategy</span>
              <select [value]="selectedPolicyId() ?? ''" (change)="onPolicyChange($event)">
                @for (policy of policies(); track policy.id) {
                  <option [value]="policy.id">{{ policy.label }}</option>
                }
              </select>
            </label>
          </div>

          <p class="copy control-hint">
            Pointer: click an enterprise continuity node, drag to pan, wheel to zoom. Keyboard:
            arrows change focus, Shift+arrows move the view, + and - adjust zoom, 0 resets the
            viewport.
          </p>

          <app-bcdr-canvas
            [topology]="activeTopology()"
            [selectedDeviceId]="selectedDeviceId()"
            [sourceDeviceId]="sourceDeviceId()"
            [destinationDeviceId]="destinationDeviceId()"
            [activePathConnectionIds]="activePathConnectionIds()"
            (deviceSelected)="selectDevice($event)"
          />

          <div class="path-card">
            <span class="status-label">Active continuity path</span>
            <strong>{{ sourceLabel() }} -> {{ destinationLabel() }}</strong>
            <p class="copy">{{ pathSummary() }}</p>
          </div>
        </div>

        <aside aria-labelledby="semantic-heading" class="panel panel-semantics">
          <div>
            <p class="label">Semantic companion</p>
            <h2 id="semantic-heading">Accessible enterprise details</h2>
          </div>

          <div class="detail-card">
            <h3>{{ selectedDevice()?.label ?? "Select a continuity node" }}</h3>
            <p class="copy">
              {{
                selectedDevice()?.detail ??
                  "Choose a user, gateway, application, controller, or vault node to inspect the active continuity context."
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
                  <dt>Domain</dt>
                  <dd>{{ selectedDevice()?.domain }}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{{ selectedDevice()?.status }}</dd>
                </div>
              </dl>
            }
          </div>

          <div class="association-card">
            <h3 class="subheading">Continuity analysis</h3>
            <p class="copy">{{ pathAnalysis() }}</p>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .bcdr-page {
      padding-bottom: 1.5rem;
    }
    .bcdr-layout {
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
      color: #60a5fa;
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
      border-color: rgba(96, 165, 250, 0.75);
      background: rgba(96, 165, 250, 0.12);
    }
    .preset-button:focus-visible,
    .field select:focus-visible {
      outline: 3px solid #fde68a;
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
    .metric-card-wide {
      grid-column: span 2;
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
      grid-template-columns: repeat(3, minmax(0, 1fr));
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
    @media (max-width: 1180px) {
      .bcdr-layout {
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
      .metric-card-wide {
        grid-column: auto;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BcdrPageComponent {
  private readonly state = inject(BcdrStateService)

  protected readonly topologies = this.state.topologies
  protected readonly activeTopology = this.state.activeTopology
  protected readonly selectedDevice = this.state.selectedDevice
  protected readonly selectedDeviceId = this.state.selectedDeviceId
  protected readonly sourceDevices = this.state.sourceDevices
  protected readonly endpointDevices = this.state.endpointDevices
  protected readonly policies = computed(() => this.activeTopology().policies)
  protected readonly sourceDeviceId = this.state.sourceDeviceId
  protected readonly destinationDeviceId = this.state.destinationDeviceId
  protected readonly selectedPolicyId = this.state.selectedPolicyId
  protected readonly activePathConnectionIds = this.state.activePathConnectionIds
  protected readonly activePathDeviceIds = this.state.activePathDeviceIds
  protected readonly sourceCount = computed(() => this.sourceDevices().length)
  protected readonly serviceCount = computed(() => this.endpointDevices().length)
  protected readonly controllerCount = computed(() => this.state.controllerDevices().length)
  protected readonly ruleSummary = computed(() => this.state.ruleSummary())
  protected readonly primaryHealthLabel = computed(() => this.state.primarySiteHealth())
  protected readonly recoveryStateLabel = computed(() => this.state.recoveryState())
  protected readonly actionSummaryLabel = computed(() => this.state.actionSummary())
  protected readonly standbyReadinessLabel = computed(() => this.state.standbyReadiness())
  protected readonly syncSummaryLabel = computed(() => this.state.syncSummary())
  protected readonly carrierSummaryLabel = computed(() => this.state.carrierSummary())
  protected readonly siteSummaryLabel = computed(() => this.state.siteSummary())
  protected readonly readinessSummaryLabel = computed(() => this.state.readinessSummary())
  protected readonly totalLatencyLabel = computed(() =>
    this.state.activeLatencyMs() === 0 ? "n/a" : `${this.state.activeLatencyMs()} ms`,
  )
  protected readonly totalJitterLabel = computed(() =>
    this.state.activeJitterMs() === 0 ? "n/a" : `${this.state.activeJitterMs()} ms`,
  )
  protected readonly constrainedThroughputLabel = computed(() =>
    this.state.activeThroughputMBps() === 0 ? "n/a" : `${this.state.activeThroughputMBps()} MB/s`,
  )
  protected readonly sourceLabel = computed(() => this.labelFor(this.sourceDeviceId()))
  protected readonly destinationLabel = computed(() => this.labelFor(this.destinationDeviceId()))
  protected readonly pathSummary = computed(() => {
    const labels = this.activePathDeviceIds().map((deviceId) => this.labelFor(deviceId))
    if (labels.length === 0) {
      return "Choose an enterprise source and application site to inspect the active continuity path."
    }
    return `${labels.join(" -> ")}. ${this.state.readinessSummary()} ${this.state.rtoSummary()} ${this.state.rpoSummary()}`
  })
  protected readonly pathAnalysis = computed(
    () =>
      `${this.state.readinessSummary()} Sites traversed: ${this.state.siteSummary()}. ${this.state.rtoSummary()} ${this.state.rpoSummary()}`,
  )

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
    if (value && this.endpointDevices().some((device) => device.id === value)) {
      this.state.selectDestinationDevice(value)
      this.state.selectDevice(value)
    }
  }
  protected onPolicyChange(event: Event): void {
    const value = this.selectValue(event)
    if (value) {
      this.state.selectPolicy(value)
    }
  }
  protected labelFor(deviceId: string | null): string {
    return deviceId
      ? (this.activeTopology().devices.find((device) => device.id === deviceId)?.label ?? deviceId)
      : "Unset"
  }

  private selectValue(event: Event): string | null {
    const target = event.target
    return target instanceof HTMLSelectElement ? target.value || null : null
  }
}
