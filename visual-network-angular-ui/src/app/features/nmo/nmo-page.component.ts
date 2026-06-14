import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core"

import { NmoCanvasComponent } from "./nmo-canvas.component"
import { NmoStateService } from "./nmo-state.service"

@Component({
  selector: "app-nmo-page",
  imports: [NmoCanvasComponent],
  template: `
    <section class="nmo-page">
      <div class="nmo-layout">
        <aside aria-labelledby="preset-heading" class="panel panel-overview">
          <div>
            <p class="label">Phase 12</p>
            <h2 id="preset-heading">Automation presets</h2>
            <p class="copy">
              Network management and automation controls decide when faults remain visible to
              operators and when the platform should heal the path automatically. This first slice
              focuses on monitor-driven detection, deterministic failover policy, and clear
              remediation state.
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
              <p class="label">Interactive orchestration workspace</p>
              <h2>{{ activeTopology().name }}</h2>
            </div>
            <p class="copy workspace-summary">{{ activeTopology().summary }}</p>
          </div>

          <div class="metrics-grid" aria-label="Automation summary">
            <div class="metric-card">
              <span class="metric-label">Managed sources</span><strong>{{ sourceCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Service endpoints</span
              ><strong>{{ serviceCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Controllers</span><strong>{{ controllerCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Automation policy</span
              ><strong>{{ ruleSummary() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Path health</span><strong>{{ pathHealthLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Remediation state</span
              ><strong>{{ remediationStateLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Active action</span
              ><strong>{{ actionSummaryLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Backup readiness</span
              ><strong>{{ backupReadinessLabel() }}</strong>
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
              <span class="metric-label">Throughput</span
              ><strong>{{ constrainedThroughputLabel() }}</strong>
            </div>
            <div class="metric-card metric-card-wide">
              <span class="metric-label">Transport path</span
              ><strong>{{ carrierSummaryLabel() }}</strong>
            </div>
            <div class="metric-card metric-card-wide">
              <span class="metric-label">Domain traversal</span
              ><strong>{{ domainSummaryLabel() }}</strong>
            </div>
            <div class="metric-card metric-card-wide">
              <span class="metric-label">Recovery summary</span
              ><strong>{{ remediationSummaryLabel() }}</strong>
            </div>
          </div>

          <div class="route-controls">
            <label class="field">
              <span>Managed source</span>
              <select [value]="sourceDeviceId() ?? ''" (change)="onSourceChange($event)">
                @for (device of sourceDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.domain }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Service endpoint</span>
              <select [value]="destinationDeviceId() ?? ''" (change)="onDestinationChange($event)">
                @for (device of endpointDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.domain }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Automation policy</span>
              <select [value]="selectedPolicyId() ?? ''" (change)="onPolicyChange($event)">
                @for (policy of policies(); track policy.id) {
                  <option [value]="policy.id">{{ policy.label }}</option>
                }
              </select>
            </label>
          </div>

          <p class="copy control-hint">
            Pointer: click an orchestration node, drag to pan, wheel to zoom. Keyboard: arrows
            change focus, Shift+arrows move the view, + and - adjust zoom, 0 resets the viewport.
          </p>

          <app-nmo-canvas
            [topology]="activeTopology()"
            [selectedDeviceId]="selectedDeviceId()"
            [sourceDeviceId]="sourceDeviceId()"
            [destinationDeviceId]="destinationDeviceId()"
            [activePathConnectionIds]="activePathConnectionIds()"
            (deviceSelected)="selectDevice($event)"
          />

          <div class="path-card">
            <span class="status-label">Active remediation path</span>
            <strong>{{ sourceLabel() }} -> {{ destinationLabel() }}</strong>
            <p class="copy">{{ pathSummary() }}</p>
          </div>
        </div>

        <aside aria-labelledby="semantic-heading" class="panel panel-semantics">
          <div>
            <p class="label">Semantic companion</p>
            <h2 id="semantic-heading">Accessible orchestration details</h2>
          </div>

          <div class="detail-card">
            <h3>{{ selectedDevice()?.label ?? "Select an automation node" }}</h3>
            <p class="copy">
              {{
                selectedDevice()?.detail ??
                  "Choose a managed node, controller, monitor, backup gateway, or service endpoint to inspect the active orchestration context."
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
            <h3 class="subheading">Automation analysis</h3>
            <p class="copy">{{ pathAnalysis() }}</p>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .nmo-page {
      padding-bottom: 1.5rem;
    }
    .nmo-layout {
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
      color: #fb7185;
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
      border-color: rgba(251, 113, 133, 0.75);
      background: rgba(251, 113, 133, 0.12);
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
      .nmo-layout {
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
export class NmoPageComponent {
  private readonly state = inject(NmoStateService)

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
  protected readonly pathHealthLabel = computed(() => this.state.pathHealthSummary())
  protected readonly remediationStateLabel = computed(() => this.state.remediationState())
  protected readonly actionSummaryLabel = computed(() => this.state.actionSummary())
  protected readonly backupReadinessLabel = computed(() => this.state.backupReadiness())
  protected readonly carrierSummaryLabel = computed(() => this.state.carrierSummary())
  protected readonly domainSummaryLabel = computed(() => this.state.domainSummary())
  protected readonly remediationSummaryLabel = computed(() => this.state.remediationSummary())
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
  protected readonly constrainedThroughputLabel = computed(() =>
    this.state.activeThroughputMBps() === 0 ? "n/a" : `${this.state.activeThroughputMBps()} MB/s`,
  )
  protected readonly sourceLabel = computed(() => this.labelFor(this.sourceDeviceId()))
  protected readonly destinationLabel = computed(() => this.labelFor(this.destinationDeviceId()))
  protected readonly pathSummary = computed(() => {
    const labels = this.activePathDeviceIds().map((deviceId) => this.labelFor(deviceId))
    if (labels.length === 0) {
      return "Choose a managed source and service endpoint to inspect the active orchestration path."
    }
    return `${labels.join(" -> ")}. ${this.state.remediationSummary()} ${this.state.mttrSummary()}`
  })
  protected readonly pathAnalysis = computed(
    () =>
      `${this.state.remediationSummary()} Domains traversed: ${this.state.domainSummary()}. ${this.state.mttrSummary()}`,
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
