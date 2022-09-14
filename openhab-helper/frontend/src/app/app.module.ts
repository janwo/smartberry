import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { ClimateComponent } from './climate/climate.component'
import { SceneComponent } from './scene/scene.component'
import { SvgIconComponent } from './svg-icon/svg-icon.component'
import { HttpClientModule } from '@angular/common/http'
import { DashboardComponent } from './dashboard/dashboard.component'
import { SetupComponent } from './setup/setup.component'
import { OpenhabService } from './openhab.service'
import { ReactiveFormsModule } from '@angular/forms'
import { AccordionComponent } from './accordion/accordion.component'
import { ItemSchemaComponent } from './item-schema/item-schema.component'
import { MapPipe } from './map.pipe'
import { StateDescriptionPipe } from './state-description.pipe'
import { LightComponent } from './light/light.component'
import { PresenceComponent } from './presence/presence.component'
import { SecurityComponent } from './security/security.component'
import { ErrorComponent } from './error/error.component'
import { IrrigationComponent } from './irrigation/irrigation.component'
import { IrrigationChartComponent } from './irrigation-chart/irrigation-chart.component'
import { NgChartsModule } from 'ng2-charts'

@NgModule({
  declarations: [
    AppComponent,
    ClimateComponent,
    SceneComponent,
    SvgIconComponent,
    DashboardComponent,
    SetupComponent,
    AccordionComponent,
    ItemSchemaComponent,
    IrrigationComponent,
    MapPipe,
    StateDescriptionPipe,
    LightComponent,
    PresenceComponent,
    SecurityComponent,
    ErrorComponent,
    IrrigationChartComponent
  ],
  imports: [
    BrowserModule,
    NgChartsModule,
    HttpClientModule,
    ReactiveFormsModule,
    AppRoutingModule,
    BrowserAnimationsModule
  ],
  providers: [OpenhabService],
  bootstrap: [AppComponent]
})
export class AppModule {}
