import { JsonDB } from 'node-json-db'
import * as Hapi from '@hapi/hapi'

declare module '@hapi/hapi' {
  interface PluginProperties {
    'app/json-storage': {
      get(item: string, path: string | undefined): any
      set(item: string, path: string | undefined, obj: any): void
      delete(item: string, path: string | undefined): void
    }
  }
}

const jsonStoragePlugin = {
  name: 'app/json-storage',
  register: async (server: Hapi.Server, options: { port?: number }) => {
    const db = new JsonDB(
      process.cwd() + '/data/json-storage.json',
      true,
      true,
      '/'
    )

    const dbHelper = (() => {
      const createPath = (item: string, path: string | undefined) =>
        '/' + [item].concat(path?.split('/') || []).join('/')
      return {
        get: (item: string, path: string | undefined) => {
          const fullPath = createPath(item, path)
          return db.exists(fullPath) ? db.getData(fullPath) : undefined
        },
        delete: (item: string, path: string | undefined) => {
          const fullPath = createPath(item, path)
          if (db.exists(fullPath)) {
            db.delete(fullPath)
          }
        },
        set: (item: string, path: string | undefined, obj: any) => {
          const fullPath = createPath(item, path)
          db.push(fullPath, obj, true)
        }
      }
    })()

    server.expose('get', dbHelper.get)
    server.expose('set', dbHelper.set)
    server.expose('delete', dbHelper.delete)

    // Start server on different port
    const jsonServer = Hapi.server({
      port:
        options.port !== undefined
          ? options.port
          : (server.info.port as number) + 1,
      host: server.info.host,
      routes: {
        cors: process.env.build !== 'production'
      }
    })

    jsonServer.route({
      method: 'GET',
      path: '/json-storage/{item}/{path*}',
      handler: (request, h) => {
        return { data: dbHelper.get(request.params.item, request.params.path) }
      }
    })

    jsonServer.route({
      method: 'POST',
      path: '/json-storage/{item}/{path*}',
      options: {
        payload: { allow: 'application/json' }
      },
      handler: (request, h) => {
        dbHelper.set(request.params.item, request.params.path, request.payload)
        return {
          success: true
        }
      }
    })

    jsonServer.route({
      method: 'DELETE',
      path: '/json-storage/{item}/{path*}',
      handler: (request, h) => {
        dbHelper.delete(request.params.item, request.params.path)
        return {
          success: true
        }
      }
    })

    server.events.on('stop', async () => {
      await jsonServer.stop({ timeout: 60 * 1000 })
    })

    await jsonServer.start()
    console.log('JSON-Server running on %s', jsonServer.info.uri)
  }
}

export default jsonStoragePlugin
