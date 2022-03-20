import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { HeatingComponent } from './heating/heating.component'
import { ScenesComponent } from './scenes/scenes.component'
import { SvgIconComponent } from './svg-icon/svg-icon.component'
import { HttpClientModule } from '@angular/common/http'
import { DashboardComponent } from './dashboard/dashboard.component'
import { SetupComponent } from './setup/setup.component'
import { OpenhabService } from './openhab.service'
import { ReactiveFormsModule } from '@angular/forms'

@NgModule({
  declarations: [
    AppComponent,
    HeatingComponent,
    ScenesComponent,
    SvgIconComponent,
    DashboardComponent,
    SetupComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    ReactiveFormsModule,
    AppRoutingModule,
    BrowserAnimationsModule
  ],
  providers: [OpenhabService],
  bootstrap: [AppComponent]
})
export class AppModule {}
