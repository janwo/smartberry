import { Component } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { DomSanitizer } from '@angular/platform-browser'
import { forkJoin } from 'rxjs'
import { Item, OpenhabService } from '../openhab.service'

@Component({
  selector: 'app-irrigation',
  templateUrl: './irrigation.component.html',
  styleUrls: ['./irrigation.component.scss']
})
export class IrrigationComponent {
  constructor(
    public openhabService: OpenhabService,
    private formBuilder: FormBuilder,
    private sanitizer: DomSanitizer
  ) {}

  schema = {
    irrigationTriggerItems: {
      tags: ['CoreIrrigationTrigger'],
      description: $localize`Irrigation Trigger Item`
    },
    irrigationValveItems: {
      tags: ['CoreIrrigationValve'],
      description: $localize`Irrigation Valve Item`
    }
  }

  i18nPluralMapping = {
    '=0': $localize`0 days`,
    '=1': $localize`1 day`,
    other: $localize`# Tage`
  }

  apiSettings?: {
    syncedLocation: boolean
    hasApiKey: boolean
    longitude?: number
    latitude?: number
  }
  irrigationTriggerItems: Item[] = []
  irrigationValveItems: { item: Item; form: FormGroup }[] = []

  ngOnInit(): void {
    this.openhabService.irrigation.apiSettings().subscribe({
      next: (apiSettings) => {
        this.apiSettings = apiSettings.data
      }
    })

    forkJoin([
      this.openhabService.irrigation.triggerItems(),
      this.openhabService.irrigation.valveItems()
    ]).subscribe({
      next: (items) => {
        this.irrigationTriggerItems = items[0].data
        this.irrigationValveItems = items[1].data.map((item) => ({
          item,
          form: this.formBuilder.group({
            irrigationLevelPerMinute: [
              item.jsonStorage?.['irrigationLevelPerMinute'] !== undefined
                ? item.jsonStorage['irrigationLevelPerMinute']
                : null
            ],
            temperatureUnit: [
              item.jsonStorage?.['minimalTemperature'] !== undefined
                ? item.jsonStorage['minimalTemperature']
                    .substring(
                      item.jsonStorage['minimalTemperature'].length - 1
                    )
                    .toUpperCase()
                : 'C'
            ],
            evaporationFactor: [
              item.jsonStorage?.['evaporationFactor'] !== undefined
                ? item.jsonStorage['evaporationFactor']
                : 1
            ],
            minimalTemperature: [
              item.jsonStorage?.['minimalTemperature'] !== undefined
                ? item.jsonStorage['minimalTemperature'].substring(
                    0,
                    item.jsonStorage['minimalTemperature'].length - 1
                  )
                : null
            ],
            observedDays: [
              item.jsonStorage?.['observedDays'] !== undefined
                ? item.jsonStorage['observedDays']
                : 3
            ],
            overshootDays: [
              item.jsonStorage?.['overshootDays'] !== undefined
                ? item.jsonStorage['overshootDays']
                : 1
            ]
          })
        }))
      }
    })
  }

  apiTokenForm = this.formBuilder.group({
    apiToken: [null, Validators.required]
  })

  countValues(form: FormGroup) {
    return Object.values(form.value).filter((value) => value !== null).length
  }

  calculatedMinutes(form: FormGroup) {
    return (
      Math.round(
        ((form.value.evaporationFactor * form.value.observedDays) /
          form.value.irrigationLevelPerMinute) *
          10
      ) / 10
    )
  }

  get locationSettingsLink() {
    return this.sanitizer.bypassSecurityTrustUrl(
      `${window.location.hostname}:8080/settings/services/org.openhab.i18n`
    )
  }

  submitAPISettings(apiSettings: { syncLocation?: boolean; apiKey?: string }) {
    if (apiSettings.apiKey) {
      this.apiTokenForm.markAllAsTouched()
      if (this.apiTokenForm.invalid) {
        return
      }
    }

    this.openhabService.irrigation.updateApiSettings(apiSettings).subscribe({
      next: (response) => {
        if (!response?.success) {
          switch (response.error) {
            case 'unauthenticated':
              this.apiTokenForm.controls['apiToken'].setErrors({
                unauthenticated: true
              })
              break

            case 'nolocation':
              this.apiTokenForm.controls['apiToken'].setErrors({
                nolocation: true
              })
              break

            default:
              this.apiTokenForm.controls['apiToken'].setErrors({
                invalid: true
              })
          }
          return
        }

        if (!this.apiSettings?.syncedLocation && apiSettings.syncLocation) {
          this.apiSettings!.syncedLocation = true
        }

        if (!this.apiSettings?.hasApiKey && apiSettings.apiKey) {
          this.apiSettings!.hasApiKey = true
        }
      },
      error: (response) => {
        this.apiTokenForm.controls['apiToken'].setErrors({
          connection: true
        })
      }
    })
  }

  deleteAPISettings() {
    this.openhabService.irrigation.deleteApiSettings().subscribe({
      next: () => {
        this.apiSettings = {
          hasApiKey: false,
          syncedLocation: false
        }
      }
    })
  }

  updateItem(item: { item: Item; form: FormGroup }) {
    item.form.markAllAsTouched()
    const { temperatureUnit, ...irrigationValues } = item.form.value
    irrigationValues.minimalTemperature += temperatureUnit

    let deleteIrrigationValues =
      !irrigationValues.evaporationFactor &&
      !irrigationValues.irrigationLevelPerMinute

    for (const control in item.form.controls) {
      if (deleteIrrigationValues) {
        item.form.controls[control].setErrors(null)
        continue
      }

      if (
        item.form.controls[control].value == null &&
        control != 'minimalTemperature'
      ) {
        item.form.controls[control].setErrors({ required: true })
        item.form.setErrors({ required: true })
      }
    }

    if (item.form.invalid) {
      return
    }

    const observable = deleteIrrigationValues
      ? this.openhabService.irrigation.deleteValveItems(item.item.name)
      : this.openhabService.irrigation.updateValveItems(
          item.item.name,
          irrigationValues
        )
    observable.subscribe({
      next: (response) => {
        if (!response?.success) {
          item.form.setErrors({
            invalid: true
          })
          return
        }
      },
      error: (response) => {
        item.form.setErrors({
          connection: true
        })
      }
    })
  }
}
