import { Pipe, PipeTransform } from '@angular/core'
import { Item } from './openhab.service'

@Pipe({
  name: 'statedescription'
})
export class StateDescriptionPipe implements PipeTransform {
  transform(item: Item) {
    const state = item.stateDescription?.options?.find(
      (state) => item.state == state.value
    )?.label
    return state === undefined ? item.state : state
  }
}
