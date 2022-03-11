import * as Hapi from '@hapi/hapi'
import healthcheckPlugin from './plugins/healthcheck.js'
import jsonStoragePlugin from './plugins/json-storage.js'

const init = async () => {
  const server = Hapi.server({
    port: 8080,
    host: '0.0.0.0'
  })
  await server.register([jsonStoragePlugin, healthcheckPlugin])
  await server.start()
  console.log('Server running on %s', server.info.uri)
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

init()
