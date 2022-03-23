import inertPlugin from '@hapi/inert'
import * as Hapi from '@hapi/hapi'

const helpPlugin = {
  name: 'app/help',
  register: async (server: Hapi.Server) => {
    await server.register(inertPlugin)
    server.route({
      options: { auth: false },
      method: 'GET',
      path: '/help',
      handler: {
        file: './backend/help.html'
      }
    })
  }
}

export default helpPlugin
