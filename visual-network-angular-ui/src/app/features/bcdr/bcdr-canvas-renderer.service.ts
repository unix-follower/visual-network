import { Injectable } from "@angular/core"

import { TopologyCanvasRendererService } from "../../shared/network-topology/topology-canvas-renderer.service"
import { BcdrConnection, BcdrDevice, BcdrTopology, BcdrViewport } from "./bcdr.models"

@Injectable({ providedIn: "root" })
export class BcdrCanvasRendererService extends TopologyCanvasRendererService<
  BcdrTopology,
  BcdrDevice,
  BcdrConnection,
  BcdrViewport
> {
  render(
    canvas: HTMLCanvasElement,
    topology: BcdrTopology,
    selectedDeviceId: string | null,
    viewport: BcdrViewport,
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
    background.addColorStop(0, "#111827")
    background.addColorStop(1, "#03111a")
    context.fillStyle = background
    context.fillRect(0, 0, width, height)

    context.save()
    context.translate(viewport.offsetX, viewport.offsetY)
    context.scale(viewport.scale, viewport.scale)

    topology.connections.forEach((connection) =>
      this.drawConnection(context, topology, connection, selectedDeviceId, false),
    )
    topology.connections
      .filter((connection) => activePathConnectionIds.includes(connection.id))
      .forEach((connection) =>
        this.drawConnection(context, topology, connection, selectedDeviceId, true),
      )

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
    topology: BcdrTopology,
    connection: BcdrConnection,
    selectedDeviceId: string | null,
    isActivePath: boolean,
  ): void {
    const from = topology.devices.find((device) => device.id === connection.from)
    const to = topology.devices.find((device) => device.id === connection.to)

    if (!from || !to) {
      return
    }

    context.save()
    context.strokeStyle = isActivePath ? "#fde68a" : this.connectionStroke(connection)
    context.lineWidth = isActivePath
      ? 6
      : selectedDeviceId && (from.id === selectedDeviceId || to.id === selectedDeviceId)
        ? 4
        : connection.priority === 1
          ? 3.2
          : 2.25

    if (connection.kind === "service-link") {
      context.setLineDash([])
    } else if (connection.kind === "recovery-link") {
      context.setLineDash([10, 6])
    } else if (connection.kind === "replication-link") {
      context.setLineDash([4, 8])
    } else {
      context.setLineDash([2, 10])
    }

    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()

    const middleX = (from.x + to.x) / 2
    const middleY = (from.y + to.y) / 2
    context.fillStyle = isActivePath ? "#fff4be" : "#d1d5db"
    context.font = "12px ui-sans-serif, system-ui, sans-serif"
    context.textAlign = "center"
    context.fillText(
      `${connection.recoveryAction} · ${connection.health} · ${connection.latencyMs} ms`,
      middleX,
      middleY - 10,
    )
    context.restore()
  }

  private drawDevice(
    context: CanvasRenderingContext2D,
    device: BcdrDevice,
    isSelected: boolean,
    isSource: boolean,
    isDestination: boolean,
  ): void {
    context.save()
    context.beginPath()
    context.fillStyle = this.deviceFill(device.kind)
    context.arc(device.x, device.y, this.deviceRadius, 0, Math.PI * 2)
    context.fill()

    let strokeStyle = "#f4f8fb"
    let lineWidth = 2

    if (isDestination) {
      strokeStyle = "#f59e0b"
      lineWidth = 4
    }
    if (isSource) {
      strokeStyle = "#34d399"
      lineWidth = 4
    }
    if (isSelected) {
      strokeStyle = "#fde68a"
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
    context.fillText(device.label, device.x, device.y + 52)

    context.fillStyle = this.statusFill(device.status)
    context.beginPath()
    context.arc(device.x + 22, device.y - 20, 7, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  private deviceAbbreviation(kind: BcdrDevice["kind"]): string {
    switch (kind) {
      case "enterprise-client":
        return "EC"
      case "branch-gateway":
        return "GW"
      case "primary-app":
        return "PR"
      case "recovery-app":
        return "RC"
      case "replication-controller":
        return "CT"
      case "data-vault":
        return "DV"
      default:
        return "ND"
    }
  }

  private deviceFill(kind: BcdrDevice["kind"]): string {
    switch (kind) {
      case "enterprise-client":
        return "#93c5fd"
      case "branch-gateway":
        return "#fdba74"
      case "primary-app":
        return "#86efac"
      case "recovery-app":
        return "#67e8f9"
      case "replication-controller":
        return "#fca5a5"
      case "data-vault":
        return "#c4b5fd"
      default:
        return "#cbd5e0"
    }
  }

  private statusFill(status: BcdrDevice["status"]): string {
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

  private connectionStroke(connection: BcdrConnection): string {
    const alpha =
      connection.strength === "strong" ? "1" : connection.strength === "medium" ? "0.75" : "0.45"
    switch (connection.kind) {
      case "service-link":
        return `rgb(52 211 153 / ${alpha})`
      case "recovery-link":
        return `rgb(245 158 11 / ${alpha})`
      case "replication-link":
        return `rgb(96 165 250 / ${alpha})`
      case "management-link":
        return `rgb(248 113 113 / ${alpha})`
      default:
        return `rgb(203 213 224 / ${alpha})`
    }
  }
}
