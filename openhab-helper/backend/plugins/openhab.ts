import * as Hapi from '@hapi/hapi'
import axios from 'axios'

declare module '@hapi/hapi' {
  interface PluginProperties {
    'app/openhab': {
      getItems: (
        request: Hapi.Request,
        tagFilter?: string[],
        recursive?: boolean
      ) => Promise<Item[]>
      getItem: (
        request: Hapi.Request,
        item: string,
        recursive?: boolean
      ) => Promise<Item>
      getLocale: (request: Hapi.Request) => Promise<Locale>
    }
  }

  interface ServerApplicationState {
    OPENHAB_URL: string
  }
}

export interface Item {
  name: string
  label: string
  state: string
  members?: Item[]
  jsonStorage?: { [key: string]: any }
  stateDescription?: { options: [{ [key: string]: string }] }
}

export interface Locale {
  language: string
  latitude: number
  longitude: number
  region: string
  measurementSystem: string
  timezone: string
}

function getOptions(bearer: string) {
  if (!bearer) {
    return {}
  }
  return {
    headers: {
      Authorization: `Bearer ${bearer}`
    }
  }
}

async function getLocale(request: Hapi.Request): Promise<Locale> {
  const url =
    request.server.app.OPENHAB_URL + '/services/org.openhab.i18n/config'

  return axios
    .get(url, getOptions(request.auth.credentials?.openhab?.bearer))
    .then((response) => {
      const { language, region, measurementSystem, timezone, location } =
        response.data
      const latitude = location?.split(',')[0]
      const longitude = location?.split(',')[1]

      return {
        language,
        longitude,
        latitude,
        region,
        measurementSystem,
        timezone
      }
    })
}

async function getItems(
  request: Hapi.Request,
  tagFilter?: string[],
  recursive = false
): Promise<Item[]> {
  let url =
    request.server.app.OPENHAB_URL + '/items?recursive=' + recursive.toString()
  if (tagFilter) {
    url = url + '&tags=' + tagFilter.map((tag) => tag.trim()).join(',')
  }
  return axios
    .get(url, getOptions(request.auth.credentials?.openhab?.bearer))
    .then((response) => response.data)
}

async function getItem(
  request: Hapi.Request,
  item: string,
  recursive = false
): Promise<Item> {
  let url =
    request.server.app.OPENHAB_URL +
    '/items/' +
    item +
    '?recursive=' +
    recursive.toString()
  return axios
    .get(url, getOptions(request.auth.credentials?.openhab?.bearer))
    .then((response) => response.data)
}

const openhabPlugin = {
  name: 'app/openhab',
  dependencies: ['app/authentication', 'app/json-storage'],
  register: async (server: Hapi.Server) => {
    server.app.OPENHAB_URL = `http://${
      process.env.build === 'production' ? 'openhab' : 'smartberry'
    }:8080/rest`
    server.expose('getItem', getItem)
    server.expose('getItems', getItems)
    server.expose('getLocale', getLocale)

    server.route({
      method: 'GET',
      path: '/api/items-map',
      handler: async (request, h) => {
        const result = await request.server.plugins['app/openhab'].getItems(
          request
        )
        const map = result.reduce((obj: any, item) => {
          obj[item.name] = item.label || item.name
          return obj
        }, {})
        return h.response({ data: map }).code(200)
      }
    })
  }
}

export default openhabPlugin
