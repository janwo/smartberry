import * as Hapi from '@hapi/hapi'
import Joi from 'joi'

const openhabPresencePlugin = {
  name: 'app/openhab-presence',
  dependencies: ['app/openhab'],
  register: async (server: Hapi.Server) => {
    server.route({
      method: 'GET',
      path: '/api/presence-items',
      handler: async (request, h) => {
        const item = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Presence_PresenceTrigger',
          true
        )

        const result = (item?.members || []).map((item) => {
          const absence = server.plugins['app/json-storage'].get(
            item.name,
            'presence/absence-states'
          )
          const presence = server.plugins['app/json-storage'].get(
            item.name,
            'presence/presence-states'
          )
          const states = absence || presence ? { absence, presence } : undefined

          item.jsonStorage = { states }
          return item
        })
        return h.response({ data: result }).code(200)
      }
    })

    server.route({
      method: 'POST',
      path: '/api/presence-item/{item}/states',
      options: {
        validate: {
          params: {
            item: Joi.string().pattern(/[a-zA-Z_0-9]+/)
          },
          payload: Joi.object({
            presence: Joi.array()
              .items(Joi.string().alphanum().required())
              .min(1)
              .optional(),
            absence: Joi.array()
              .items(Joi.string().alphanum().required())
              .min(1)
              .optional()
          }).min(1)
        }
      },
      handler: async (request, h) => {
        const { presence, absence } = request.payload as any
        server.plugins['app/json-storage'].set(
          request.params.item,
          `presence/absence-states`,
          absence
        )

        server.plugins['app/json-storage'].set(
          request.params.item,
          `presence/presence-states`,
          presence
        )
        return h.response({ success: true }).code(200)
      }
    })

    server.route({
      method: 'DELETE',
      path: '/api/presence-item/{item}/states',
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
          `presence/absence-states`
        )
        server.plugins['app/json-storage'].delete(
          request.params.item,
          `presence/presence-states`
        )
        return h.response({ success: true }).code(200)
      }
    })
  }
}

export default openhabPresencePlugin
