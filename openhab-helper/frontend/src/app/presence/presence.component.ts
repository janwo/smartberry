import { Component, OnInit } from '@angular/core'
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators
} from '@angular/forms'
import { OpenhabService, Item } from '../openhab.service'

interface PresenceItemHelper {
  item: Item
  form: FormGroup
  controls: {
    absenceStates: FormArray
    presenceStates: FormArray
  }
  addAbsenceState(): void
  removeAbsenceState(index: number): void
  addPresenceState(): void
  removePresenceState(index: number): void
}

@Component({
  selector: 'app-presence',
  templateUrl: './presence.component.html',
  styleUrls: ['./presence.component.scss']
})
export class PresenceComponent implements OnInit {
  constructor(
    private openhabService: OpenhabService,
    private formBuilder: FormBuilder
  ) {}

  schema = {
    presenceItems: {
      tags: ['Presence', 'Measurement'],
      description: $localize`Presence Item`
    }
  }

  presenceItems: PresenceItemHelper[] = []

  ngOnInit(): void {
    this.openhabService.presence.items().subscribe({
      next: (items) => {
        this.presenceItems = items.data.map((item) => {
          const form = this.formBuilder.group({
            absenceStates: this.formBuilder.array(
              (item.jsonStorage?.['states']?.absence || []).map(
                (state: any) => {
                  return this.formBuilder.control(state, [Validators.required])
                }
              )
            ),
            presenceStates: this.formBuilder.array(
              (item.jsonStorage?.['states']?.presence || []).map(
                (state: any) => {
                  return this.formBuilder.control(state, [Validators.required])
                }
              )
            )
          })

          const controls = form.controls as PresenceItemHelper['controls']
          return {
            item,
            controls,
            form,
            addAbsenceState: () => {
              controls.absenceStates.push(
                new FormControl(null, [Validators.required])
              )
            },
            removeAbsenceState: (index: number) => {
              controls.absenceStates.removeAt(index)
            },
            addPresenceState: () => {
              controls.presenceStates.push(
                new FormControl(null, [Validators.required])
              )
            },
            removePresenceState: (index: number) => {
              controls.presenceStates.removeAt(index)
            }
          }
        })
      }
    })
  }

  updateStates(item: PresenceItemHelper) {
    item.form.markAllAsTouched()
    if (item.form.invalid) {
      return
    }

    const states = {
      presence:
        item.form.value.presenceStates.length != 0
          ? item.form.value.presenceStates
          : undefined,
      absence:
        item.form.value.absenceStates.length != 0
          ? item.form.value.absenceStates
          : undefined
    }

    const observable = Object.values(states).every(
      (state) => state === undefined
    )
      ? this.openhabService.presence.deleteStates(item.item.name)
      : this.openhabService.presence.updateStates(item.item.name, states)
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
