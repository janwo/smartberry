import { Injectable, OnInit } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import {
  ActivatedRouteSnapshot,
  CanActivate,
  RouterStateSnapshot
} from '@angular/router'
import { map, tap } from 'rxjs'
import { environment } from 'src/environments/environment'

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

  register(bearer: string) {
    return this.http
      .post<{
        success: boolean
        error?: string
        bearer?: string
      }>(`${environment.API_URL()}/authenticate`, { bearer })
      .pipe(
        tap((response) => {
          if (response.success) {
            this.bearer = response.bearer || null
          }
        })
      )
  }

  unregister() {
    this.bearer = null
  }

  authenticated() {
    return !!this.bearer
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.authenticated()
  }

  public scene = {
    items: () => {
      return this.http.get<Response & { data: Item[] }>(
        `${environment.API_URL()}/scene-items`,
        {
          headers: {
            Authorization: `Bearer ${this.bearer}`
          }
        }
      )
    },
    triggerItems: () => {
      return this.http.get<Response & { data: Item[] }>(
        `${environment.API_URL()}/scene-trigger-items`,
        {
          headers: {
            Authorization: `Bearer ${this.bearer}`
          }
        }
      )
    }
  }

  public heating = {
    modeItems: () => {
      return this.http.get<
        Response & {
          data: Array<
            Item & { commandMap: { on: any; off: any; power: any; eco: any } }
          >
        }
      >(`${environment.API_URL()}/heating-mode-items`, {
        headers: {
          Authorization: `Bearer ${this.bearer}`
        }
      })
    },
    updateModeItems: (
      item: string,
      commandMap: { on: any; off: any; power: any; eco: any }
    ) => {
      return this.http.post<Response>(
        `${environment.API_URL()}/heating-mode-item/${item}`,
        commandMap,
        {
          headers: {
            Authorization: `Bearer ${this.bearer}`
          }
        }
      )
    }
  }
}
