import * as Hapi from '@hapi/hapi'
import axios from 'axios'
import Joi from 'joi'

interface Item {
  name: string
  label: string
  state: string
  stateDescription?: { options: [{ [key: string]: string }] }
}

const HOST = process.env.build === 'production' ? 'openhab' : 'smartberry'
const OPENHAB_URL = `http://${HOST}:8080/rest/`

async function openhabGET(
  url: string,
  bearer: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  return axios
    .get(`${OPENHAB_URL}${url}`, {
      headers: {
        Authorization: `Bearer ${bearer}`
      }
    })
    .then((response) => {
      return { success: true, data: response.data }
    })
    .catch((e) => {
      return { success: false, error: e.response.statusText || e.code }
    })
}

const uiApiPlugin = {
  name: 'app/ui-api',
  dependencies: ['app/authentication', 'app/json-storage'],
  register: async (server: Hapi.Server) => {
    // scene routes
    server.route({
      method: 'GET',
      path: '/api/scene-items',
      handler: async (request, h) => {
        const result = await openhabGET(
          'items?tags=CoreScene&recursive=false',
          request.auth.credentials.openhab.bearer
        )

        return h.response(result).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/scene-trigger-items',
      handler: async (request, h) => {
        const result = await openhabGET(
          'items?tags=CoreSceneTrigger&recursive=false',
          request.auth.credentials.openhab.bearer
        )

        return h.response(result).code(200)
      }
    })

    // heating routes
    server.route({
      method: 'GET',
      path: '/api/heating-mode-items',
      handler: async (request, h) => {
        const result = await openhabGET(
          'items/gCore_Heating_Thermostat_Mode?recursive=true',
          request.auth.credentials.openhab.bearer
        )

        result.data = await Promise.all(
          result.data.members.map(
            async (item: Item & { commandMap: { [key: string]: any } }) => {
              const jsonStorage = server.plugins['app/json-storage'].get(
                item.name,
                'heating/command-map'
              )
              if (jsonStorage) {
                item.commandMap = {
                  off: jsonStorage['0.0'],
                  on: jsonStorage['1.0'],
                  eco: jsonStorage['2.0'],
                  power: jsonStorage['3.0']
                }
              }
              return item
            }
          )
        )
        return h.response(result).code(200)
      }
    })

    server.route({
      method: 'POST',
      path: '/api/heating-mode-item/{item}',
      options: {
        validate: {
          params: { item: Joi.string().required() },
          payload: Joi.object({
            on: Joi.string().alphanum().empty('').optional(),
            off: Joi.string().alphanum().empty('').optional(),
            eco: Joi.string().alphanum().empty('').optional(),
            power: Joi.string().alphanum().empty('').optional()
          })
        }
      },
      handler: async (request, h) => {
        const { on, off, eco, power } = request.payload as any
        server.plugins['app/json-storage'].set(
          request.params.item,
          'heating/command-map',
          {
            '0.0': off,
            '1.0': on,
            '2.0': eco,
            '3.0': power
          }
        )
        return h.response({ success: true }).code(200)
      }
    })
  }
}

export default uiApiPlugin
