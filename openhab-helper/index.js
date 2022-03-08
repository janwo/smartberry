import * as Hapi from '@hapi/hapi'
import { JsonDB } from 'node-json-db'
import * as fs from 'fs'

const init = async () => {
  const dir = process.cwd() + '/data'
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }
  const db = new JsonDB(dir + '/metadata.json', true, true, '/')
  const server = Hapi.server({
    port: 8080,
    host: '0.0.0.0'
  })

  server.route({
    method: 'GET',
    path: '/metadata/{item}/{path*}',
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
    path: '/metadata/{item}/{path*}',
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
    path: '/metadata/{item}/{path*}',
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

  await server.start()
  console.log('Server running on %s', server.info.uri)
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

init()
