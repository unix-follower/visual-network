import { Injectable } from "@angular/core"

import { TopologyCanvasRendererService } from "../../shared/network-topology/topology-canvas-renderer.service"
import {
  RoutingSwitchingConnection,
  RoutingSwitchingDevice,
  RoutingSwitchingTopology,
  RoutingSwitchingViewport,
} from "./routing-switching.models"

@Injectable({ providedIn: "root" })
export class RoutingSwitchingCanvasRendererService extends TopologyCanvasRendererService<
  RoutingSwitchingTopology,
  RoutingSwitchingDevice,
  RoutingSwitchingConnection,
  RoutingSwitchingViewport
> {
  render(
    canvas: HTMLCanvasElement,
    topology: RoutingSwitchingTopology,
    selectedDeviceId: string | null,
    viewport: RoutingSwitchingViewport,
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
    background.addColorStop(0, "#14263d")
    background.addColorStop(1, "#081018")
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
    topology: RoutingSwitchingTopology,
    connection: RoutingSwitchingConnection,
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

    if (selectedDeviceId && (from.id === selectedDeviceId || to.id === selectedDeviceId)) {
      lineWidth = 4
    }

    if (isActivePath) {
      lineWidth = 6
    }

    context.lineWidth = lineWidth

    if (connection.kind === "trunk") {
      context.setLineDash([14, 8])
    } else if (connection.kind === "wan-link") {
      context.setLineDash([10, 10])
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
    context.fillText(
      `${connection.kind.toUpperCase()} · ${connection.metric}`,
      middleX,
      middleY - 10,
    )
    context.restore()
  }

  private drawDevice(
    context: CanvasRenderingContext2D,
    device: RoutingSwitchingDevice,
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

  private deviceAbbreviation(kind: RoutingSwitchingDevice["kind"]): string {
    switch (kind) {
      case "router":
        return "RT"
      case "switch":
        return "SW"
      case "core-switch":
        return "CS"
      case "workstation":
        return "WS"
      case "server":
        return "SV"
    }
  }

  private deviceFill(kind: RoutingSwitchingDevice["kind"]): string {
    switch (kind) {
      case "router":
        return "#f6ad55"
      case "switch":
        return "#63b3ed"
      case "core-switch":
        return "#4fd1c5"
      case "workstation":
        return "#cbd5e0"
      case "server":
        return "#90cdf4"
    }
  }

  private statusFill(status: RoutingSwitchingDevice["status"]): string {
    switch (status) {
      case "online":
        return "#68d391"
      case "degraded":
        return "#f6ad55"
      case "offline":
        return "#fc8181"
    }
  }

  private connectionStroke(connection: RoutingSwitchingConnection): string {
    let alpha = "0.45"

    if (connection.strength === "strong") {
      alpha = "1"
    } else if (connection.strength === "medium") {
      alpha = "0.75"
    }

    switch (connection.kind) {
      case "ethernet":
        return `rgb(99 179 237 / ${alpha})`
      case "trunk":
        return `rgb(144 205 244 / ${alpha})`
      case "routed-link":
        return `rgb(79 209 197 / ${alpha})`
      case "wan-link":
        return `rgb(246 173 85 / ${alpha})`
    }
  }
}
