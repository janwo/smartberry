import { Injectable, OnInit } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import {
  ActivatedRouteSnapshot,
  CanActivate,
  RouterStateSnapshot
} from '@angular/router'
import { tap } from 'rxjs'
import { environment } from 'src/environments/environment'

export interface GetItemListResponse {
  data: Item[]
}

export interface GetSingleItemResponse {
  data: Item
}

export interface AuthResponse {
  success: boolean
  error?: string
  bearer?: string
}

export interface PostPutDeleteResponse {
  success: boolean
}

export interface Item {
  name: string
  label: string
  state: string
  link: string
  members?: Item[]
  jsonStorage?: { [key: string]: any }
  stateDescription?: { options: [{ value: string; label: string }] }
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
      .post<AuthResponse>(`${environment.API_URL()}/authenticate`, { bearer })
      .pipe(
        tap((response) => {
          if (response?.success) {
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

  getOptions() {
    if (!this.bearer) {
      return {}
    }
    return {
      headers: {
        Authorization: `Bearer ${this.bearer}`
      }
    }
  }

  public general = {
    itemsMap: () => {
      return this.http.get<{ data: { [key: string]: string } }>(
        `${environment.API_URL()}/items-map`,
        this.getOptions()
      )
    }
  }

  public scene = {
    items: () => {
      return this.http.get<GetItemListResponse>(
        `${environment.API_URL()}/scene-items`,
        this.getOptions()
      )
    },
    updateCustomMembers: (item: string, customMembers: string[]) => {
      return this.http.post<PostPutDeleteResponse>(
        `${environment.API_URL()}/scene-item/${item}/custom-members`,
        { customMembers },
        this.getOptions()
      )
    },
    deleteCustomMembers: (item: string) => {
      return this.http.delete<PostPutDeleteResponse>(
        `${environment.API_URL()}/scene-item/${item}/custom-members`,
        this.getOptions()
      )
    },
    updateContextStates: (
      item: string,
      contextStates: { [key: string]: string }
    ) => {
      return this.http.post<PostPutDeleteResponse>(
        `${environment.API_URL()}/scene-item/${item}/context-states`,
        { contextStates },
        this.getOptions()
      )
    },
    deleteContextStates: (item: string) => {
      return this.http.delete<PostPutDeleteResponse>(
        `${environment.API_URL()}/scene-item/${item}/context-states`,
        this.getOptions()
      )
    },
    triggerItems: () => {
      return this.http.get<GetItemListResponse>(
        `${environment.API_URL()}/scene-trigger-items`,
        this.getOptions()
      )
    },
    updateTriggerState: (
      item: string,
      triggerState: {
        targetScene: string
        to: any
        from?: any
        states?: any[]
      }
    ) => {
      triggerState.states = triggerState.states?.length
        ? triggerState.states
        : undefined
      return this.http.post<PostPutDeleteResponse>(
        `${environment.API_URL()}/scene-trigger-item/${item}/trigger-state`,
        { triggerState },
        this.getOptions()
      )
    }
  }

  public climate = {
    modeItems: () => {
      return this.http.get<GetItemListResponse>(
        `${environment.API_URL()}/heating-mode-items`,
        this.getOptions()
      )
    },
    contactSwitchableItems: () => {
      return this.http.get<GetItemListResponse>(
        `${environment.API_URL()}/heating-contact-switchable-items`,
        this.getOptions()
      )
    },
    updateCommandMap: (
      item: string,
      commandMap: { on: any; off: any; power: any; eco: any }
    ) => {
      return this.http.post<PostPutDeleteResponse>(
        `${environment.API_URL()}/heating-mode-item/${item}/command-map`,
        { commandMap },
        this.getOptions()
      )
    },
    deleteCommandMap: (item: string) => {
      return this.http.delete<PostPutDeleteResponse>(
        `${environment.API_URL()}/heating-mode-item/${item}/command-map`,
        this.getOptions()
      )
    }
  }
}
