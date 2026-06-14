# Visual Networks Angular UI

Interactive Angular and HTML Canvas workspace for teaching network concepts in phased slices.

## Implemented phases

- Phase 1: Personal Area Network (PAN)
- Phase 2: Local Area Network (LAN)
- Phase 3: Routing & Switching
- Phase 4: WLAN
- Phase 5: WAN
- Phase 6: MAN
- Phase 7: SDN
- Phase 8: SAN
- Phase 9: DCN
- Phase 10: CEN
- Phase 11: Network Security
- Phase 12: Network Management & Automation
- Phase 13: Enterprise Network

Each phase follows the same core pattern:

- preset selector for small teaching topologies
- canvas-based interactive workspace with pointer and keyboard controls
- accessible semantic companion panel
- device editing controls
- link editing controls
- focused state and page specs

## Phase 5 WAN scope

The WAN slice models multi-site path selection and carrier failover on top of the shared topology layer.

- branch, headquarters, data-center, cloud, and provider-edge devices
- primary and backup WAN links with latency, jitter, packet loss, bandwidth, carrier, cost, and priority telemetry
- deterministic best-path selection between source and destination sites
- failover and degraded-path summaries
- editable WAN devices and links

## Phase 6 MAN scope

The MAN slice models metro-scale path selection and provider handoff redundancy on top of the shared topology layer.

- metro-core, building-distribution, access-node, service-handoff, and provider-handoff devices
- metro fiber, metro ethernet, leased-line, and backup links with delay, variance, packet loss, capacity, provider, cost, and priority telemetry
- deterministic best-path selection between source sites and destination endpoints
- site and service visibility metrics for each metro topology
- failover, degraded-path, blocked-path, and same-site summaries with accessible metro path analysis
- normalized source and destination reassignment when selected endpoints go offline or presets change
- editable MAN devices and links

## Phase 7 SDN scope

The SDN slice models controller-driven path override on top of the shared topology layer.

- controller, fabric-switch, edge-switch, service-endpoint, and uplink devices
- fabric, overlay, direct, and backup links with delay, variance, packet loss, capacity, transport, cost, and priority telemetry
- controller policy selection for latency, compliance, and resilience intents
- deterministic path recalculation when policy changes override the baseline forwarding path
- controller summaries, override reasoning, and accessible SDN path analysis
- normalized source and destination reassignment when selected endpoints go offline or presets change
- editable SDN devices and links

## Phase 8 SAN scope

The SAN slice models host-to-array storage routing, fabric redundancy, and replica failover on top of the shared topology layer.

- client-node, storage-controller, fabric-switch, storage-target, and backup-storage devices
- fibre-channel, SAS, management, and backup links with latency, jitter, packet loss, throughput, IOPS, fabric, cost, and priority telemetry
- deterministic best-path selection between initiator hosts and storage targets
- replication summaries, failover reasoning, and accessible SAN path analysis
- normalized source and destination reassignment when selected endpoints go offline or presets change
- editable SAN devices and links

## Phase 9 DCN scope

The DCN slice models compute-to-service routing across a compact leaf-spine fabric on top of the shared topology layer.

- compute-node, leaf-switch, spine-switch, and service-node devices
- rack-link, fabric-uplink, and backup-uplink connections with latency, jitter, packet loss, throughput, utilization, fabric, cost, and priority telemetry
- deterministic best-path selection between compute workloads and service destinations
- alternate-spine protection summaries, failover reasoning, and accessible DCN path analysis
- normalized source and destination reassignment when selected endpoints go offline or presets change
- editable DCN devices and links

## Phase 10 CEN scope

The CEN slice models edge-to-cloud service routing, nearest-region selection, and regional failover on top of the shared topology layer.

- edge-workload, edge-gateway, cloud-onramp, cloud-region, and service-endpoint devices
- local-link, edge-uplink, cloud-backbone, and service-link connections with latency, jitter, packet loss, throughput, utilization, carrier, cost, and priority telemetry
- deterministic best-path selection between edge workloads and cloud service endpoints
- nearest-region preference, alternate-region protection summaries, failover reasoning, and accessible CEN path analysis
- normalized source and destination reassignment when selected endpoints go offline or presets change
- editable CEN devices and links

## Phase 11 Network Security scope

