import * as Hapi from '@hapi/hapi'

const openhabSecurityPlugin = {
  name: 'app/openhab-security',
  dependencies: ['app/openhab'],
  register: async (server: Hapi.Server) => {
    server.route({
      method: 'GET',
      path: '/api/security-lock-items',
      handler: async (request, h) => {
        const item = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Security_Locks',
          true
        )

        return h.response({ data: item?.members || [] }).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/security-lock-closure-items',
      handler: async (request, h) => {
        const item = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Security_LockClosureTrigger',
          true
        )

        return h.response({ data: item?.members || [] }).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/security-assault-alarm-items',
      handler: async (request, h) => {
        const item = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Security_AssaultAlarms',
          true
        )

        return h.response({ data: item?.members || [] }).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/security-smoke-trigger-items',
      handler: async (request, h) => {
        const item = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Security_SmokeTrigger',
          true
        )

        return h.response({ data: item?.members || [] }).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/security-assault-trigger-items',
      handler: async (request, h) => {
        const item = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Security_AssaultTrigger',
          true
        )

        return h.response({ data: item?.members || [] }).code(200)
      }
    })

    server.route({
      method: 'GET',
      path: '/api/security-assault-disarmer-items',
      handler: async (request, h) => {
        const item = await request.server.plugins['app/openhab'].getItem(
          request,
          'gCore_Security_AssaultDisarmamer',
          true
        )

        return h.response({ data: item?.members || [] }).code(200)
      }
    })
  }
}

export default openhabSecurityPlugin
