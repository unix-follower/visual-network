import { TestBed } from "@angular/core/testing"

import { ManStateService } from "./man-state.service"

describe("ManStateService", () => {
  let service: ManStateService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(ManStateService)
  })

  it("starts with the preferred primary MAN path for the default preset", () => {
    expect(service.sourceDeviceId()).toBe("north-tower")
    expect(service.destinationDeviceId()).toBe("metro-core")
    expect(service.activePathDeviceIds()).toEqual(["north-tower", "provider-primary", "metro-core"])
    expect(service.activePathConnectionIds()).toEqual([
      "north-tower-provider-primary",
      "provider-primary-metro-core",
    ])
    expect(service.failoverState()).toBe("primary")
    expect(service.redundancySummary()).toBe("Protected")
    expect(service.activeDistanceKm()).toBe(6)
    expect(service.activeLatencyMs()).toBe(7)
    expect(service.carrierSummary()).toBe("Metro Fiber A")
  })

  it("marks the second preset path as degraded when a transit or site is degraded", () => {
    service.selectTopology("city-handoff-mesh")

    expect(service.sourceDeviceId()).toBe("harbor-campus")
    expect(service.destinationDeviceId()).toBe("innovation-hub")
    expect(service.activePathConnectionIds()).toEqual([
      "harbor-campus-provider-west",
      "provider-west-innovation-hub",
    ])
    expect(service.failoverState()).toBe("degraded")
    expect(service.redundancySummary()).toBe("Primary degraded")
    expect(service.activeDistanceKm()).toBe(11)
    expect(service.activeLatencyMs()).toBe(11)
    expect(service.carrierSummary()).toBe("Metro Mesh West")
  })

  it("focuses the normalized source site when selecting a MAN preset even if topology device order changes", () => {
    service.topologies.update((topologies) =>
      topologies.map((topology) =>
        topology.id === "city-handoff-mesh"
          ? {
              ...topology,
              devices: [
                topology.devices.find((device) => device.id === "media-exchange")!,
                ...topology.devices.filter((device) => device.id !== "media-exchange"),
              ],
            }
          : topology,
      ),
    )

    service.selectTopology("city-handoff-mesh")

    expect(service.sourceDeviceId()).toBe("harbor-campus")
    expect(service.destinationDeviceId()).toBe("innovation-hub")
    expect(service.selectedDeviceId()).toBe("harbor-campus")
  })

  it("fails over to the backup MAN path when the primary provider handoff goes offline", () => {
    service.selectDevice("provider-primary")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.activePathDeviceIds()).toEqual(["north-tower", "provider-backup", "metro-core"])
    expect(service.activePathConnectionIds()).toEqual([
      "north-tower-provider-backup",
      "provider-backup-metro-core",
    ])
    expect(service.failoverState()).toBe("failover")
    expect(service.redundancySummary()).toBe("Backup active")
    expect(service.activeDistanceKm()).toBe(11)
    expect(service.activeLatencyMs()).toBe(15)
    expect(service.carrierSummary()).toBe("Metro Ethernet B")
  })

  it("keeps the downstream metro service reachable over failover when the primary provider handoff goes offline", () => {
    service.selectDestinationDevice("metro-dc")
    service.selectDevice("provider-primary")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.activePathDeviceIds()).toEqual([
      "north-tower",
      "provider-backup",
      "metro-core",
      "metro-dc",
    ])
    expect(service.activePathConnectionIds()).toEqual([
      "north-tower-provider-backup",
      "provider-backup-metro-core",
      "metro-core-metro-dc",
    ])
    expect(service.failoverState()).toBe("failover")
    expect(service.activeDistanceKm()).toBe(19)
    expect(service.activeLatencyMs()).toBe(20)
    expect(service.activeBandwidthMbps()).toBe(400)
    expect(service.carrierSummary()).toBe("Metro Ethernet B, Civic Dark Fiber")
  })

  it("marks the MAN path as blocked when distinct endpoints have no remaining transport path", () => {
    service.selectDevice("provider-primary")
    service.updateSelectedDevice({ status: "offline" })
    service.selectDevice("provider-backup")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.sourceDeviceId()).toBe("north-tower")
    expect(service.destinationDeviceId()).toBe("metro-core")
    expect(service.activePathDeviceIds()).toEqual(["north-tower"])
    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.failoverState()).toBe("blocked")
    expect(service.redundancySummary()).toBe("No resilience")
    expect(service.carrierSummary()).toBe("No metro providers active.")
  })

  it("keeps the MAN route local when source and destination are the same site", () => {
    service.selectDestinationDevice("north-tower")

    expect(service.sourceDeviceId()).toBe("north-tower")
    expect(service.destinationDeviceId()).toBe("north-tower")
    expect(service.activePathDeviceIds()).toEqual(["north-tower"])
    expect(service.activePathConnectionIds()).toEqual([])
    expect(service.failoverState()).toBe("idle")
    expect(service.redundancySummary()).toBe("Local route")
    expect(service.activeLatencyMs()).toBe(0)
    expect(service.activeCostUsd()).toBe(0)
  })

  it("updates MAN link telemetry when editing an existing path edge", () => {
    service.addOrUpdateManConnection({
      from: "north-tower",
      to: "provider-backup",
      kind: "backup-link",
      strength: "weak",
      distanceKm: 12,
      latencyMs: 12,
      jitterMs: 4,
      packetLossPct: 0.6,
      bandwidthMbps: 320,
      carrier: "Metro Ethernet B",
      costUsd: 1400,
      priority: 3,
    })

    const updatedConnection = service
      .activeTopology()
      .connections.find((connection) => connection.id === "north-tower-provider-backup")

    expect(updatedConnection).toBeDefined()
    expect(updatedConnection?.kind).toBe("backup-link")
    expect(updatedConnection?.strength).toBe("weak")
    expect(updatedConnection?.distanceKm).toBe(12)
    expect(updatedConnection?.latencyMs).toBe(12)
    expect(updatedConnection?.bandwidthMbps).toBe(320)
    expect(updatedConnection?.costUsd).toBe(1400)
    expect(updatedConnection?.priority).toBe(3)
  })

  it("reassigns MAN endpoints when the current source site becomes offline", () => {
    service.selectDevice("north-tower")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.sourceDevices().map((device) => device.id)).toEqual([
      "metro-core",
      "south-campus",
    ])
    expect(service.endpointDevices().map((device) => device.id)).toEqual([
      "metro-core",
      "south-campus",
      "metro-dc",
    ])
    expect(service.sourceDeviceId()).toBe("metro-core")
    expect(service.destinationDeviceId()).toBe("south-campus")
    expect(service.selectedDeviceId()).toBe("metro-core")
    expect(service.activePathDeviceIds()).toEqual(["metro-core", "south-campus"])
  })

  it("reassigns the selected MAN destination when the current destination endpoint goes offline", () => {
    service.selectDestinationDevice("metro-dc")
    service.selectDevice("metro-dc")
    service.updateSelectedDevice({ status: "offline" })

    expect(service.endpointDevices().map((device) => device.id)).toEqual([
      "north-tower",
      "metro-core",
      "south-campus",
    ])
    expect(service.sourceDeviceId()).toBe("north-tower")
    expect(service.destinationDeviceId()).toBe("metro-core")
    expect(service.selectedDeviceId()).toBe("metro-core")
    expect(service.activePathDeviceIds()).toEqual(["north-tower", "provider-primary", "metro-core"])
  })

  it("ignores service handoffs when selecting a MAN source site", () => {
    service.selectSourceDevice("metro-dc")

    expect(service.sourceDevices().map((device) => device.id)).toEqual([
      "north-tower",
      "metro-core",
      "south-campus",
    ])
    expect(service.sourceDeviceId()).toBe("north-tower")
  })

  it("ignores transit handoffs when selecting a MAN destination endpoint", () => {
    service.selectDestinationDevice("provider-primary")

    expect(service.endpointDevices().map((device) => device.id)).toEqual([
      "north-tower",
      "metro-core",
      "south-campus",
      "metro-dc",
    ])
    expect(service.destinationDeviceId()).toBe("metro-core")
  })
})
