import inertPlugin from '@hapi/inert'
import * as Accept from '@hapi/accept'
import * as fs from 'fs'
import * as Hapi from '@hapi/hapi'

const filesPlugin = {
  name: 'app/files',
  register: async (server: Hapi.Server) => {
    const frontendPath = process.cwd() + '/dist/frontend'
    const locales = fs.readdirSync(frontendPath)
    await server.register(inertPlugin)
    for (const locale of locales) {
      server.route({
        method: 'GET',
        options: { auth: false },
        path: '/' + locale + '/{p*}',
        handler: {
          directory: {
            path: frontendPath + '/' + locale,
            listing: false
          }
        }
      })
    }

    server.route({
      method: 'GET',
      options: { auth: false },
      path: '/{p*}',
      handler: (request, h) => {
        const language = Accept.language(
          request.headers['accept-language'],
          locales
        )
        return h.file(frontendPath + '/' + language + '/index.html').code(200)
      }
    })
  }
}

export default filesPlugin
