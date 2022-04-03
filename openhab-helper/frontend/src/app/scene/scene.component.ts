import { Component, OnInit } from '@angular/core'
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators
} from '@angular/forms'
import { forkJoin } from 'rxjs'
import { Item, OpenhabService } from '../openhab.service'

interface SceneItemHelper {
  item: Item
  forms: {
    contextStates: {
      form: FormGroup
      controls: {
        contextStates: FormArray
      }
    }
    customMembers: {
      form: FormGroup
      controls: {
        defaultMembers: FormControl
        customMembers: FormArray
      }
    }
  }
  addCustomMember(): void
  removeCustomMember(index: number): void
  addContextState(): void
  removeContextState(index: number): void
}

interface SceneTriggerItemHelper {
  item: Item
  form: FormGroup
  controls: {
    targetScene: FormControl
    to: FormControl
    from: FormControl
    states: FormArray
  }
  addState(): void
  removeState(index: number): void
}

@Component({
  selector: 'app-scene',
  templateUrl: './scene.component.html',
  styleUrls: ['./scene.component.scss']
})
export class SceneComponent implements OnInit {
  constructor(
    private openhabService: OpenhabService,
    private formBuilder: FormBuilder
  ) {}

  itemsMap: { [key: string]: string } = {}
  sceneItems: SceneItemHelper[] = []
  sceneTriggerItems: SceneTriggerItemHelper[] = []

  ngOnInit(): void {
    forkJoin([
      this.openhabService.scene.items(),
      this.openhabService.general.itemsMap()
    ]).subscribe({
      next: (response) => {
        this.itemsMap = response[1].data
        this.sceneItems = response[0].data.map((item) => {
          const defaultMembersConfig = { value: true, disabled: true }
          const customMembersConfig = (
            item.jsonStorage?.['customMembers'] || []
          )
            .filter((member: string) => {
              if (member.startsWith('default:')) {
                defaultMembersConfig.value =
                  member.substring('default:'.length) == 'true'
                return false
              }
              return true
            })
            .map((member: string) => [member, Validators.required])
          const contextStatesConfig = (() => {
            const states = item.jsonStorage?.['contextStates'] || {}
            return Object.keys(states).map((key) => {
              return this.formBuilder.group({
                context: this.formBuilder.control(key, [Validators.required]),
                state: this.formBuilder.control(states[key], [
                  Validators.required
                ])
              })
            })
          })()

          const customMembersForm = this.formBuilder.group({
            defaultMembers: this.formBuilder.control(defaultMembersConfig),
            customMembers: this.formBuilder.array(customMembersConfig)
          })
          const contextStatesForm = this.formBuilder.group({
            contextStates: this.formBuilder.array(contextStatesConfig)
          })

          const forms = {
            customMembers: {
              form: customMembersForm,
              controls: customMembersForm.controls as {
                defaultMembers: FormControl
                customMembers: FormArray
              }
            },
            contextStates: {
              form: contextStatesForm,
              controls: contextStatesForm.controls as {
                contextStates: FormArray
              }
            }
          }

          if (!forms.customMembers.controls.customMembers.length) {
            forms.customMembers.controls.defaultMembers.disable()
          } else {
            forms.customMembers.controls.defaultMembers.enable()
          }
          return {
            item,
            forms,
            addCustomMember: () => {
              forms.customMembers.controls.defaultMembers.enable()
              forms.customMembers.controls.customMembers.push(
                new FormControl('', [Validators.required])
              )
            },
            removeCustomMember: (index: number) => {
              forms.customMembers.controls.customMembers.removeAt(index)
              if (!forms.customMembers.controls.customMembers.controls.length) {
                forms.customMembers.controls.defaultMembers.disable()
              }
            },
            addContextState: () => {
              forms.contextStates.controls.contextStates.push(
                new FormGroup({
                  context: new FormControl('', [Validators.required]),
                  state: new FormControl('', [Validators.required])
                })
              )
            },
            removeContextState: (index: number) => {
              forms.contextStates.controls.contextStates.removeAt(index)
            }
          }
        })
      }
    })

    this.openhabService.scene.triggerItems().subscribe({
      next: (items) => {
        this.sceneTriggerItems = items.data.map((item) => {
          const triggerStateConfig = item.jsonStorage?.['triggerState'] || {}

          const form = this.formBuilder.group({
            from: this.formBuilder.control(triggerStateConfig.from || '', [
              Validators.required
            ]),
            to: this.formBuilder.control(triggerStateConfig.to || ''),
            states: this.formBuilder.array(
              (triggerStateConfig.states || []).map(
                (state: string) => new FormControl(state, [Validators.required])
              )
            ),
            targetScene: this.formBuilder.control(
              triggerStateConfig.targetScene,
              [Validators.required]
            )
          })

          const controls = form.controls as {
            targetScene: FormControl
            to: FormControl
            from: FormControl
            states: FormArray
          }

          return {
            item,
            form,
            controls,
            addState: () => {
              controls.states.push(new FormControl('', [Validators.required]))
            },
            removeState: (index: number) => {
              controls.states.removeAt(index)
            }
          }
        })
      }
    })
  }

