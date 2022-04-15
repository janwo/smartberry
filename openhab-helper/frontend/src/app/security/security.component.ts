import { Component, OnInit } from '@angular/core'
import { forkJoin } from 'rxjs'
import { OpenhabService, Item, GetItemListResponse } from '../openhab.service'

@Component({
  selector: 'app-security',
  templateUrl: './security.component.html',
  styleUrls: ['./security.component.scss']
})
export class SecurityComponent implements OnInit {
  constructor(private openhabService: OpenhabService) {}

  schema = {
    assaultTriggerItems: {
      tags: ['Window', 'Door', 'CoreAssaultTrigger'],
      description: $localize`Assault trigger items`,
      childs: [{ tags: ['OpenState', 'Switch'] }]
    },
    smokeTriggerItems: {
      tags: ['SmokeDetector'],
      description: $localize`Smoke trigger items`,
      childs: [{ tags: ['Alarm'] }]
    },
    assaultDisarmerItems: {
      description: $localize`Assault Disarmer Items`,
      tags: ['CoreAssaultDisarmer'],
      childs: [
        {
          tags: ['OpenState', 'Switch']
        }
      ]
    },
    lockClosureItems: {
      tags: ['CoreLockClosure'],
      description: $localize`Lock closure items`,
      childs: [
        {
          tags: ['OpenState', 'Switch']
        }
      ]
    },
    lockItems: {
      tags: ['Lock'],
      description: $localize`Lock items`,
      childs: [
        {
          tags: ['OpenState', 'Switch']
        }
      ]
    },
    assaultAlarmItems: {
      tags: ['AlarmSystem', 'Siren'],
      description: $localize`Assault Alarm items`,
      childs: [{ tags: ['Alarm'] }]
    }
  }

  assaultTriggerItems: Item[] = []
  assaultDisarmerItems: Item[] = []
  lockClosureItems: Item[] = []
  lockItems: Item[] = []
  assaultAlarmItems: Item[] = []
  smokeTriggerItems: Item[] = []

  ngOnInit(): void {
    forkJoin([
      this.openhabService.security.assaultTriggerItems(),
      this.openhabService.security.assaultDisarmerItems(),
      this.openhabService.security.lockItems(),
      this.openhabService.security.lockClosureItems(),
      this.openhabService.security.assaultAlarmItems(),
      this.openhabService.security.smokeTriggerItems()
    ]).subscribe({
      next: (items: GetItemListResponse[]) => {
        this.assaultTriggerItems = items[0].data
        this.assaultDisarmerItems = items[1].data
        this.lockItems = items[2].data
        this.lockClosureItems = items[3].data
        this.assaultAlarmItems = items[4].data
        this.smokeTriggerItems = items[5].data
      }
    })
  }
}
