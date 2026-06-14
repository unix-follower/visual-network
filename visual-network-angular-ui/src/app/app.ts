import { ChangeDetectionStrategy, Component, signal } from "@angular/core"
import { RouterLink, RouterOutlet } from "@angular/router"

@Component({
  selector: "app-root",
  imports: [RouterLink, RouterOutlet],
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal("Visual Networks")
}
