import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms'
import { observable } from 'rxjs'
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

  ngOnInit(): void {
    this.openhabService.climate.modeItems().subscribe({
      next: (items) => {
        this.heatingItems = items.data.map((item) => {
          return {
            item,
            form: this.formBuilder.group({
              off: [
                item.jsonStorage?.['commandMap']?.off !== undefined
                  ? item.jsonStorage['commandMap'].off
                  : ''
              ],
              on: [
                item.jsonStorage?.['commandMap']?.on !== undefined
                  ? item.jsonStorage['commandMap'].on
                  : ''
              ],
              eco: [
                item.jsonStorage?.['commandMap']?.eco !== undefined
                  ? item.jsonStorage['commandMap'].eco
                  : ''
              ],
              power: [
                item.jsonStorage?.['commandMap']?.power !== undefined
                  ? item.jsonStorage['commandMap'].power
                  : ''
              ]
            })
          }
        })
      }
    })

    this.openhabService.climate.contactSwitchableItems().subscribe({
      next: (items) => {
        this.heatingContactSwitchableItems = items.data
      }
    })
  }

  countValues(form: FormGroup) {
    let count = 0
    Object.values(form.controls)
      .map((control) => control.value)
      .forEach((value) => {
        if (value !== '') {
          count++
        }
      })
    return count
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

      if (item.form.controls[control].value?.length == 0) {
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
