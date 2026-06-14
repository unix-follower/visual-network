import { Injectable } from "@angular/core"

import { TopologyCanvasRendererService } from "../../shared/network-topology/topology-canvas-renderer.service"
import { CenConnection, CenDevice, CenTopology, CenViewport } from "./cen.models"

@Injectable({ providedIn: "root" })
export class CenCanvasRendererService extends TopologyCanvasRendererService<
  CenTopology,
  CenDevice,
  CenConnection,
  CenViewport
> {
  render(
    canvas: HTMLCanvasElement,
    topology: CenTopology,
    selectedDeviceId: string | null,
    viewport: CenViewport,
    sourceDeviceId: string | null,
    destinationDeviceId: string | null,
    activePathConnectionIds: string[],
  ): void {
    const canvasState = this.prepareCanvas(canvas)

    if (!canvasState) {
      return
    }

    const { context, width, height } = canvasState
    const background = context.createLinearGradient(0, 0, width, height)
    background.addColorStop(0, "#10263a")
    background.addColorStop(1, "#08121b")
    context.fillStyle = background
    context.fillRect(0, 0, width, height)

    context.save()
    context.translate(viewport.offsetX, viewport.offsetY)
    context.scale(viewport.scale, viewport.scale)

    topology.connections.forEach((connection) => {
      this.drawConnection(context, topology, connection, selectedDeviceId, false)
    })

    topology.connections
      .filter((connection) => activePathConnectionIds.includes(connection.id))
      .forEach((connection) => {
        this.drawConnection(context, topology, connection, selectedDeviceId, true)
      })

    topology.devices.forEach((device) => {
      this.drawDevice(
        context,
        device,
        device.id === selectedDeviceId,
        device.id === sourceDeviceId,
        device.id === destinationDeviceId,
      )
    })

    context.restore()
  }

  private drawConnection(
    context: CanvasRenderingContext2D,
    topology: CenTopology,
    connection: CenConnection,
    selectedDeviceId: string | null,
    isActivePath: boolean,
  ): void {
    const from = topology.devices.find((device) => device.id === connection.from)
    const to = topology.devices.find((device) => device.id === connection.to)

    if (!from || !to) {
      return
    }

    context.save()
    context.strokeStyle = isActivePath ? "#ffe082" : this.connectionStroke(connection)

    let lineWidth = 2.25

    if (connection.priority === 1) {
      lineWidth = 3.2
    }

    if (selectedDeviceId && (from.id === selectedDeviceId || to.id === selectedDeviceId)) {
      lineWidth = 4
    }

    if (isActivePath) {
      lineWidth = 6
    }

    context.lineWidth = lineWidth

    if (connection.kind === "local-link") {
      context.setLineDash([])
    } else if (connection.kind === "edge-uplink") {
      context.setLineDash(connection.priority > 1 ? [8, 10] : [16, 6])
    } else {
      context.setLineDash([4, 6])
    }

    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()

    const middleX = (from.x + to.x) / 2
    const middleY = (from.y + to.y) / 2
    const label = `${connection.carrier} · ${connection.latencyMs} ms · ${connection.throughputMBps} MB/s`
    context.fillStyle = isActivePath ? "#fff4be" : "#d7e2ef"
    context.font = "12px ui-sans-serif, system-ui, sans-serif"
    context.textAlign = "center"
    context.fillText(label, middleX, middleY - 10)
    context.restore()
  }

  private drawDevice(
    context: CanvasRenderingContext2D,
    device: CenDevice,
    isSelected: boolean,
    isSource: boolean,
    isDestination: boolean,
  ): void {
    context.save()
    context.beginPath()
    context.fillStyle = this.deviceFill(device.kind)
    context.arc(device.x, device.y, this.deviceRadius, 0, Math.PI * 2)
    context.fill()

    let lineWidth = 2

    if (isSource || isDestination) {
      lineWidth = 4
    }

    if (isSelected) {
      lineWidth = 5
    }

    let strokeStyle = "#f4f8fb"

    if (isDestination) {
      strokeStyle = "#f6ad55"
    }

    if (isSource) {
      strokeStyle = "#68d391"
    }

    if (isSelected) {
      strokeStyle = "#ffe082"
    }

    context.lineWidth = lineWidth
    context.strokeStyle = strokeStyle
    context.stroke()

    context.fillStyle = "#08131f"
    context.font = "700 12px ui-sans-serif, system-ui, sans-serif"
    context.textAlign = "center"
    context.fillText(this.deviceAbbreviation(device.kind), device.x, device.y + 4)

    context.fillStyle = "#f4f8fb"
    context.font = "600 14px ui-sans-serif, system-ui, sans-serif"
    context.fillText(device.label, device.x, device.y + 52)

    context.fillStyle = this.statusFill(device.status)
    context.beginPath()
    context.arc(device.x + 22, device.y - 20, 7, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  private deviceAbbreviation(kind: CenDevice["kind"]): string {
    switch (kind) {
      case "edge-workload":
        return "ED"
      case "edge-gateway":
        return "GW"
      case "cloud-onramp":
        return "ON"
      case "cloud-region":
        return "RG"
      case "service-endpoint":
        return "SV"
      default:
        return "ND"
    }
  }

  private deviceFill(kind: CenDevice["kind"]): string {
    switch (kind) {
      case "edge-workload":
        return "#90cdf4"
      case "edge-gateway":
        return "#4fd1c5"
      case "cloud-onramp":
        return "#fbd38d"
      case "cloud-region":
        return "#f6ad55"
      case "service-endpoint":
        return "#9ae6b4"
      default:
        return "#cbd5e0"
    }
  }

  private statusFill(status: CenDevice["status"]): string {
    switch (status) {
      case "online":
        return "#68d391"
      case "degraded":
        return "#f6ad55"
      case "offline":
        return "#fc8181"
      default:
        return "#fc8181"
    }
  }

  private connectionStroke(connection: CenConnection): string {
    let alpha = "0.45"

    if (connection.strength === "strong") {
      alpha = "1"
    }

    if (connection.strength === "medium") {
      alpha = "0.75"
    }

    switch (connection.kind) {
      case "local-link":
        return `rgb(144 205 244 / ${alpha})`
      case "edge-uplink":
        return `rgb(79 209 197 / ${alpha})`
      case "cloud-backbone":
        return `rgb(192 132 252 / ${alpha})`
      case "service-link":
        return `rgb(154 230 180 / ${alpha})`
      default:
        return `rgb(203 213 224 / ${alpha})`
    }
  }
}
