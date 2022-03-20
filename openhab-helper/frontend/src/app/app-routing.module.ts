import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { HeatingComponent } from './heating/heating.component'
import { DashboardComponent } from './dashboard/dashboard.component'
import { ScenesComponent } from './scenes/scenes.component'
import { SetupComponent } from './setup/setup.component'
import { OpenhabService } from './openhab.service'

export const routes: Routes = [
  {
    path: 'setup',
    data: { title: 'API-Einstellungen', icon: 'link-2-outline' },
    component: SetupComponent
  },
  {
    path: 'heating',
    canActivate: [OpenhabService],
    data: {
      title: 'Heizthermostate',
      icon: 'thermometer-outline'
    },
    component: HeatingComponent
  },
  {
    path: 'scenes',
    canActivate: [OpenhabService],
    data: { title: 'Szenen', icon: 'film-outline' },
    component: ScenesComponent
  },
  {
    path: '',
    pathMatch: 'full',
    component: DashboardComponent
  }
]

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
