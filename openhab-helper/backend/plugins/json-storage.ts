import { JsonDB } from 'node-json-db'
import * as Hapi from '@hapi/hapi'

export const LOCALHOST_AUTH_STRATEGY = 'LOCAL'

const jsonStoragePlugin = {
  name: 'app/json-storage',
  dependencies: ['app/authentication'],
  register: async (server: Hapi.Server) => {
    // Add localhost scheme
    server.auth.scheme(LOCALHOST_AUTH_STRATEGY, () => {
      return {
        authenticate(request, h) {
          const { remoteAddress } = request.info
          if (remoteAddress == '127.0.0.1') {
            return h.authenticated({ credentials: {} as any })
          }
          throw h.unauthenticated(
            new Error(`${remoteAddress} is not a valid IP.`)
          )
        }
      }
    })
    server.auth.strategy(LOCALHOST_AUTH_STRATEGY, LOCALHOST_AUTH_STRATEGY)

    const db = new JsonDB(
      process.cwd() + '/data/json-storage.json',
      true,
      true,
      '/'
    )

    server.route({
      method: 'GET',
      options: { auth: LOCALHOST_AUTH_STRATEGY },
      path: '/json-storage/{item}/{path*}',
      handler: (request, h) => {
        const path =
          '/' +
          [request.params.item]
            .concat(request.params.path?.split('/') || [])
            .join('/')
        if (!db.exists(path)) {
          return { data: undefined }
        }
        return { data: db.getData(path) }
      }
    })

    server.route({
      method: 'POST',
      path: '/json-storage/{item}/{path*}',
      options: {
        auth: LOCALHOST_AUTH_STRATEGY,
        payload: { allow: 'application/json' }
      },
      handler: (request, h) => {
        const path =
          '/' +
          [request.params.item]
            .concat(request.params.path?.split('/') || [])
            .join('/')
        db.push(path, request.payload, true)
        return {
          success: true
        }
      }
    })

    server.route({
      method: 'DELETE',
      options: { auth: LOCALHOST_AUTH_STRATEGY },
      path: '/json-storage/{item}/{path*}',
      handler: (request, h) => {
        const path =
          '/' +
          [request.params.item]
            .concat(request.params.path?.split('/') || [])
            .join('/')
        if (db.exists(path)) {
          db.delete(path)
        }
        return {
          success: true
        }
      }
    })
  }
}

export default jsonStoragePlugin
