import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms'
import { DomSanitizer } from '@angular/platform-browser'
import { forkJoin } from 'rxjs'
import { GetItemListResponse, Item, OpenhabService } from '../openhab.service'

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
      next: (items: GetItemListResponse[]) => {
        this.irrigationTriggerItems = items[0].data
        this.irrigationValveItems = items[1].data.map((item) => {
          return {
            item,
            form: this.formBuilder.group({
              irrigationLevelPerMinute: [
                item.jsonStorage?.['irrigationLevelPerMinute'] !== undefined
                  ? item.jsonStorage['irrigationLevelPerMinute']
                  : ''
              ],
              aimedPrecipitationLevel: [
                item.jsonStorage?.['aimedPrecipitationLevel'] !== undefined
                  ? item.jsonStorage['aimedPrecipitationLevel']
                  : ''
              ],
              observedDays: [
                item.jsonStorage?.['observedDays'] !== undefined
                  ? item.jsonStorage['observedDays']
                  : ''
              ],
              overshootDays: [
                item.jsonStorage?.['overshootDays'] !== undefined
                  ? item.jsonStorage['overshootDays']
                  : ''
              ]
            })
          }
        })
      }
    })
  }

  apiTokenForm = this.formBuilder.group({
    apiToken: ['', Validators.required]
  })

  countValues(form: FormGroup) {
    return Object.values(form.value).filter((value) => value !== '').length
  }

  calculatedMinutes(form: FormGroup) {
    return (
      Math.round(
        (form.value.aimedPrecipitationLevel /
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
    this.apiTokenForm.markAllAsTouched()
    if (this.apiTokenForm.invalid) {
      return
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
    const irrigationValues = item.form.value
    let deleteIrrigationValues = Object.values(irrigationValues).every(
      (value: any) => value?.length == 0
    )

    for (const control in item.form.controls) {
      if (deleteIrrigationValues) {
        item.form.controls[control].setErrors(null)
        continue
      }

      if (item.form.controls[control].value?.length == 0) {
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
