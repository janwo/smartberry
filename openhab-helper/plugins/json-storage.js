import { JsonDB } from 'node-json-db'
const jsonStoragePlugin = {
  name: 'json-storage',
  register: async (server) => {
    const db = new JsonDB(
      process.cwd() + '/data/json-storage.json',
      true,
      true,
      '/'
    )

    server.route({
      method: 'GET',
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
      options: { payload: { allow: 'application/json' } },
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
