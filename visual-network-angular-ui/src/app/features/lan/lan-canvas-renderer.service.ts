import { Injectable } from "@angular/core"

import { LanConnection, LanConnectionKind, LanDevice, LanTopology, LanViewport } from "./lan.models"
import { TopologyCanvasRendererService } from "../../shared/network-topology/topology-canvas-renderer.service"

@Injectable({ providedIn: "root" })
export class LanCanvasRendererService extends TopologyCanvasRendererService<
  LanTopology,
  LanDevice,
  LanConnection,
  LanViewport
> {
  render(
    canvas: HTMLCanvasElement,
    topology: LanTopology,
    selectedDeviceId: string | null,
    viewport: LanViewport,
  ): void {
    const canvasState = this.prepareCanvas(canvas)

    if (!canvasState) {
      return
    }

    const { context, width, height } = canvasState

    const background = context.createLinearGradient(0, 0, width, height)
    background.addColorStop(0, "#16304b")
    background.addColorStop(1, "#09111c")
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
    topology: LanTopology,
    connection: LanConnection,
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

    if (connection.kind === "wireless") {
      context.setLineDash([8, 8])
    } else if (connection.kind === "trunk") {
      context.setLineDash([16, 8])
    } else {
      context.setLineDash([])
    }

    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()

    const middleX = (from.x + to.x) / 2
    const middleY = (from.y + to.y) / 2
    context.fillStyle = "#dce8f3"
    context.font = "12px ui-sans-serif, system-ui, sans-serif"
    context.textAlign = "center"
    context.fillText(connection.kind.toUpperCase(), middleX, middleY - 10)
    context.restore()
  }

  private drawDevice(
    context: CanvasRenderingContext2D,
    device: LanDevice,
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

  private deviceAbbreviation(kind: LanDevice["kind"]): string {
    switch (kind) {
      case "router":
        return "RT"
      case "switch":
        return "SW"
      case "access-point":
        return "AP"
      case "server":
        return "SV"
      case "workstation":
        return "WS"
      case "printer":
        return "PR"
    }
  }

  private deviceFill(kind: LanDevice["kind"]): string {
    switch (kind) {
      case "router":
        return "#f6ad55"
      case "switch":
        return "#63b3ed"
      case "access-point":
        return "#4fd1c5"
      case "server":
        return "#90cdf4"
      case "workstation":
        return "#cbd5e0"
      case "printer":
        return "#f687b3"
    }
  }

  private statusFill(status: LanDevice["status"]): string {
    switch (status) {
      case "online":
        return "#68d391"
      case "degraded":
        return "#f6ad55"
      case "offline":
        return "#fc8181"
    }
  }

  private connectionStroke(kind: LanConnectionKind, strength: LanConnection["strength"]): string {
    let alpha = "0.45"

    if (strength === "strong") {
      alpha = "1"
    } else if (strength === "medium") {
      alpha = "0.75"
    }

    switch (kind) {
      case "ethernet":
        return `rgb(99 179 237 / ${alpha})`
      case "trunk":
        return `rgb(144 205 244 / ${alpha})`
      case "wireless":
        return `rgb(79 209 197 / ${alpha})`
      case "uplink":
        return `rgb(246 173 85 / ${alpha})`
    }
  }
}
