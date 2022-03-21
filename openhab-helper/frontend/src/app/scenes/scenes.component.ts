import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Item, OpenhabService } from '../openhab.service'

@Component({
  selector: 'app-scenes',
  templateUrl: './scenes.component.html',
  styleUrls: ['./scenes.component.scss']
})
export class ScenesComponent implements OnInit {
  constructor(private openhabService: OpenhabService) {}

  sceneItems: Item[] = []

  ngOnInit(): void {
    this.openhabService.scene.items().subscribe({
      next: (items) => {
        this.sceneItems = items.data as Item[]
      }
    })
  }
}
