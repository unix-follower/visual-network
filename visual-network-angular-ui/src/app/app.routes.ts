import { Routes } from "@angular/router"

export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    redirectTo: "pan",
  },
  {
    path: "pan",
    loadComponent: () =>
      import("./features/pan/pan-page.component").then((module) => module.PanPageComponent),
  },
  {
    path: "lan",
    loadComponent: () =>
      import("./features/lan/lan-page.component").then((module) => module.LanPageComponent),
  },
  {
    path: "routing-switching",
    loadComponent: () =>
      import("./features/routing-switching/routing-switching-page.component").then(
        (module) => module.RoutingSwitchingPageComponent,
      ),
  },
  {
    path: "wlan",
    loadComponent: () =>
      import("./features/wlan/wlan-page.component").then((module) => module.WlanPageComponent),
  },
  {
    path: "wan",
    loadComponent: () =>
      import("./features/wan/wan-page.component").then((module) => module.WanPageComponent),
  },
  {
    path: "man",
    loadComponent: () =>
      import("./features/man/man-page.component").then((module) => module.ManPageComponent),
  },
  {
    path: "sdn",
    loadComponent: () =>
      import("./features/sdn/sdn-page.component").then((module) => module.SdnPageComponent),
  },
  {
    path: "san",
    loadComponent: () =>
      import("./features/san/san-page.component").then((module) => module.SanPageComponent),
  },
  {
    path: "dcn",
    loadComponent: () =>
      import("./features/dcn/dcn-page.component").then((module) => module.DcnPageComponent),
  },
  {
    path: "cen",
    loadComponent: () =>
      import("./features/cen/cen-page.component").then((module) => module.CenPageComponent),
  },
  {
    path: "acn",
    loadComponent: () =>
      import("./features/acn/acn-page.component").then((module) => module.AcnPageComponent),
  },
  {
    path: "nmo",
    loadComponent: () =>
      import("./features/nmo/nmo-page.component").then((module) => module.NmoPageComponent),
  },
  {
    path: "bcdr",
    loadComponent: () =>
      import("./features/bcdr/bcdr-page.component").then((module) => module.BcdrPageComponent),
  },
]
