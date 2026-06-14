import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core"

import { CenCanvasComponent } from "./cen-canvas.component"
import { CenStateService } from "./cen-state.service"

@Component({
  selector: "app-cen-page",
  imports: [CenCanvasComponent],
  template: `
    <section class="cen-page">
      <div class="cen-layout">
        <aside aria-labelledby="preset-heading" class="panel panel-overview">
          <div>
            <p class="label">Phase 10</p>
            <h2 id="preset-heading">CEN presets</h2>
            <p class="copy">
              Cloud and edge networks keep local workloads close to users while steering application
              traffic into the healthiest cloud region with deterministic regional failover.
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
              <p class="label">Interactive cloud and edge workspace</p>
              <h2>{{ activeTopology().name }}</h2>
            </div>
            <p class="copy workspace-summary">{{ activeTopology().summary }}</p>
          </div>

          <div class="metrics-grid" aria-label="CEN summary">
            <div class="metric-card">
              <span class="metric-label">Edge sites</span>
              <strong>{{ sourceCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Cloud services</span>
              <strong>{{ serviceCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Cloud regions</span>
              <strong>{{ regionCount() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Routing policy</span>
              <strong>{{ policySummary() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Latency</span>
              <strong>{{ totalLatencyLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Jitter</span>
              <strong>{{ totalJitterLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Packet loss</span>
              <strong>{{ totalPacketLossLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Path cost</span>
              <strong>{{ totalCostLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Throughput</span>
              <strong>{{ constrainedThroughputLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Peak utilization</span>
              <strong>{{ activeUtilizationLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Path state</span>
              <strong>{{ pathState() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Redundancy</span>
              <strong>{{ redundancySummaryLabel() }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Active links</span>
              <strong>{{ carrierSummaryLabel() }}</strong>
            </div>
            <div class="metric-card metric-card-wide">
              <span class="metric-label">Region summary</span>
              <strong>{{ controllerSummary() }}</strong>
            </div>
            <div class="metric-card metric-card-wide">
              <span class="metric-label">Protection status</span>
              <strong>{{ protectionSummaryLabel() }}</strong>
            </div>
          </div>

          <div class="route-controls">
            <label class="field">
              <span>Edge source</span>
              <select [value]="sourceDeviceId() ?? ''" (change)="onSourceChange($event)">
                @for (device of sourceDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.region }}</option>
                }
              </select>
            </label>

            <label class="field">
              <span>Cloud destination</span>
              <select [value]="destinationDeviceId() ?? ''" (change)="onDestinationChange($event)">
                @for (device of endpointDevices(); track device.id) {
                  <option [value]="device.id">{{ device.label }} · {{ device.region }}</option>
                }
              </select>
            </label>

            <label class="field">
              <span>Routing intent</span>
              <select [value]="selectedPolicyId() ?? ''" (change)="onPolicyChange($event)">
                @for (policy of policies(); track policy.id) {
                  <option [value]="policy.id">{{ policy.label }}</option>
                }
              </select>
            </label>
          </div>

          <p class="copy control-hint">
            Pointer: click a CEN node, drag to pan, wheel to zoom. Keyboard: arrows change focus,
            Shift+arrows move the view, + and - adjust zoom, 0 resets the viewport. The highlighted
            path shows the active edge-to-cloud route across gateway, region, and service tiers.
          </p>

          <app-cen-canvas
            [topology]="activeTopology()"
            [selectedDeviceId]="selectedDeviceId()"
            [sourceDeviceId]="sourceDeviceId()"
            [destinationDeviceId]="destinationDeviceId()"
            [activePathConnectionIds]="activePathConnectionIds()"
            (deviceSelected)="selectDevice($event)"
          />

          <div class="path-card">
            <span class="status-label">Active CEN path</span>
            <strong>{{ sourceLabel() }} -> {{ destinationLabel() }}</strong>
            <p class="copy">{{ pathSummary() }}</p>
          </div>
        </div>

        <aside aria-labelledby="semantic-heading" class="panel panel-semantics">
          <div>
            <p class="label">Semantic companion</p>
            <h2 id="semantic-heading">Accessible cloud and edge details</h2>
          </div>

          <div class="detail-card">
            <h3>{{ selectedDevice()?.label ?? "Select a CEN node" }}</h3>
            <p class="copy">
              {{
                selectedDevice()?.detail ??
                  "Choose an edge workload, service endpoint, or click the canvas to inspect any cloud and edge node in the topology."
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
                  <dd>{{ selectedDevice()?.zone ?? "n/a" }}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{{ selectedDevice()?.status }}</dd>
                </div>
              </dl>
            }
          </div>

          <div class="association-card">
            <h3 class="subheading">Path analysis</h3>
            <p class="copy">{{ pathAnalysis() }}</p>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .cen-page {
      padding-bottom: 1.5rem;
    }

    .cen-layout {
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
      .cen-layout {
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
export class CenPageComponent {
  private readonly state = inject(CenStateService)

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
  protected readonly regionCount = computed(
    () =>
      this.activeTopology().devices.filter(
        (device) => device.role === "cloud" && device.status !== "offline",
      ).length,
  )
  protected readonly controllerSummary = computed(() => this.state.controllerSummary())
  protected readonly policySummary = computed(() => this.state.policySummary())
  protected readonly redundancySummaryLabel = computed(() => this.state.redundancySummary())
  protected readonly protectionSummaryLabel = computed(() => this.state.replicationSummary())
  protected readonly carrierSummaryLabel = computed(() => this.state.carrierSummary())
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
  protected readonly constrainedThroughputLabel = computed(() => {
    const throughput = this.state.activeThroughputMBps()
    return throughput === 0 ? "n/a" : `${throughput} MB/s`
  })
  protected readonly activeUtilizationLabel = computed(() => {
    const utilization = this.state.activeUtilizationPct()
    return utilization === 0 ? "n/a" : `${utilization}%`
  })
  protected readonly pathState = computed(() => this.state.failoverState())
  protected readonly sourceLabel = computed(() => this.labelFor(this.sourceDeviceId()))
  protected readonly destinationLabel = computed(() => this.labelFor(this.destinationDeviceId()))
  protected readonly pathSummary = computed(() => {
    const labels = this.activePathDeviceIds().map((deviceId) => this.labelFor(deviceId))

    if (labels.length === 0) {
      return "Choose an edge source and cloud service to inspect the active path."
    }

    return `${labels.join(" -> ")}. ${this.state.failoverReason()} ${this.protectionSummaryLabel()}.`
  })
  protected readonly pathAnalysis = computed(
    () =>
      `${this.state.failoverReason()} Redundancy ${this.redundancySummaryLabel().toLowerCase()}. Peak utilization ${this.activeUtilizationLabel()}.`,
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
}
