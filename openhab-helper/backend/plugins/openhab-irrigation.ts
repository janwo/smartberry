import * as Hapi from '@hapi/hapi'
import axios from 'axios'
import Joi from 'joi'

const openhabIrrigationPlugin = {
  name: 'app/openhab-irrigation',
  dependencies: ['app/openhab'],
  register: async (server: Hapi.Server) => {
    server.route({
      method: 'GET',
      path: '/api/irrigation-settings',
      handler: async (request, h) => {
        const locale = await server.plugins['app/openhab'].getLocale(request)
        const latitude = locale.latitude
        const longitude = locale.longitude

        const apiKey = !!server.plugins['app/json-storage'].get(
          'gCore_Irrigation',
          'irrigation/api-key'
        )

        return h
          .response({
            data: { apiKey, latitude, longitude }
          })
          .code(200)
      }
    })

    server.route({
      method: 'POST',
      path: '/api/irrigation-api',
      options: {
        validate: {
          payload: {
            key: Joi.string()
              .pattern(/^[a-zA-Z_0-9]+$/)
              .required()
          }
        }
      },
      handler: async (request, h) => {
        const { key } = request.payload as any
        const locale = await server.plugins['app/openhab'].getLocale(request)
        const latitude = locale.latitude
        const longitude = locale.longitude

        const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&exclude=hourly,minutely,current,alerts&appid=${key}`
        const authenticated = await axios
          .get(url)
          .then(() => true)
          .catch(() => false)

        if (authenticated) {
          server.plugins['app/json-storage'].set(
            'gCore_Irrigation',
            'irrigation/api-key',
            key
          )
          return h.response({ success: true }).code(200)
        }

        return h
          .response({ success: false, error: 'unauthenticated' })
          .code(200)
      }
    })

    server.route({
      method: 'DELETE',
      path: '/api/irrigation-api',
      handler: async (request, h) => {
        server.plugins['app/json-storage'].delete(
          'gCore_Irrigation',
          'irrigation/api-key'
        )
        return h.response({ success: true }).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/irrigation-trigger-items',
      handler: async (request, h) => {
        const item = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Irrigation_Triggers',
          true
        )

        return h.response({ data: item?.members || [] }).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/irrigation-valve-items',
      handler: async (request, h) => {
        let items = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Irrigation_Valves',
          true
        )
        const result = (items.members || []).map((item) => {
          const irrigationLevelPerMinute = server.plugins[
            'app/json-storage'
          ].get(item.name, 'irrigation/irrigation-level-per-minute')

          const observedDays = server.plugins['app/json-storage'].get(
            item.name,
            'irrigation/observed-days'
          )

          const overshootDays = server.plugins['app/json-storage'].get(
            item.name,
            'irrigation/overshoot-days'
          )

          const aimedPrecipitationLevel = server.plugins[
            'app/json-storage'
          ].get(item.name, 'irrigation/aimed-precipitation-level')

          item.jsonStorage = {
            irrigationLevelPerMinute,
            overshootDays,
            aimedPrecipitationLevel,
            observedDays
          }
          return item
        })
        return h.response({ data: result }).code(200)
      }
    })

    server.route({
      method: 'POST',
      path: '/api/irrigation-valve-items/{item}',
      options: {
        validate: {
          params: {
            item: Joi.string().pattern(/^[a-zA-Z_0-9]+$/)
          },
          payload: {
            irrigationValues: Joi.object({
              irrigationLevelPerMinute: Joi.number().min(0).required(),
              overshootDays: Joi.number().min(0).required(),
              aimedPrecipitationLevel: Joi.number().min(0).required(),
              observedDays: Joi.number().min(0).required()
            }).required()
          }
        }
      },
      handler: async (request, h) => {
        const { irrigationValues } = request.payload as any
        const {
          irrigationLevelPerMinute,
          overshootDays,
          aimedPrecipitationLevel,
          observedDays
        } = irrigationValues

        server.plugins['app/json-storage'].set(
          request.params.item,
          'irrigation/irrigation-level-per-minute',
          irrigationLevelPerMinute
        )

        server.plugins['app/json-storage'].set(
          request.params.item,
          'irrigation/observed-days',
          observedDays
        )

        server.plugins['app/json-storage'].set(
          request.params.item,
          'irrigation/aimed-precipitation-level',
          aimedPrecipitationLevel
        )

        server.plugins['app/json-storage'].set(
          request.params.item,
          'irrigation/overshoot-days',
          overshootDays
        )
        return h.response({ success: true }).code(200)
      }
    })

    server.route({
      method: 'DELETE',
      path: '/api/irrigation-valve-items/{item}',
      handler: async (request, h) => {
        server.plugins['app/json-storage'].delete(
          'gCore_Irrigation',
          'irrigation'
        )
        return h.response({ success: true }).code(200)
      }
    })
  }
}

export default openhabIrrigationPlugin
