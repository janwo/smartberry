import { Injectable, OnInit } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import {
  ActivatedRouteSnapshot,
  CanActivate,
  RouterStateSnapshot
} from '@angular/router'
import { map, tap } from 'rxjs'

interface Response {
  success: boolean
  data?: unknown
  error?: string
}

export interface Item {
  name: string
  label: string
  state: string
  members?: Item[]
  stateDescription?: { options: [{ [key: string]: string }] }
}

@Injectable({
  providedIn: 'root'
})
export class OpenhabService implements CanActivate {
  private get bearer() {
    return localStorage.getItem('bearer')
  }

  private set bearer(bearer: string | null) {
    if (bearer === null) {
      localStorage.removeItem('bearer')
    } else {
      localStorage.setItem('bearer', bearer)
    }
  }

  constructor(private http: HttpClient) {}

  unregister() {
    this.bearer = null
  }

  register(bearer: string) {
    return this.http
      .post<{
        success: boolean
        error?: string
        bearer?: string
      }>('http://localhost:8080/authenticate', { bearer })
      .pipe(
        tap((response) => {
          if (response.success) {
            this.bearer = response.bearer || null
          }
        })
      )
  }

  authenticated() {
    return !!this.bearer
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.authenticated()
  }

  getSceneItems() {
    return this.http.get<Response & { data: Item[] }>(
      'http://localhost:8080/scene-items',
      {
        headers: {
          Authorization: `Bearer ${this.bearer}`
        }
      }
    )
  }

  getSceneTriggerItems() {
    return this.http.get<Response & { data: Item[] }>(
      'http://localhost:8080/scene-trigger-items',
      {
        headers: {
          Authorization: `Bearer ${this.bearer}`
        }
      }
    )
  }

  getHeatingModeItems() {
    return this.http.get<
      Response & {
        data: Array<
          Item & { commandMap: { on: any; off: any; power: any; eco: any } }
        >
      }
    >('http://localhost:8080/heating-mode-items', {
      headers: {
        Authorization: `Bearer ${this.bearer}`
      }
    })
  }

  updateHeaterModeItem(
    item: string,
    commandMap: { on: any; off: any; power: any; eco: any }
  ) {
    return this.http.post<Response>(
      `http://localhost:8080/heating-mode-item/${item}`,
      commandMap,
      {
        headers: {
          Authorization: `Bearer ${this.bearer}`
        }
      }
    )
  }
}
