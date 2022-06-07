import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms'
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
    private formBuilder: FormBuilder
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

  settings: any
  irrigationTriggerItems: Item[] = []
  irrigationValveItems: { item: Item; form: FormGroup }[] = []

  private retrieveSettings() {
    this.openhabService.irrigation.settings().subscribe({
      next: (settings) => {
        this.settings = settings.data
      }
    })
  }

  ngOnInit(): void {
    this.retrieveSettings()

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

  submitAPIToken() {
    this.apiTokenForm.markAllAsTouched()
    if (this.apiTokenForm.invalid) {
      return
    }

    this.openhabService.irrigation
      .updateAPIKey(this.apiTokenForm.controls['apiToken'].value || '')
      .subscribe({
        next: (response) => {
          if (!response?.success) {
            switch (response.error) {
              case 'unauthenticated':
                this.apiTokenForm.controls['apiToken'].setErrors({
                  unauthenticated: true
                })
                break

              default:
                this.apiTokenForm.controls['apiToken'].setErrors({
                  invalid: true
                })
            }
            return
          }

          this.retrieveSettings()
        },
        error: (response) => {
          this.apiTokenForm.controls['apiToken'].setErrors({
            connection: true
          })
        }
      })
  }

  deleteAPIToken() {
    this.openhabService.irrigation.deleteAPIKey().subscribe({
      next: () => {
        this.retrieveSettings()
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
