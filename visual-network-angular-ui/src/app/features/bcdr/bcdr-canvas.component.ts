import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core"

import { BcdrCanvasRendererService } from "./bcdr-canvas-renderer.service"
import { BcdrTopology, BcdrViewport } from "./bcdr.models"

const DEFAULT_VIEWPORT: BcdrViewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
}

@Component({
  selector: "app-bcdr-canvas",
  template: `
    <div class="canvas-shell">
      <div class="toolbar" aria-label="Canvas controls">
        <button type="button" class="toolbar-button" (click)="zoomIn()">Zoom in</button>
        <button type="button" class="toolbar-button" (click)="zoomOut()">Zoom out</button>
        <button type="button" class="toolbar-button" (click)="resetView()">Reset view</button>
        <p class="toolbar-copy">
          Use drag to pan, wheel to zoom, arrows to change focus, Shift+arrows to move view.
        </p>
      </div>

      <canvas
        #canvas
        class="bcdr-canvas"
        height="520"
        width="960"
        tabindex="0"
        [attr.aria-label]="canvasAriaLabel()"
        (click)="onCanvasClick($event)"
        (mousedown)="onPointerDown($event)"
        (mousemove)="onPointerMove($event)"
        (mouseup)="onPointerUp()"
        (mouseleave)="onPointerUp()"
        (wheel)="onWheel($event)"
        (keydown)="onKeydown($event)"
      ></canvas>
    </div>
  `,
  styles: `
    .canvas-shell {
      display: grid;
      gap: 0.85rem;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.65rem;
    }
    .toolbar-button {
      min-height: 2.35rem;
      padding: 0.55rem 0.85rem;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      color: #f4f8fb;
      cursor: pointer;
    }
    .toolbar-button:focus-visible {
      outline: 3px solid #fde68a;
      outline-offset: 3px;
    }
    .toolbar-copy {
      margin: 0;
      color: #d7e2ef;
      font-size: 0.92rem;
      line-height: 1.4;
    }
    .bcdr-canvas {
      display: block;
      width: 100%;
      height: auto;
      min-height: 320px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 24px;
      background: #081018;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }
    .bcdr-canvas:focus-visible {
      outline: 3px solid #fde68a;
      outline-offset: 4px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BcdrCanvasComponent implements AfterViewInit {
  readonly topology = input.required<BcdrTopology>()
  readonly selectedDeviceId = input<string | null>(null)
  readonly sourceDeviceId = input<string | null>(null)
  readonly destinationDeviceId = input<string | null>(null)
  readonly activePathConnectionIds = input<string[]>([])
  readonly deviceSelected = output<string | null>()
  readonly viewport = signal<BcdrViewport>(DEFAULT_VIEWPORT)
  readonly canvasAriaLabel = computed(() => {
    const viewport = this.viewport()
    return `${this.topology().name} enterprise continuity canvas. Zoom ${Math.round(viewport.scale * 100)} percent.`
  })

  @ViewChild("canvas", { static: true })
  private readonly canvasRef?: ElementRef<HTMLCanvasElement>

  private readonly renderer = inject(BcdrCanvasRendererService)
  private readonly viewReady = signal(false)
  private readonly dragOrigin = signal<{ clientX: number; clientY: number } | null>(null)

  constructor() {
    effect(() => {
      if (!this.viewReady() || !this.canvasRef) {
        return
      }

      this.renderer.render(
        this.canvasRef.nativeElement,
        this.topology(),
        this.selectedDeviceId(),
        this.viewport(),
        this.sourceDeviceId(),
        this.destinationDeviceId(),
        this.activePathConnectionIds(),
      )
    })
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true)
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.canvasRef) {
      return
    }

    const deviceId = this.renderer.pickDevice(
      this.canvasRef.nativeElement,
      this.topology(),
      event.clientX,
      event.clientY,
      this.viewport(),
    )
    this.deviceSelected.emit(deviceId)
  }

  onPointerDown(event: MouseEvent): void {
    this.dragOrigin.set({ clientX: event.clientX, clientY: event.clientY })
  }

  onPointerMove(event: MouseEvent): void {
    const dragOrigin = this.dragOrigin()
    if (!dragOrigin) {
      return
    }

    this.viewport.update((viewport) =>
      this.renderer.nudgeViewport(
        viewport,
        event.clientX - dragOrigin.clientX,
        event.clientY - dragOrigin.clientY,
      ),
    )
    this.dragOrigin.set({ clientX: event.clientX, clientY: event.clientY })
  }

  onPointerUp(): void {
    this.dragOrigin.set(null)
  }

  onWheel(event: WheelEvent): void {
    if (!this.canvasRef) {
      return
    }

    event.preventDefault()
    const zoomDelta = event.deltaY < 0 ? 1.1 : 0.9
    const canvasRect = this.canvasRef.nativeElement.getBoundingClientRect()

    this.viewport.update((viewport) =>
      this.renderer.zoomAtPoint(viewport, event.clientX, event.clientY, canvasRect, zoomDelta),
    )
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault()
      this.zoomIn()
      return
    }

    if (event.key === "-") {
      event.preventDefault()
      this.zoomOut()
      return
    }

    if (event.key === "0") {
      event.preventDefault()
      this.resetView()
      return
    }

    if (event.shiftKey && event.key.startsWith("Arrow")) {
      event.preventDefault()
      this.panViewport(event.key)
      return
    }

    if (event.key.startsWith("Arrow")) {
      event.preventDefault()
      this.navigateSelection(event.key)
    }
  }

  zoomIn(): void {
    this.adjustZoom(1.15)
  }
  zoomOut(): void {
    this.adjustZoom(0.87)
  }
  resetView(): void {
    this.viewport.set(DEFAULT_VIEWPORT)
  }

  private adjustZoom(zoomDelta: number): void {
    if (!this.canvasRef) {
      return
    }

    const canvasRect = this.canvasRef.nativeElement.getBoundingClientRect()
    this.viewport.update((viewport) =>
      this.renderer.zoomAtPoint(
        viewport,
        canvasRect.left + canvasRect.width / 2,
        canvasRect.top + canvasRect.height / 2,
        canvasRect,
        zoomDelta,
      ),
    )
  }

  private panViewport(key: string): void {
    const panStep = 28

    if (key === "ArrowLeft") {
      this.viewport.update((viewport) => this.renderer.nudgeViewport(viewport, panStep, 0))
      return
    }

    if (key === "ArrowRight") {
      this.viewport.update((viewport) => this.renderer.nudgeViewport(viewport, -panStep, 0))
      return
    }

    if (key === "ArrowUp") {
      this.viewport.update((viewport) => this.renderer.nudgeViewport(viewport, 0, panStep))
      return
    }

    this.viewport.update((viewport) => this.renderer.nudgeViewport(viewport, 0, -panStep))
  }

  private navigateSelection(key: string): void {
    const direction = key.replace("Arrow", "").toLowerCase() as "left" | "right" | "up" | "down"
    const deviceId = this.renderer.findDirectionalNeighbor(
      this.topology(),
      this.selectedDeviceId(),
      direction,
    )
    this.deviceSelected.emit(deviceId)
  }
}
