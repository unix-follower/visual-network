import { Injectable } from "@angular/core"

import { TopologyCanvasRendererService } from "../../shared/network-topology/topology-canvas-renderer.service"
import { WanConnection, WanDevice, WanTopology, WanViewport } from "./wan.models"

@Injectable({ providedIn: "root" })
export class WanCanvasRendererService extends TopologyCanvasRendererService<
  WanTopology,
  WanDevice,
  WanConnection,
  WanViewport
> {
  render(
    canvas: HTMLCanvasElement,
    topology: WanTopology,
    selectedDeviceId: string | null,
    viewport: WanViewport,
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
    background.addColorStop(1, "#071019")
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
    topology: WanTopology,
    connection: WanConnection,
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

    let lineWidth = 2.5

    if (connection.priority === 1) {
      lineWidth = 3.4
    }

    if (selectedDeviceId && (from.id === selectedDeviceId || to.id === selectedDeviceId)) {
      lineWidth = 4
    }

    if (isActivePath) {
      lineWidth = 6
    }

    context.lineWidth = lineWidth

    if (connection.kind === "mpls") {
      context.setLineDash([18, 8])
    } else if (connection.kind === "backup-link") {
      context.setLineDash([8, 10])
    } else if (connection.kind === "internet-vpn") {
      context.setLineDash([4, 8])
    } else {
      context.setLineDash([])
    }

    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()

    const middleX = (from.x + to.x) / 2
    const middleY = (from.y + to.y) / 2
    context.fillStyle = isActivePath ? "#fff4be" : "#d7e2ef"
    context.font = "12px ui-sans-serif, system-ui, sans-serif"
    context.textAlign = "center"
    context.fillText(`${connection.carrier} · ${connection.latencyMs} ms`, middleX, middleY - 10)
    context.restore()
  }

  private drawDevice(
    context: CanvasRenderingContext2D,
    device: WanDevice,
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

  private deviceAbbreviation(kind: WanDevice["kind"]): string {
    switch (kind) {
      case "branch":
        return "BR"
      case "headquarters":
        return "HQ"
      case "data-center":
        return "DC"
      case "cloud":
        return "CL"
      case "provider-edge":
        return "PE"
    }
  }

  private deviceFill(kind: WanDevice["kind"]): string {
    switch (kind) {
      case "branch":
        return "#90cdf4"
      case "headquarters":
        return "#4fd1c5"
      case "data-center":
        return "#63b3ed"
      case "cloud":
        return "#f6ad55"
      case "provider-edge":
        return "#cbd5e0"
    }
  }

  private statusFill(status: WanDevice["status"]): string {
    switch (status) {
      case "online":
        return "#68d391"
      case "degraded":
        return "#f6ad55"
      case "offline":
        return "#fc8181"
    }
  }

  private connectionStroke(connection: WanConnection): string {
    let alpha = "0.45"

    if (connection.strength === "strong") {
      alpha = "1"
    }

    if (connection.strength === "medium") {
      alpha = "0.75"
    }

    switch (connection.kind) {
      case "mpls":
        return `rgb(79 209 197 / ${alpha})`
      case "internet-vpn":
        return `rgb(246 173 85 / ${alpha})`
      case "direct-connect":
        return `rgb(99 179 237 / ${alpha})`
      case "backup-link":
        return `rgb(203 213 224 / ${alpha})`
    }
  }
}
