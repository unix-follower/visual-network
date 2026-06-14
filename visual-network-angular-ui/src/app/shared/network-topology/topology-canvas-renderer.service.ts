import {
  TopologyBase,
  TopologyConnectionBase,
  TopologyDeviceBase,
  TopologyViewport,
} from "./topology.models"

const DEVICE_RADIUS = 28
const DIRECTION_MATCH_WEIGHT = 1000

export type NavigationDirection = "left" | "right" | "up" | "down"

export abstract class TopologyCanvasRendererService<
  TTopology extends TopologyBase<TDevice, TConnection>,
  TDevice extends TopologyDeviceBase,
  TConnection extends TopologyConnectionBase,
  TViewport extends TopologyViewport,
> {
  pickDevice(
    canvas: HTMLCanvasElement,
    topology: TTopology,
    clientX: number,
    clientY: number,
    viewport: TViewport,
  ): string | null {
    const rect = canvas.getBoundingClientRect()
    const pointerX = (clientX - rect.left - viewport.offsetX) / viewport.scale
    const pointerY = (clientY - rect.top - viewport.offsetY) / viewport.scale

    const hit = [...topology.devices].reverse().find((device) => {
      const distance = Math.hypot(pointerX - device.x, pointerY - device.y)
      return distance <= DEVICE_RADIUS
    })

    return hit?.id ?? null
  }

  findDirectionalNeighbor(
    topology: TTopology,
    selectedDeviceId: string | null,
    direction: NavigationDirection,
  ): string | null {
    const currentDevice =
      topology.devices.find((device) => device.id === selectedDeviceId) ?? topology.devices[0]

    if (!currentDevice) {
      return null
    }

    const candidates = topology.devices.filter((device) => device.id !== currentDevice.id)
    let bestId: string | null = null
    let bestScore = Number.POSITIVE_INFINITY

    candidates.forEach((candidate) => {
      const deltaX = candidate.x - currentDevice.x
      const deltaY = candidate.y - currentDevice.y

      if (!this.isDirectionalMatch(direction, deltaX, deltaY)) {
        return
      }

      const axialDistance =
        direction === "left" || direction === "right" ? Math.abs(deltaX) : Math.abs(deltaY)
      const crossDistance =
        direction === "left" || direction === "right" ? Math.abs(deltaY) : Math.abs(deltaX)
      const score = axialDistance + (crossDistance * DIRECTION_MATCH_WEIGHT) / 1000

      if (score < bestScore) {
        bestScore = score
        bestId = candidate.id
      }
    })

    return bestId ?? currentDevice.id
  }

  zoomAtPoint(
    viewport: TViewport,
    clientX: number,
    clientY: number,
    canvasRect: DOMRect,
    zoomDelta: number,
  ): TViewport {
    const nextScale = Math.max(0.7, Math.min(2.4, viewport.scale * zoomDelta))
    const pointerX = clientX - canvasRect.left
    const pointerY = clientY - canvasRect.top
    const worldX = (pointerX - viewport.offsetX) / viewport.scale
    const worldY = (pointerY - viewport.offsetY) / viewport.scale

    return {
      ...viewport,
      scale: nextScale,
      offsetX: pointerX - worldX * nextScale,
      offsetY: pointerY - worldY * nextScale,
    }
  }

  nudgeViewport(viewport: TViewport, deltaX: number, deltaY: number): TViewport {
    return {
      ...viewport,
      offsetX: viewport.offsetX + deltaX,
      offsetY: viewport.offsetY + deltaY,
    }
  }

  protected prepareCanvas(
    canvas: HTMLCanvasElement,
  ): { context: CanvasRenderingContext2D; width: number; height: number } | null {
    const context = canvas.getContext("2d")

    if (!context) {
      return null
    }

    const rect = canvas.getBoundingClientRect()
    const width = rect.width || 840
    const height = rect.height || 520
    const ratio = globalThis.devicePixelRatio || 1

    if (
      canvas.width !== Math.floor(width * ratio) ||
      canvas.height !== Math.floor(height * ratio)
    ) {
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)

    return { context, width, height }
  }

  protected get deviceRadius(): number {
    return DEVICE_RADIUS
  }

  private isDirectionalMatch(
    direction: NavigationDirection,
    deltaX: number,
    deltaY: number,
  ): boolean {
    switch (direction) {
      case "left":
        return deltaX < 0
      case "right":
        return deltaX > 0
      case "up":
        return deltaY < 0
      case "down":
        return deltaY > 0
    }
  }
}
