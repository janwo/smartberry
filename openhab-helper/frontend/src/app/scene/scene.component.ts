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
    untilActive: FormControl
    untilUnit: FormControl
    states: FormArray
  }
  getScene(): Item | undefined
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

  schema = {
    sceneItems: {
      tags: ['CoreScene'],
      description: $localize`Scene Item`
    },
    sceneTriggerItems: {
      tags: ['CoreSceneTrigger'],
      description: $localize`Scene Trigger Item`
    }
  }

  itemsMap: { [key: string]: string } = {}
  sceneItems: SceneItemHelper[] = []
  sceneTriggerItems: SceneTriggerItemHelper[] = []

  ngOnInit(): void {
    forkJoin([
      this.openhabService.general.itemsMap(),
      this.openhabService.scene.items(),
      this.openhabService.scene.triggerItems()
    ]).subscribe({
      next: (response) => {
        this.itemsMap = response[0].data
        this.sceneItems = response[1].data.map((item) =>
          this.generateSceneItemHelper(item)
        )
        this.sceneTriggerItems = response[2].data.map((item) =>
          this.generateSceneTriggerItemHelper(item)
        )
      }
    })
  }

  private generateSceneItemHelper(sceneItem: Item): SceneItemHelper {
    const defaultMembersConfig = { value: true, disabled: true }
    const customMembersConfig = (sceneItem.jsonStorage?.['customMembers'] || [])
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
      const states = sceneItem.jsonStorage?.['contextStates'] || {}
      return Object.keys(states).map((key) => {
        return this.formBuilder.group({
          context: this.formBuilder.control(key, [Validators.required]),
          state: this.formBuilder.control(states[key], [Validators.required])
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
        controls:
          customMembersForm.controls as SceneItemHelper['forms']['customMembers']['controls']
      },
      contextStates: {
        form: contextStatesForm,
        controls:
          contextStatesForm.controls as SceneItemHelper['forms']['contextStates']['controls']
      }
    }

    if (!forms.customMembers.controls.customMembers.length) {
      forms.customMembers.controls.defaultMembers.disable()
    } else {
      forms.customMembers.controls.defaultMembers.enable()
    }
    return {
      item: sceneItem,
      forms,
      addCustomMember: () => {
        forms.customMembers.controls.defaultMembers.enable()
        forms.customMembers.controls.customMembers.push(
          new FormControl(null, [Validators.required])
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
            context: new FormControl(null, [Validators.required]),
            state: new FormControl(null, [Validators.required])
          })
        )
      },
      removeContextState: (index: number) => {
        forms.contextStates.controls.contextStates.removeAt(index)
      }
    }
  }

  private generateSceneTriggerItemHelper(
    sceneTriggerItem: Item
  ): SceneTriggerItemHelper {
    const triggerStateConfig =
      sceneTriggerItem.jsonStorage?.['triggerState'] || {}

    const until = {
      hours: triggerStateConfig.hoursUntilActive,
      seconds: triggerStateConfig.secondsUntilActive,
      minutes: triggerStateConfig.minutesUntilActive
    }

    const form = this.formBuilder.group({
      from: this.formBuilder.control(
        triggerStateConfig.from !== undefined ? triggerStateConfig.from : null
      ),
      to: this.formBuilder.control(triggerStateConfig.to, [
        Validators.required
      ]),
      states: this.formBuilder.array(
        (triggerStateConfig.states || []).map(
          (state: any) => new FormControl(state, [Validators.required])
        )
      ),
      targetScene: this.formBuilder.control(triggerStateConfig.targetScene, [
        Validators.required
      ]),
      untilActive: this.formBuilder.control(
        Object.values(until).find((value: number) => value > 0) || null
      ),
      untilUnit: this.formBuilder.control(
        Object.keys(until).find(
          (key) => until[key as keyof typeof until] > 0
        ) || 'hours'
      )
    })

    const controls = form.controls as SceneTriggerItemHelper['controls']

    return {
      item: sceneTriggerItem,
      form,
      controls,
      getScene: () => {
        return this.sceneItems.find(
          (item) => item.item.name == controls.targetScene.value
        )?.item
      },
      addState: () => {
        controls.states.push(new FormControl(null, [Validators.required]))
      },
      removeState: (index: number) => {
        controls.states.removeAt(index)
      }
    }
  }

  updateCustomMembers(item: SceneItemHelper) {
    item.forms.customMembers.form.markAllAsTouched()
    if (item.forms.customMembers.form.invalid) {
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

  updateContextState(item: SceneItemHelper) {
    item.forms.contextStates.form.markAllAsTouched()
    if (item.forms.contextStates.form.invalid) {
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

  updateTriggerItem(item: SceneTriggerItemHelper) {
    item.form.markAllAsTouched()
    if (item.form.invalid) {
      return
    }

    const observable =
      item.form.controls['targetScene'].value == null
        ? this.openhabService.scene.deleteTriggerState(item.item.name)
        : this.openhabService.scene.updateTriggerState(item.item.name, {
            targetScene: item.controls.targetScene.value,
            from:
              item.controls.from.value != null
                ? item.controls.from.value
                : undefined,
            to: item.controls.to.value,
            hoursUntilActive:
              item.controls.untilUnit.value == 'hours' &&
              item.controls.untilActive.value != null
                ? Number.parseInt(item.controls.untilActive.value)
                : undefined,
            minutesUntilActive:
              item.controls.untilUnit.value == 'minutes' &&
              item.controls.untilActive.value != null
                ? Number.parseInt(item.controls.untilActive.value)
                : undefined,
            secondsUntilActive:
              item.controls.untilUnit.value == 'seconds' &&
              item.controls.untilActive.value != null
                ? Number.parseInt(item.controls.untilActive.value)
                : undefined,
            states: item.controls.states.value
          })

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
