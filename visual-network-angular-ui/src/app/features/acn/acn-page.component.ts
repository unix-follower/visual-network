import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core"

import { AcnCanvasComponent } from "./acn-canvas.component"
import { AcnStateService } from "./acn-state.service"

@Component({
  selector: "app-acn-page",
  imports: [AcnCanvasComponent],
  template: `
    <section class="acn-page">
      <div class="acn-layout">
        <aside aria-labelledby="preset-heading" class="panel panel-overview">
          <div>
            <p class="label">Phase 11</p>
            <h2 id="preset-heading">Security presets</h2>
            <p class="copy">
              Network security controls shape which application paths remain reachable. This first
              slice focuses on firewall-enforced zone segmentation, explicit allow rules, and
              deterministic block outcomes.
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
              <p class="label">Interactive security workspace</p>
              <h2>{{ activeTopology().name }}</h2>
            </div>
            <p class="copy workspace-summary">{{ activeTopology().summary }}</p>
          </div>

          <div class="metrics-grid" aria-label="Security summary">
            <div class="metric-card">
              <span class="metric-label">Source hosts</span><strong>{{ sourceCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Protected services</span
              ><strong>{{ serviceCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Enforcement points</span
              ><strong>{{ enforcementCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Matched rule</span><strong>{{ ruleSummary() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Latency</span><strong>{{ totalLatencyLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Jitter</span><strong>{{ totalJitterLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Packet loss</span
              ><strong>{{ totalPacketLossLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Path cost</span><strong>{{ totalCostLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Throughput</span
              ><strong>{{ constrainedThroughputLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Peak utilization</span
              ><strong>{{ activeUtilizationLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Path state</span><strong>{{ pathState() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Resilience</span
              ><strong>{{ redundancySummaryLabel() }}</strong>
            </div>
            <div class="metric-card metric-card-wide">
              <span class="metric-label">Security path</span
              ><strong>{{ carrierSummaryLabel() }}</strong>
            </div>
            <div class="metric-card metric-card-wide">
              <span class="metric-label">Zone traversal</span
              ><strong>{{ zoneSummaryLabel() }}</strong>
            </div>
            <div class="metric-card metric-card-wide">
              <span class="metric-label">Protection status</span
              ><strong>{{ protectionSummaryLabel() }}</strong>
            </div>
          </div>

          <div class="route-controls">
            <label class="field">
              <span>Source host</span>
              <select [value]="sourceDeviceId() ?? ''" (change)="onSourceChange($event)">
                @for (device of sourceDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.zone }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Destination service</span>
              <select [value]="destinationDeviceId() ?? ''" (change)="onDestinationChange($event)">
                @for (device of endpointDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.zone }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Policy intent</span>
              <select [value]="selectedPolicyId() ?? ''" (change)="onPolicyChange($event)">
                @for (policy of policies(); track policy.id) {
                  <option [value]="policy.id">{{ policy.label }}</option>
                }
              </select>
            </label>
          </div>

          <p class="copy control-hint">
            Pointer: click a security node, drag to pan, wheel to zoom. Keyboard: arrows change
            focus, Shift+arrows move the view, + and - adjust zoom, 0 resets the viewport.
          </p>

          <app-acn-canvas
            [topology]="activeTopology()"
            [selectedDeviceId]="selectedDeviceId()"
            [sourceDeviceId]="sourceDeviceId()"
            [destinationDeviceId]="destinationDeviceId()"
            [activePathConnectionIds]="activePathConnectionIds()"
            (deviceSelected)="selectDevice($event)"
          />

          <div class="path-card">
            <span class="status-label">Active security path</span>
            <strong>{{ sourceLabel() }} -> {{ destinationLabel() }}</strong>
            <p class="copy">{{ pathSummary() }}</p>
          </div>
        </div>

        <aside aria-labelledby="semantic-heading" class="panel panel-semantics">
          <div>
            <p class="label">Semantic companion</p>
            <h2 id="semantic-heading">Accessible security details</h2>
          </div>

          <div class="detail-card">
            <h3>{{ selectedDevice()?.label ?? "Select a security node" }}</h3>
            <p class="copy">
              {{
                selectedDevice()?.detail ??
                  "Choose a source host, firewall, or service node to inspect the active policy context."
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
                  <dt>Zone</dt>
                  <dd>{{ selectedDevice()?.zone }}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{{ selectedDevice()?.status }}</dd>
                </div>
              </dl>
            }
          </div>

          <div class="association-card">
            <h3 class="subheading">Policy analysis</h3>
            <p class="copy">{{ pathAnalysis() }}</p>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .acn-page {
      padding-bottom: 1.5rem;
    }
    .acn-layout {
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
      color: #f59e0b;
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
      border-color: rgba(245, 158, 11, 0.75);
      background: rgba(245, 158, 11, 0.12);
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
      .acn-layout {
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
export class AcnPageComponent {
  private readonly state = inject(AcnStateService)

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
  protected readonly enforcementCount = computed(() => this.state.enforcementDevices().length)
  protected readonly ruleSummary = computed(() => this.state.ruleSummary())
  protected readonly redundancySummaryLabel = computed(() => this.state.redundancySummary())
  protected readonly protectionSummaryLabel = computed(() => this.state.protectionSummary())
  protected readonly carrierSummaryLabel = computed(() => this.state.carrierSummary())
  protected readonly zoneSummaryLabel = computed(() => this.state.zoneSummary())
  protected readonly totalLatencyLabel = computed(() =>
    this.state.activeLatencyMs() === 0 ? "n/a" : `${this.state.activeLatencyMs()} ms`,
  )
  protected readonly totalJitterLabel = computed(() =>
    this.state.activeJitterMs() === 0 ? "n/a" : `${this.state.activeJitterMs()} ms`,
  )
  protected readonly totalPacketLossLabel = computed(() =>
    this.state.activePacketLossPct() === 0
      ? "n/a"
      : `${this.state.activePacketLossPct().toFixed(1)}%`,
  )
  protected readonly totalCostLabel = computed(() =>
    this.state.activeCostUsd() === 0 ? "n/a" : `$${this.state.activeCostUsd().toLocaleString()}`,
  )
  protected readonly constrainedThroughputLabel = computed(() =>
    this.state.activeThroughputMBps() === 0 ? "n/a" : `${this.state.activeThroughputMBps()} MB/s`,
  )
  protected readonly activeUtilizationLabel = computed(() =>
    this.state.activeUtilizationPct() === 0 ? "n/a" : `${this.state.activeUtilizationPct()}%`,
  )
  protected readonly pathState = computed(() => this.state.failoverState())
  protected readonly sourceLabel = computed(() => this.labelFor(this.sourceDeviceId()))
  protected readonly destinationLabel = computed(() => this.labelFor(this.destinationDeviceId()))
  protected readonly pathSummary = computed(() => {
    const labels = this.activePathDeviceIds().map((deviceId) => this.labelFor(deviceId))
    if (labels.length === 0) {
      return "Choose a source host and protected service to inspect the active policy path."
    }
    return `${labels.join(" -> ")}. ${this.state.overrideReason()} ${this.protectionSummaryLabel()}.`
  })
  protected readonly pathAnalysis = computed(
    () =>
      `${this.state.overrideReason()} Zones traversed: ${this.zoneSummaryLabel()}. Resilience ${this.redundancySummaryLabel().toLowerCase()}.`,
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
