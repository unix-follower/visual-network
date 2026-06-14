import { Injectable } from "@angular/core"

import { TopologyCanvasRendererService } from "../../shared/network-topology/topology-canvas-renderer.service"
import { WlanConnection, WlanDevice, WlanTopology, WlanViewport } from "./wlan.models"

@Injectable({ providedIn: "root" })
export class WlanCanvasRendererService extends TopologyCanvasRendererService<
  WlanTopology,
  WlanDevice,
  WlanConnection,
  WlanViewport
> {
  render(
    canvas: HTMLCanvasElement,
    topology: WlanTopology,
    selectedDeviceId: string | null,
    viewport: WlanViewport,
    highlightedAccessPointId: string | null,
    activePathConnectionIds: string[],
  ): void {
    const canvasState = this.prepareCanvas(canvas)

    if (!canvasState) {
      return
    }

    const { context, width, height } = canvasState
    const background = context.createLinearGradient(0, 0, width, height)
    background.addColorStop(0, "#0d2033")
    background.addColorStop(1, "#071019")
    context.fillStyle = background
    context.fillRect(0, 0, width, height)

    context.save()
    context.translate(viewport.offsetX, viewport.offsetY)
    context.scale(viewport.scale, viewport.scale)

    topology.devices
      .filter((device) => device.kind === "access-point")
      .forEach((device) =>
        this.drawCoverage(context, device, device.id === highlightedAccessPointId),
      )

    topology.connections.forEach((connection) => {
      this.drawConnection(
        context,
        topology,
        connection,
        selectedDeviceId,
        activePathConnectionIds.includes(connection.id),
      )
    })

    topology.devices.forEach((device) => {
      this.drawDevice(
        context,
        device,
        device.id === selectedDeviceId,
        device.id === highlightedAccessPointId,
        activePathConnectionIds.some((connectionId) => connectionId.includes(device.id)),
      )
    })

    context.restore()
  }

  private drawCoverage(
    context: CanvasRenderingContext2D,
    device: WlanDevice,
    isHighlighted: boolean,
  ): void {
    if (device.coverageRadius <= 0) {
      return
    }

    context.save()
    context.beginPath()
    context.fillStyle = isHighlighted ? "rgb(79 209 197 / 0.16)" : "rgb(99 179 237 / 0.10)"
    context.strokeStyle = isHighlighted ? "rgb(79 209 197 / 0.55)" : "rgb(99 179 237 / 0.24)"
    context.lineWidth = isHighlighted ? 3 : 1.5
    context.arc(device.x, device.y, device.coverageRadius, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.restore()
  }

  private drawConnection(
    context: CanvasRenderingContext2D,
    topology: WlanTopology,
    connection: WlanConnection,
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

    let lineWidth = connection.kind === "wireless-link" ? 2 : 3

    if (selectedDeviceId && (from.id === selectedDeviceId || to.id === selectedDeviceId)) {
      lineWidth += 1.5
    }

    if (isActivePath) {
      lineWidth = 5.5
    }

    context.lineWidth = lineWidth

    if (connection.kind === "wireless-link") {
      context.setLineDash([9, 8])
    } else if (connection.kind === "mesh-backhaul") {
      context.setLineDash([16, 7])
    } else {
      context.setLineDash([])
    }

    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()

    const middleX = (from.x + to.x) / 2
    const middleY = (from.y + to.y) / 2
    const label =
      connection.kind === "wireless-link"
        ? `${connection.rssi} dBm`
        : `${connection.throughputMbps} Mbps`
    context.fillStyle = isActivePath ? "#fff4be" : "#d7e2ef"
    context.font = "12px ui-sans-serif, system-ui, sans-serif"
    context.textAlign = "center"
    context.fillText(label, middleX, middleY - 10)
    context.restore()
  }

  private drawDevice(
    context: CanvasRenderingContext2D,
    device: WlanDevice,
    isSelected: boolean,
    isHighlightedAccessPoint: boolean,
    isOnActivePath: boolean,
  ): void {
    const radius = device.kind === "client" ? this.deviceRadius - 6 : this.deviceRadius

    context.save()
    context.beginPath()
    context.fillStyle = this.deviceFill(device.kind)
    context.arc(device.x, device.y, radius, 0, Math.PI * 2)
    context.fill()

    let strokeStyle = "#f4f8fb"

    if (isOnActivePath) {
      strokeStyle = "#68d391"
    }

    if (isHighlightedAccessPoint) {
      strokeStyle = "#4fd1c5"
    }

    if (isSelected) {
      strokeStyle = "#ffe082"
    }

    let lineWidth = 2

    if (isHighlightedAccessPoint || isOnActivePath) {
      lineWidth = 4
    }

    if (isSelected) {
      lineWidth = 5
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
    context.fillText(device.label, device.x, device.y + radius + 24)

    context.fillStyle = this.statusFill(device.status)
    context.beginPath()
    context.arc(device.x + radius - 4, device.y - radius + 7, 7, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  private deviceAbbreviation(kind: WlanDevice["kind"]): string {
    switch (kind) {
      case "access-point":
        return "AP"
      case "client":
        return "CL"
      case "controller":
        return "CT"
      case "gateway":
        return "GW"
    }
  }

  private deviceFill(kind: WlanDevice["kind"]): string {
    switch (kind) {
      case "access-point":
        return "#63b3ed"
      case "client":
        return "#e2e8f0"
      case "controller":
        return "#4fd1c5"
      case "gateway":
        return "#f6ad55"
    }
  }

  private statusFill(status: WlanDevice["status"]): string {
    switch (status) {
      case "online":
        return "#68d391"
      case "degraded":
        return "#f6ad55"
      case "offline":
        return "#fc8181"
    }
  }

  private connectionStroke(connection: WlanConnection): string {
    if (connection.kind === "wireless-link") {
      if (connection.rssi >= -58) {
        return "rgb(104 211 145 / 0.9)"
      }

      if (connection.rssi >= -67) {
        return "rgb(246 173 85 / 0.82)"
      }

      return "rgb(252 129 129 / 0.75)"
    }

    if (connection.kind === "mesh-backhaul") {
      return "rgb(79 209 197 / 0.78)"
    }

    return "rgb(144 205 244 / 0.82)"
  }
}
