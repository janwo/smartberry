import * as Hapi from '@hapi/hapi'

const openhabLightPlugin = {
  name: 'app/openhab-light',
  dependencies: ['app/openhab'],
  register: async (server: Hapi.Server) => {
    server.route({
      method: 'GET',
      path: '/api/light-switchable-items',
      handler: async (request, h) => {
        const item = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Lights_Switchables',
          true
        )

        return h.response({ data: item?.members || [] }).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/light-measurement-items',
      handler: async (request, h) => {
        const items = await request.server.plugins['app/openhab'].getItems(
          request,
          ['Light', 'Measurement'],
          false
        )

        return h.response({ data: items }).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/light-astro-items',
      handler: async (request, h) => {
        const items = await request.server.plugins['app/openhab'].getItems(
          request,
          ['CoreAstroSun'],
          false
        )

        return h.response({ data: items }).code(200)
      }
    })
  }
}

export default openhabLightPlugin