  updateCustomMembers(item: SceneItemHelper) {
    item.forms.customMembers.form.markAllAsTouched()
    if (item.forms.customMembers.form.invalid) {
      for (const control of item.forms.customMembers.controls.customMembers
        .controls) {
        if (control.hasError('required')) {
          item.forms.customMembers.form.setErrors({ required: true })
          break
        }
      }
      return
    }

    const customMembers = item.forms.customMembers.form.value.customMembers
    if (item.forms.customMembers.form.value.defaultMembers) {
      customMembers.push('default:true')
    }

    const observable =
      customMembers.length == 0
        ? this.openhabService.scene.deleteCustomMembers(item.item.name)
        : this.openhabService.scene.updateCustomMembers(item.item.name, [
            ...new Set<string>(customMembers)
          ])
    observable.subscribe({
      next: (response) => {
        if (!response?.success) {
          item.forms.customMembers.form.setErrors({
            invalid: true
          })
          return
        }
      },
      error: (response) => {
        item.forms.customMembers.form.setErrors({
          connection: true
        })
      }
    })
  }

  updateTriggerItem(item: SceneTriggerItemHelper) {
    item.form.markAllAsTouched()
    if (item.form.invalid) {
      for (const state of item.controls.states.controls) {
        if (state.hasError('required')) {
          item.form.setErrors({
            required: true
          })
          break
        }
      }
      return
    }

    const contextStates = item.form.value.states.reduce(
      (obj: any, contextState: { context: string; state: any }) => {
        obj[contextState.context] = contextState.state
        return obj
      },
      {}
    )

    const observable =
      Object.keys(contextStates).length == 0
        ? this.openhabService.scene.deleteContextStates(item.item.name)
        : this.openhabService.scene.updateContextStates(
            item.item.name,
            contextStates
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

  updateContextState(item: SceneItemHelper) {
    item.forms.contextStates.form.markAllAsTouched()
    if (item.forms.contextStates.form.invalid) {
      for (const group of item.forms.contextStates.controls.contextStates
        .controls) {
        for (const control of Object.values((group as FormGroup).controls)) {
          if (control.hasError('required')) {
            item.forms.contextStates.form.setErrors({
              required: true
            })
            break
          }
        }
      }
      return
    }

    const contextStates =
      item.forms.contextStates.form.value.contextStates.reduce(
        (obj: any, contextState: { context: string; state: any }) => {
          obj[contextState.context] = contextState.state
          return obj
        },
        {}
      )

    const observable =
      Object.keys(contextStates).length == 0
        ? this.openhabService.scene.deleteContextStates(item.item.name)
        : this.openhabService.scene.updateContextStates(
            item.item.name,
            contextStates
          )
    observable.subscribe({
      next: (response) => {
        if (!response?.success) {
          item.forms.contextStates.form.setErrors({
            invalid: true
          })
          return
        }
      },
      error: (response) => {
        item.forms.contextStates.form.setErrors({
          connection: true
        })
      }
    })
  }
}
