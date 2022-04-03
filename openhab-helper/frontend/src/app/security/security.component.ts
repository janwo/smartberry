import { Component, OnInit } from '@angular/core'
import { OpenhabService, Item } from '../openhab.service'

@Component({
  selector: 'app-security',
  templateUrl: './security.component.html',
  styleUrls: ['./security.component.scss']
})
export class SecurityComponent implements OnInit {
  constructor(private openhabService: OpenhabService) {}

  sceneItems: Item[] = []
  sceneTriggerItems: Item[] = []

  ngOnInit(): void {
    this.openhabService.scene.items().subscribe({
      next: (items) => {
        this.sceneItems = items.data as Item[]
      }
    })
    this.openhabService.scene.triggerItems().subscribe({
      next: (items) => {
        this.sceneTriggerItems = items.data as Item[]
      }
    })
  }
}
