import { Injectable } from "@angular/core"

import { PanConnection, PanConnectionKind, PanDevice, PanTopology, PanViewport } from "./pan.models"
import { TopologyCanvasRendererService } from "../../shared/network-topology/topology-canvas-renderer.service"

@Injectable({ providedIn: "root" })
export class PanCanvasRendererService extends TopologyCanvasRendererService<
  PanTopology,
  PanDevice,
  PanConnection,
  PanViewport
> {
  render(
    canvas: HTMLCanvasElement,
    topology: PanTopology,
    selectedDeviceId: string | null,
    viewport: PanViewport,
  ): void {
    const canvasState = this.prepareCanvas(canvas)

    if (!canvasState) {
      return
    }

    const { context, width, height } = canvasState

    const background = context.createLinearGradient(0, 0, width, height)
    background.addColorStop(0, "#102238")
    background.addColorStop(1, "#0a1828")
    context.fillStyle = background
    context.fillRect(0, 0, width, height)

    context.save()
    context.translate(viewport.offsetX, viewport.offsetY)
    context.scale(viewport.scale, viewport.scale)

    topology.connections.forEach((connection) => {
      this.drawConnection(context, topology, connection, selectedDeviceId)
    })

    topology.devices.forEach((device) => {
      this.drawDevice(context, device, device.id === selectedDeviceId)
    })

    context.restore()
  }

  private drawConnection(
    context: CanvasRenderingContext2D,
    topology: PanTopology,
    connection: PanConnection,
    selectedDeviceId: string | null,
  ): void {
    const from = topology.devices.find((device) => device.id === connection.from)
    const to = topology.devices.find((device) => device.id === connection.to)

    if (!from || !to) {
      return
    }

    context.save()
    context.strokeStyle = this.connectionStroke(connection.kind, connection.strength)
    context.lineWidth =
      selectedDeviceId && (from.id === selectedDeviceId || to.id === selectedDeviceId) ? 4 : 2.5
    context.setLineDash(connection.kind === "bluetooth" ? [8, 8] : [])
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()

    const middleX = (from.x + to.x) / 2
    const middleY = (from.y + to.y) / 2
    context.fillStyle = "#d7e2ef"
    context.font = "12px ui-sans-serif, system-ui, sans-serif"
    context.textAlign = "center"
    context.fillText(connection.kind.toUpperCase(), middleX, middleY - 10)
    context.restore()
  }

  private drawDevice(
    context: CanvasRenderingContext2D,
    device: PanDevice,
    isSelected: boolean,
  ): void {
    context.save()
    context.beginPath()
    context.fillStyle = this.deviceFill(device.kind)
    context.arc(device.x, device.y, this.deviceRadius, 0, Math.PI * 2)
    context.fill()
    context.lineWidth = isSelected ? 5 : 2
    context.strokeStyle = isSelected ? "#ffe082" : "#f4f8fb"
    context.stroke()

    context.fillStyle = "#08131f"
    context.font = "700 14px ui-sans-serif, system-ui, sans-serif"
    context.textAlign = "center"
    context.fillText(device.kind.slice(0, 2).toUpperCase(), device.x, device.y + 5)

    context.fillStyle = "#f4f8fb"
    context.font = "600 14px ui-sans-serif, system-ui, sans-serif"
    context.fillText(device.label, device.x, device.y + 52)

    context.fillStyle = this.statusFill(device.status)
    context.beginPath()
    context.arc(device.x + 22, device.y - 20, 7, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  private deviceFill(kind: PanDevice["kind"]): string {
    switch (kind) {
      case "phone":
        return "#4fd1c5"
      case "laptop":
        return "#63b3ed"
      case "tablet":
        return "#f6ad55"
      case "watch":
        return "#f687b3"
      case "headset":
        return "#90cdf4"
      case "printer":
        return "#cbd5e0"
      case "hotspot":
        return "#68d391"
    }
  }

  private statusFill(status: PanDevice["status"]): string {
    switch (status) {
      case "online":
        return "#68d391"
      case "idle":
        return "#f6ad55"
      case "offline":
        return "#fc8181"
    }
  }

  private connectionStroke(kind: PanConnectionKind, strength: PanConnection["strength"]): string {
    let alpha = "0.45"

    if (strength === "strong") {
      alpha = "1"
    } else if (strength === "medium") {
      alpha = "0.75"
    }

    switch (kind) {
      case "usb":
        return `rgb(246 173 85 / ${alpha})`
      case "bluetooth":
        return `rgb(79 209 197 / ${alpha})`
      case "wifi":
        return `rgb(99 179 237 / ${alpha})`
      case "tethering":
        return `rgb(252 129 129 / ${alpha})`
    }
  }
}
