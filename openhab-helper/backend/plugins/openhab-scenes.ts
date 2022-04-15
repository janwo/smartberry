import * as Hapi from '@hapi/hapi'
import Joi from 'joi'

const openhabScenesPlugin = {
  name: 'app/openhab-scenes',
  dependencies: ['app/openhab'],
  register: async (server: Hapi.Server) => {
    server.route({
      method: 'GET',
      path: '/api/scene-items',
      handler: async (request, h) => {
        const item = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Scenes',
          true
        )
        const result = (item?.members || []).map((item) => {
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
          params: {
            item: Joi.string().pattern(/[a-zA-Z_0-9]+/)
          },
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
          params: {
            item: Joi.string().pattern(/[a-zA-Z_0-9]+/)
          }
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
          params: {
            item: Joi.string().pattern(/[a-zA-Z_0-9]+/)
          },
          payload: {
            contextStates: Joi.object()
              .pattern(
                /[a-zA-Z_0-9]+/,
                Joi.string()
                  .pattern(/\d+\.\d+/)
                  .required()
              )
              .required()
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
          params: {
            item: Joi.string().pattern(/[a-zA-Z_0-9]+/)
          }
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
        const item = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Scenes_StateTriggers',
          true
        )

        const result = (item?.members || []).map((item) => {
          let triggerState = server.plugins['app/json-storage'].get(
            item.name,
            'scenes/trigger-state'
          )
          triggerState =
            triggerState !== undefined
              ? {
                  from: triggerState['from'],
                  to: triggerState['to'],
                  generated: triggerState['generated'],
                  states: triggerState['states'],
                  targetScene: triggerState['target-scene'],
                  hoursUntilActive: triggerState['hours-until-active'],
                  minutesUntilActive: triggerState['minutes-until-active'],
                  secondsUntilActive: triggerState['seconds-until-active']
                }
              : undefined

          item.jsonStorage = { triggerState }
          return item
        })
        return h.response({ data: result }).code(200)
      }
    })

    server.route({
      method: 'POST',
      path: '/api/scene-trigger-item/{item}/trigger-state',
      options: {
        validate: {
          params: {
            item: Joi.string().pattern(/[a-zA-Z_0-9]+/)
          },
          payload: {
            triggerState: Joi.object({
              to: Joi.string()
                .pattern(/\d+\.\d+/)
                .required(),
              from: Joi.string()
                .pattern(/\d+\.\d+/)
                .optional(),
              targetScene: Joi.string()
                .pattern(/[a-zA-Z_0-9]+/)
                .required(),
              states: Joi.array()
                .items(Joi.string().alphanum().required())
                .min(1)
                .optional(),
              hoursUntilActive: Joi.number().min(1).optional(),
              minutesUntilActive: Joi.number().min(1).optional(),
              secondsUntilActive: Joi.number().min(1).optional()
            })
          }
        }
      },
      handler: async (request, h) => {
        const { triggerState } = request.payload as any
        const generated = server.plugins['app/json-storage'].get(
          request.params.item,
          'scenes/trigger-state/generated'
        )

        server.plugins['app/json-storage'].set(
          request.params.item,
          'scenes/trigger-state',
          {
            from: triggerState.from,
            to: triggerState.to,
            states: triggerState.states,
            generated,
            'target-scene': triggerState.targetScene,
            'hours-until-active': triggerState.hoursUntilActive,
            'minutes-until-active': triggerState.minutesUntilActive,
            'seconds-until-active': triggerState.secondsUntilActive
          }
        )
        return h.response({ success: true }).code(200)
      }
    })

    server.route({
      method: 'DELETE',
      path: '/api/scene-trigger-item/{item}/trigger-state',
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
          'scenes/trigger-state'
        )
        return h.response({ success: true }).code(200)
      }
    })
  }
}

export default openhabScenesPlugin
