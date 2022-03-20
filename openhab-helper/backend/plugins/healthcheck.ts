import * as Hapi from '@hapi/hapi'

const healthcheckPlugin = {
  name: 'app/healthcheck',
  register: async (server: Hapi.Server) => {
    server.route({
      options: { auth: false },
      method: 'GET',
      path: '/healthcheck',
      handler: (_, h) => {
        return h.response({ up: true }).code(200)
      }
    })
  }
}

export default healthcheckPlugin
