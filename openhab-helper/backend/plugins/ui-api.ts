import * as Hapi from '@hapi/hapi'
import axios from 'axios'
import Joi from 'Joi'

interface Item {
  name: string
  label: string
  state: string
  stateDescription?: { options: [{ [key: string]: string }] }
}

const URL = 'http://openhab:8080/rest/'

async function openhabGET(
  url: string,
  bearer: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  return axios
    .get(`${URL}${url}`, {
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
      path: '/scene-items',
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
      path: '/scene-trigger-items',
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
      path: '/heating-mode-items',
      handler: async (request, h) => {
        const result = await openhabGET(
          'items/gCore_Heating_Thermostat_Mode?recursive=true',
          request.auth.credentials.openhab.bearer
        )

        result.data = await Promise.all(
          result.data.members.map(
            async (item: Item & { commandMap: { [key: string]: any } }) => {
              const response = await server.inject(
                `/json-storage/${item.name}/heating/command-map`
              )
              const jsonStorage = JSON.parse(response.payload).data
              if (jsonStorage) {
                const commandMap = {
                  off: jsonStorage['0.0'],
                  on: jsonStorage['1.0'],
                  eco: jsonStorage['2.0'],
                  power: jsonStorage['3.0']
                }
                item.commandMap = commandMap
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
      path: '/heating-mode-item/{item}',
      options: {
        validate: {
          params: { item: Joi.string().required() },
          payload: Joi.object({
            on: Joi.required(),
            off: Joi.required(),
            eco: Joi.required(),
            power: Joi.required()
          })
        }
      },
      handler: async (request, h) => {
        const { on, off, eco, power } = request.payload as any
        const payload = {
          '0.0': off,
          '1.0': on,
          '2.0': eco,
          '3.0': power
        }
        const response = await server.inject({
          method: 'POST',
          payload,
          url: `/json-storage/${request.params.item}/heating/command-map`
        })
        return h.response(response.payload).code(response.statusCode)
      }
    })
  }
}

export default uiApiPlugin
