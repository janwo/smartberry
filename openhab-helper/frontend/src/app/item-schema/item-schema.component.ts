import { Component, HostBinding, Input } from '@angular/core'
import { Item } from '../openhab.service'

export interface ItemSchema {
  tags: string[]
  tagRelationship?: 'and' | 'or'
  root?: boolean
  description?: string
  childs?: ItemSchema[]
}

@Component({
  selector: 'app-item-schema',
  templateUrl: './item-schema.component.html',
  styleUrls: ['./item-schema.component.scss']
})
export class ItemSchemaComponent {
  @Input() schema?: ItemSchema
  @Input() @HostBinding('class.first') root?: boolean = true
  @Input() items?: Item[]
  @HostBinding('class.last') get valid() {
    return this.schema?.childs
  }

  open(item: Item) {
    const link = item.link.replace(
      /(https?):\/\/.*:(\d+)\/rest\//,
      `$1://${window.location.hostname}:$2/settings/`
    )
    window.open(link)
  }
}