The Phase 11 slice introduces an access-control network teaching workspace focused on firewall policy enforcement and inspected service paths on top of the shared topology layer.

- source-host, access-firewall, service-host, and management-station devices
- allowed-link, inspection-link, and blocked-link connections with latency, jitter, packet loss, throughput, utilization, carrier, cost, and priority telemetry
- policy-driven source-to-service path selection with explicit allow, explicit block, and inspection-required outcomes
- zone traversal, rule summaries, protection summaries, and accessible security path analysis
- normalized source and destination reassignment when selected endpoints go offline or presets change
- editable ACN devices and links

## Phase 12 Network Management & Automation scope

The Phase 12 slice introduces a network management and orchestration teaching workspace focused on monitoring-driven fault detection and automated failover on top of the shared topology layer.

- managed-node, automation-controller, health-monitor, backup-gateway, and service-endpoint devices
- primary-link, backup-link, control-link, and monitor-link connections with latency, jitter, packet loss, throughput, utilization, carrier, cost, and priority telemetry
- policy-driven detect-only versus auto-failover behavior for service recovery
- path health, remediation state, backup readiness, MTTR-style summaries, and accessible orchestration analysis
- normalized source and destination reassignment when selected endpoints go offline or presets change
- editable NMO devices and links

## Phase 13 Enterprise Network scope

The Phase 13 slice introduces an enterprise continuity teaching workspace focused on business continuity and disaster recovery on top of the shared topology layer.

- enterprise-client, branch-gateway, primary-app, recovery-app, replication-controller, and data-vault devices
- service-link, recovery-link, replication-link, and management-link connections with latency, jitter, packet loss, throughput, utilization, carrier, cost, and priority telemetry
- policy-driven active-passive protection versus active-active recovery promotion behavior
- standby readiness, replica freshness, RTO and RPO summaries, and accessible continuity analysis
- normalized source and destination reassignment when selected endpoints go offline or presets change
- editable BCDR devices and links

## Development

Install dependencies and run the Angular development server with the usual project workflow:

```bash
npm install
npm start
```

If you prefer the Angular CLI directly:

```bash
ng serve
```

## Validation

In this workspace, the local `node_modules/.bin` shims have been unreliable, so use the direct TypeScript entrypoint for validation:

```bash
node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.spec.json
```

For focused WAN and MAN behavior regressions, run the Angular CLI entrypoint directly:

```bash
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/wan/wan-state.service.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/wan/wan-page.component.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/man/man-state.service.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/man/man-page.component.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/sdn/sdn-state.service.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/sdn/sdn-page.component.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/san/san-state.service.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/san/san-page.component.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/dcn/dcn-state.service.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/dcn/dcn-page.component.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/cen/cen-state.service.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/cen/cen-page.component.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/acn/acn-state.service.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/acn/acn-page.component.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/nmo/nmo-state.service.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/nmo/nmo-page.component.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/bcdr/bcdr-state.service.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/features/bcdr/bcdr-page.component.spec.ts
node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/app.spec.ts
```

The TypeScript commands validate the application and spec code, and the focused Angular commands execute the WAN, MAN, SDN, SAN, DCN, CEN, ACN, NMO, BCDR, and shell regressions.

Phase 13 progress is currently validated with the direct TypeScript entrypoints, the BCDR state and page suites, and the shell regression suite.

## Project structure

- `src/app/shared/network-topology/` shared topology models, state, and canvas helpers
- `src/app/features/pan/` PAN workspace
- `src/app/features/lan/` LAN workspace
- `src/app/features/routing-switching/` Routing & Switching workspace
- `src/app/features/wlan/` WLAN workspace
- `src/app/features/wan/` WAN workspace
- `src/app/features/man/` MAN workspace
- `src/app/features/sdn/` SDN workspace
- `src/app/features/san/` SAN workspace
- `src/app/features/dcn/` DCN workspace
- `src/app/features/cen/` CEN workspace
- `src/app/features/acn/` ACN workspace
- `src/app/features/nmo/` NMO workspace
- `src/app/features/bcdr/` BCDR workspace

## Current focus

Phases 1 through 13 are implemented through a first BCDR teaching slice covering enterprise continuity, standby readiness, and deterministic recovery-site promotion.
