import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
  name: 'map'
})
export class MapPipe implements PipeTransform {
  transform(value: { [key: string]: any }[], key: string) {
    return value.map((value) => value[key])
  }
}
