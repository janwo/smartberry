import * as Hapi from '@hapi/hapi'
import Joi from 'joi'

const openhabHeatingPlugin = {
  name: 'app/openhab-heating',
  dependencies: ['app/openhab'],
  register: async (server: Hapi.Server) => {
    server.route({
      method: 'GET',
      path: '/api/heating-mode-items',
      handler: async (request, h) => {
        let items = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Heating_Thermostat_Mode',
          true
        )
        const result = (items.members || []).map((item) => {
          let commandMap = server.plugins['app/json-storage'].get(
            item.name,
            'heating/command-map'
          )
          commandMap = {
            off: commandMap?.['0.0'],
            on: commandMap?.['1.0'],
            eco: commandMap?.['2.0'],
            power: commandMap?.['3.0']
          }

          item.jsonStorage = { commandMap }
          return item
        })
        return h.response({ data: result }).code(200)
      }
    })

    server.route({
      method: 'POST',
      path: '/api/heating-mode-item/{item}/command-map',
      options: {
        validate: {
          params: {
            item: Joi.string().pattern(/[a-zA-Z_0-9]+/)
          },
          payload: {
            commandMap: Joi.object({
              on: Joi.string().alphanum().required(),
              off: Joi.string().alphanum().required(),
              eco: Joi.string().alphanum().required(),
              power: Joi.string().alphanum().required()
            }).required()
          }
        }
      },
      handler: async (request, h) => {
        const { commandMap } = request.payload as any
        server.plugins['app/json-storage'].set(
          request.params.item,
          'heating/command-map',
          {
            '0.0': commandMap.off,
            '1.0': commandMap.on,
            '2.0': commandMap.eco,
            '3.0': commandMap.power
          }
        )
        return h.response({ success: true }).code(200)
      }
    })

    server.route({
      method: 'DELETE',
      path: '/api/heating-mode-item/{item}/command-map',
      options: {
        validate: {
          params: {
            item: Joi.string().pattern(/[a-zA-Z_0-9]+/)
          }
        }
      },
      handler: async (request, h) => {
        server.plugins['app/json-storage'].delete(
          request.params.item,
          'heating/command-map'
        )
        return h.response({ success: true }).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/heating-contact-switchable-items',
      handler: async (request, h) => {
        let items = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Heating_ContactSwitchable',
          true
        )
        const result = items.members || []
        return h.response({ data: result }).code(200)
      }
    })
  }
}

export default openhabHeatingPlugin
