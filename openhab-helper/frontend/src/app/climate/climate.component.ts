import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { forkJoin } from 'rxjs'
import { Item, OpenhabService } from '../openhab.service'

@Component({
  selector: 'app-climate',
  templateUrl: './climate.component.html',
  styleUrls: ['./climate.component.scss']
})
export class ClimateComponent implements OnInit {
  constructor(
    public openhabService: OpenhabService,
    private formBuilder: FormBuilder
  ) {}

  heatingItems: { item: Item; form: FormGroup }[] = []
  heatingContactSwitchableItems: Item[] = []

  schema = {
    heatingItems: {
      tags: ['RadiatorControl'],
      description: $localize`Thermostat Group`,
      childs: [
        { description: $localize`Thermostat Mode Item`, tags: ['SetPoint'] }
      ]
    },
    heatingContactSwitchableItems: {
      tags: ['Door', 'Window'],
      description: $localize`Door or Window Group`,
      childs: [
        {
          tags: ['OpenState']
        }
      ]
    }
  }

  ngOnInit(): void {
    forkJoin([
      this.openhabService.climate.modeItems(),
      this.openhabService.climate.contactSwitchableItems()
    ]).subscribe({
      next: (items) => {
        this.heatingContactSwitchableItems = items[1].data
        this.heatingItems = items[0].data.map((item) => {
          return {
            item,
            form: this.formBuilder.group({
              off: [
                item.jsonStorage?.['commandMap']?.off !== undefined
                  ? item.jsonStorage['commandMap'].off
                  : null
              ],
              on: [
                item.jsonStorage?.['commandMap']?.on !== undefined
                  ? item.jsonStorage['commandMap'].on
                  : null
              ],
              eco: [
                item.jsonStorage?.['commandMap']?.eco !== undefined
                  ? item.jsonStorage['commandMap'].eco
                  : null
              ],
              power: [
                item.jsonStorage?.['commandMap']?.power !== undefined
                  ? item.jsonStorage['commandMap'].power
                  : null
              ]
            })
          }
        })
      }
    })
  }

  countValues(form: FormGroup) {
    return Object.values(form.value).filter((value) => value !== null).length
  }

  updateItem(item: { item: Item; form: FormGroup }) {
    item.form.markAllAsTouched()
    const commandMap = item.form.value
    let deleteCommandMap = Object.values(commandMap).every(
      (value: any) => value?.length == 0
    )

    for (const control in item.form.controls) {
      if (deleteCommandMap) {
        item.form.controls[control].setErrors(null)
        continue
      }

      if (item.form.controls[control].value == null) {
        item.form.controls[control].setErrors({ required: true })
        item.form.setErrors({ required: true })
      }
    }

    if (item.form.invalid) {
      return
    }

    const observable = deleteCommandMap
      ? this.openhabService.climate.deleteCommandMap(item.item.name)
      : this.openhabService.climate.updateCommandMap(item.item.name, commandMap)
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
