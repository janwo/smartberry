import * as Hapi from '@hapi/hapi'
import Joi from 'joi'
import { Item } from './openhab'

const openhabScenesPlugin = {
  name: 'app/openhab-scenes',
  dependencies: ['app/authentication', 'app/json-storage'],
  register: async (server: Hapi.Server) => {
    // scene routes
    server.route({
      method: 'GET',
      path: '/api/scene-items',
      handler: async (request, h) => {
        const items = await request.server.plugins['app/openhab'].getItems(
          request,
          ['CoreScene'],
          false
        )
        const result = items.map((item) => {
          const customMembers = server.plugins['app/json-storage'].get(
            item.name,
            'scenes/custom-members'
          )
          const contextStates = server.plugins['app/json-storage'].get(
            item.name,
            'scenes/context-states'
          )
          item.jsonStorage = { customMembers, contextStates }
          return item
        })
        return h.response({ data: result }).code(200)
      }
    })

    server.route({
      method: 'POST',
      path: '/api/scene-item/{item}/custom-members',
      options: {
        validate: {
          params: { item: Joi.string().required() },
          payload: {
            customMembers: Joi.array()
              .items(
                Joi.string()
                  .pattern(/[a-zA-Z_0-9]+/)
                  .required()
              )
              .required()
          }
        }
      },
      handler: async (request, h) => {
        const { customMembers } = request.payload as any
        server.plugins['app/json-storage'].set(
          request.params.item,
          'scenes/custom-members',
          customMembers
        )
        return h.response({ success: true }).code(200)
      }
    })

    server.route({
      method: 'DELETE',
      path: '/api/scene-item/{item}/custom-members',
      options: {
        validate: {
          params: { item: Joi.string().required() }
        }
      },
      handler: async (request, h) => {
        server.plugins['app/json-storage'].delete(
          request.params.item,
          'scenes/custom-members'
        )
        return h.response({ success: true }).code(200)
      }
    })

    server.route({
      method: 'POST',
      path: '/api/scene-item/{item}/context-states',
      options: {
        validate: {
          params: { item: Joi.string().required() },
          payload: {
            contextStates: Joi.object()
              .pattern(
                /[a-zA-Z_0-9]+/,
                Joi.string()
                  .pattern(/\d+\.\d+/)
                  .required()
              )
              .optional()
          }
        }
      },
      handler: async (request, h) => {
        const { contextStates } = request.payload as any
        server.plugins['app/json-storage'].set(
          request.params.item,
          'scenes/context-states',
          contextStates
        )
        return h.response({ success: true }).code(200)
      }
    })

    server.route({
      method: 'DELETE',
      path: '/api/scene-item/{item}/context-states',
      options: {
        validate: {
          params: { item: Joi.string().required() }
        }
      },
      handler: async (request, h) => {
        server.plugins['app/json-storage'].delete(
          request.params.item,
          'scenes/context-states'
        )
        return h.response({ success: true }).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/scene-trigger-items',
      handler: async (request, h) => {
        const result = await request.server.plugins['app/openhab'].getItems(
          request,
          ['CoreSceneTrigger'],
          false
        )
        return h.response({ data: result }).code(200)
      }
    })
  }
}

export default openhabScenesPlugin
