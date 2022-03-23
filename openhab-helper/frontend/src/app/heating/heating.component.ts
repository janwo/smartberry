import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Item, OpenhabService } from '../openhab.service'

@Component({
  selector: 'app-heating',
  templateUrl: './heating.component.html',
  styleUrls: ['./heating.component.scss']
})
export class HeatingComponent implements OnInit {
  constructor(
    public openhabService: OpenhabService,
    private formBuilder: FormBuilder
  ) {}

  heatingItems: { item: Item; form: FormGroup }[] = []

  ngOnInit(): void {
    this.openhabService.heating.modeItems().subscribe({
      next: (items) => {
        this.heatingItems = items.data.map((item) => {
          return {
            item,
            form: this.formBuilder.group({
              off: [
                item.commandMap?.off !== undefined ? item.commandMap.off : '',
                Validators.required
              ],
              on: [
                item.commandMap?.on !== undefined ? item.commandMap.on : '',
                Validators.required
              ],
              eco: [
                item.commandMap?.eco !== undefined ? item.commandMap.eco : '',
                Validators.required
              ],
              power: [
                item.commandMap?.power !== undefined
                  ? item.commandMap.power
                  : '',
                Validators.required
              ]
            })
          }
        })
      }
    })
  }

  updateItem(item: { item: Item; form: FormGroup }) {
    item.form.markAllAsTouched()
    if (item.form.invalid) {
      return
    }

    const commandMap = item.form.value
    this.openhabService.heating
      .updateModeItems(item.item.name, commandMap)
      .subscribe({
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
