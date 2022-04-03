import { Component, OnInit } from '@angular/core'
import { routes } from '../app-routing.module'
import { OpenhabService } from '../openhab.service'

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  constructor(public openhabService: OpenhabService) {}
  ngOnInit(): void {}

  get routeItems() {
    return routes
      .filter((r) => !!r.data?.['title'] && !!r.data?.['icon'])
      .map((r) => {
        const hide =
          r.canActivate?.find((g) => g.name == OpenhabService.name) &&
          !this.openhabService.authenticated()
        return {
          title: r.data?.['title'],
          icon: r.data?.['icon'],
          link: hide ? null : r.path
        }
      })
  }
}
