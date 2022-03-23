import inertPlugin from '@hapi/inert'
import * as Hapi from '@hapi/hapi'

const filesPlugin = {
  name: 'app/files',
  register: async (server: Hapi.Server) => {
    await server.register(inertPlugin)
    server.route({
      method: 'GET',
      options: { auth: false },
      path: '/{p*}',
      handler: {
        directory: {
          path: './frontend',
          index: ['index.html'],
          listing: false
        }
      }
    })

    server.ext('onPreResponse', (request, reply) => {
      const response = request.response as any
      if (response.isBoom && response.output.statusCode === 404) {
        return reply.file('./frontend/index.html').code(200)
      }

      return reply.continue
    })
  }
}

export default filesPlugin
