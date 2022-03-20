import { Component, OnInit } from '@angular/core'
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationEnd,
  Route,
  Router
} from '@angular/router'
import { filter } from 'rxjs'
import { routes } from './app-routing.module'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(public activatedRoute: ActivatedRoute) {}

  ngOnInit(): void {}

  openHelp() {
    window.open('/help')
  }
}
