import {
  AfterContentChecked,
  AfterContentInit,
  AfterViewChecked,
  Component,
  HostBinding,
  HostListener,
  Input,
  OnInit,
  ViewChild,
  ViewChildren
} from '@angular/core'
import { Item } from '../openhab.service'

interface ItemSchema {
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
  @HostBinding('class.last') get valid() {
    return this.schema?.childs
  }
  @Input() items?: Item[]

  open(item: Item) {
    window.open(item.link.replace('/rest/', '/settings/'))
  }
}
