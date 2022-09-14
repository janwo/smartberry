import { Component, Input } from '@angular/core'
import { Item } from '../openhab.service'

type IrrigationValveItemSettings = {
  observedDays: number
  overshootDays: number
  evaporationFactor: number
}

type Series = {
  date: string
  forecast?: true
  rain: number
  temperature: { max: number; min: number }
  humidity: number
  eto: number
  irrigation?: number
}

@Component({
  selector: 'app-irrigation-chart',
  templateUrl: './irrigation-chart.component.html',
  styleUrls: ['./irrigation-chart.component.scss']
})
export class IrrigationChartComponent {
  @Input() unit: 'metric' | 'imperial' = 'metric'
  @Input() irrigationValveItem?: Item
  @Input() irrigationValveItemSettings?: IrrigationValveItemSettings

  getSeriesPeriod(
    series: Series[],
    observedDays: number,
    overshootDays: number
  ) {
    const seriesTodaysIndex = series.findIndex((s) => s.forecast)
    return series.slice(
      Math.max(0, seriesTodaysIndex - observedDays),
      Math.min(seriesTodaysIndex + overshootDays, series.length - 1)
    )
  }

  calculatePrecipitationLevel(
    series: Series[],
    irrigationValveItemSettings: IrrigationValveItemSettings,
    includeForecast = false
  ) {
    const { observedDays, overshootDays, evaporationFactor } =
      irrigationValveItemSettings
    const seriesPeriod = this.getSeriesPeriod(
      series,
      observedDays,
      includeForecast ? overshootDays : 0
    )
    return seriesPeriod.reduce(
      (level, wh) =>
        level + wh.rain + (wh.irrigation || 0) - wh.eto * evaporationFactor,
      0
    )
  }

  temperature = (temperature: number) => {
    return this.unit == 'metric'
      ? temperature - 273.15
      : 1.8 * (temperature - 273.15) + 32
  }

  length = (length: number) => {
    return this.unit == 'metric' ? length : length * 2.5
  }

  data(
    series: Series[],
    irrigationValveItemSettings: IrrigationValveItemSettings
  ): any {
    const { observedDays, overshootDays, evaporationFactor } =
      irrigationValveItemSettings
    const seriesPeriod = this.getSeriesPeriod(
      series,
      observedDays,
      overshootDays
    )
    const seriesTodaysIndex = seriesPeriod.findIndex((s) => s.forecast)

    return {
      labels: seriesPeriod.map((d) => new Date(d.date).toLocaleDateString()),
      datasets: [
        {
          label: 'Maximal Temperature',
          type: 'line',
          yAxisID: 'temperature',
          tension: 0.25,
          borderColor: 'rgba(255, 130, 169, 1)',
          backgroundColor: 'rgba(0,0,0,0)',
          pointBackgroundColor: 'rgba(255, 130, 169, .5)',
          data: seriesPeriod.map((s: any) =>
            this.temperature(s.temperature.max)
          )
        },
        {
          label: 'Minimal Temperature',
          type: 'line',
          yAxisID: 'temperature',
          tension: 0.25,
          borderColor: 'rgba(90, 118, 196, 1)',
          backgroundColor: 'rgba(0,0,0,0)',
          pointBackgroundColor: 'rgba(90, 118, 196, .5)',
          data: seriesPeriod.map((s: any) =>
            this.temperature(s.temperature.min)
          )
        },
        {
          label: 'Precipitation Level',
          type: 'line',
          borderColor: 'rgba(0, 0, 0, 1)',
          backgroundColor: 'rgba(0,0,0,0)',
          pointBackgroundColor: 'rgba(0, 0, 0, .5)',
          yAxisID: 'length',
          tension: 0.25,
          data: seriesPeriod.reduce(
            (data: number[], s) => [
              ...data,
              (data[data.length - 1] || 0) +
                s.rain +
                (s.irrigation || 0) -
                s.eto * evaporationFactor
            ],
            []
          )
        },

        {
          label: 'Rain',
          type: 'bar',
          yAxisID: 'length',
          stack: 'watering',
          data: seriesPeriod.map((s: any) => this.length(s.rain || 0)),
          borderColor: 'rgba(90, 118, 196, 1)',
          backgroundColor: seriesPeriod.map((s, index) =>
            index >= seriesTodaysIndex
              ? 'rgba(90, 118, 196, .25)'
              : 'rgba(90, 118, 196, .5)'
          )
        },

        {
          label: 'Irrigation',
          type: 'bar',
          yAxisID: 'length',
          stack: 'watering',
          borderColor: 'rgba(14, 173, 105, 1)',
          backgroundColor: 'rgba(14, 173, 105, .5)',
          data: seriesPeriod.map((s: any) => this.length(s.irrigation || 0))
        },
        {
          label: 'Evaporation',
          type: 'bar',
          yAxisID: 'length',
          stack: 'watering',
          data: seriesPeriod.map(
            (s: any) => -this.length(s.eto * evaporationFactor)
          ),
          fill: true,
          borderColor: 'rgba(255, 235, 231, 1)',
          backgroundColor: seriesPeriod.map((s, index) =>
            index >= seriesTodaysIndex
              ? 'rgba(202, 137, 95, .25)'
              : 'rgba(202, 137, 95, .5)'
          )
        }
      ]
    }
  }
}
