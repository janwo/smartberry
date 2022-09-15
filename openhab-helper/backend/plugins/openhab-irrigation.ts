import * as Hapi from '@hapi/hapi'
import axios from 'axios'
import Joi from 'joi'

const openhabIrrigationPlugin = {
  name: 'app/openhab-irrigation',
  dependencies: ['app/openhab'],
  register: async (server: Hapi.Server) => {
    server.route({
      method: 'GET',
      path: '/api/irrigation-api',
      handler: async (request, h) => {
        const apiKey = await server.plugins['app/json-storage'].get(
          'gCore_Irrigation',
          'irrigation/api-key'
        )

        const latitude = await server.plugins['app/json-storage'].get(
          'gCore_Irrigation',
          'irrigation/latitude'
        )

        const longitude = await server.plugins['app/json-storage'].get(
          'gCore_Irrigation',
          'irrigation/longitude'
        )

        const locale = await server.plugins['app/openhab'].getLocale(request)

        return h
          .response({
            data: {
              hasApiKey: !!apiKey,
              latitude,
              longitude,
              syncedLocation:
                latitude == locale.latitude && longitude == locale.longitude
            }
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
            apiSettings: Joi.object({
              syncLocation: Joi.boolean().optional(),
              apiKey: Joi.string()
                .pattern(/^[a-zA-Z_0-9]+$/)
                .optional()
            }).min(1)
          }
        }
      },
      handler: async (request, h) => {
        const { apiSettings } = request.payload as any
        const locale = await server.plugins['app/openhab'].getLocale(request)
        const latitude = await server.plugins['app/json-storage'].get(
          'gCore_Irrigation',
          'irrigation/latitude'
        )
        const longitude = await server.plugins['app/json-storage'].get(
          'gCore_Irrigation',
          'irrigation/longitude'
        )

        if (
          latitude == undefined ||
          longitude === undefined ||
          apiSettings.syncLocation === true
        ) {
          if (locale.latitude === undefined || locale.longitude === undefined) {
            return h.response({ success: false, error: 'nolocation' }).code(200)
          }

          await server.plugins['app/json-storage'].set(
            'gCore_Irrigation',
            'irrigation/latitude',
            locale.latitude
          )
          await server.plugins['app/json-storage'].set(
            'gCore_Irrigation',
            'irrigation/longitude',
            locale.longitude
          )
        }

        if (apiSettings.apiKey) {
          const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&exclude=hourly,minutely,current,alerts&appid=${apiSettings.apiKey}`
          const authenticated = await axios
            .get(url)
            .then(() => true)
            .catch(() => false)

          if (!authenticated) {
            return h
              .response({ success: false, error: 'unauthenticated' })
              .code(200)
          }

          await server.plugins['app/json-storage'].set(
            'gCore_Irrigation',
            'irrigation/api-key',
            apiSettings.apiKey
          )
        }

        return h.response({ success: true }).code(200)
      }
    })

    server.route({
      method: 'DELETE',
      path: '/api/irrigation-api',
      handler: async (request, h) => {
        await server.plugins['app/json-storage'].delete(
          'gCore_Irrigation',
          'irrigation/api-key'
        )

        await server.plugins['app/json-storage'].delete(
          'gCore_Irrigation',
          'irrigation/longitude'
        )

        await server.plugins['app/json-storage'].delete(
          'gCore_Irrigation',
          'irrigation/latitude'
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
        const weatherHistory =
          (await server.plugins['app/json-storage'].get(
            'gCore_Irrigation',
            'irrigation/weather-history'
          )) || []

        const weatherForecast =
          (await server.plugins['app/json-storage'].get(
            'gCore_Irrigation',
            'irrigation/weather-forecast'
          )) || []

        const items = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Irrigation_Valves',
          true
        )

        const result = (items.members || []).map(async (item) => {
          const irrigationLevelPerMinute = await server.plugins[
            'app/json-storage'
          ].get(item.name, 'irrigation/irrigation-level-per-minute')

          const observedDays = await server.plugins['app/json-storage'].get(
            item.name,
            'irrigation/observed-days'
          )

          const overshootDays = await server.plugins['app/json-storage'].get(
            item.name,
            'irrigation/overshoot-days'
          )

          const evaporationFactor = await server.plugins[
            'app/json-storage'
          ].get(item.name, 'irrigation/evaporation-factor')

          const minimalTemperature = await server.plugins[
            'app/json-storage'
          ].get(item.name, 'irrigation/minimal-temperature')

          const irrigationHistory =
            (await server.plugins['app/json-storage'].get(
              item.name,
              'irrigation/history'
            )) || {}

          const lastActivation = await server.plugins['app/json-storage'].get(
            item.name,
            'irrigation/last-activation'
          )

          const lastActivationCompleted = await server.plugins[
            'app/json-storage'
          ].get(item.name, 'irrigation/last-activation-completed')

          item.jsonStorage = {
            irrigationLevelPerMinute,
            overshootDays,
            evaporationFactor,
            minimalTemperature,
            observedDays,
            series: [
              ...weatherHistory,
              ...weatherForecast
                .slice(0, Math.min(8, weatherForecast.length))
                .map((wf: any) => ({ ...wf, forecast: true }))
            ].map((s) => {
              const irrigation = irrigationHistory[s.date]
              return irrigation ? { ...s, irrigation } : s
            }),
            totalMonthlyIrrigation: Object.keys(irrigationHistory).reduce(
              (amount, date) => amount + irrigationHistory[date],
              0
            ),
            lastActivation,
            lastActivationCompleted
          }

          return item
        })
        return h.response({ data: await Promise.all(result) }).code(200)
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
              evaporationFactor: Joi.number().min(0).required(),
              minimalTemperature: Joi.string()
                .regex(/\d*[FC]/)
                .optional(),
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
          minimalTemperature,
          evaporationFactor,
          observedDays
        } = irrigationValues

        await server.plugins['app/json-storage'].set(
          request.params.item,
          'irrigation/irrigation-level-per-minute',
          irrigationLevelPerMinute
        )

        await server.plugins['app/json-storage'].set(
          request.params.item,
          'irrigation/observed-days',
          observedDays
        )

        await server.plugins['app/json-storage'].set(
          request.params.item,
          'irrigation/evaporation-factor',
          evaporationFactor
        )

        await server.plugins['app/json-storage'].set(
          request.params.item,
          'irrigation/minimal-temperature',
          minimalTemperature
        )

        await server.plugins['app/json-storage'].set(
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
        await server.plugins['app/json-storage'].delete(
          'gCore_Irrigation',
          'irrigation'
        )
        return h.response({ success: true }).code(200)
      }
    })
  }
}

export default openhabIrrigationPlugin
