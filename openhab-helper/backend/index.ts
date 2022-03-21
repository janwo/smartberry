import * as Hapi from '@hapi/hapi'
import filesPlugin from './plugins/files.js'
import healthcheckPlugin from './plugins/healthcheck.js'
import jsonStoragePlugin from './plugins/json-storage.js'
import * as path from 'path'
import uiApiPlugin from './plugins/ui-api.js'
import Joi from 'joi'
import helpPlugin from './plugins/help.js'
import authenticationPlugin from './plugins/authentication.js'
import { plugin as jwtPlugin } from '@hapi/jwt'

const init = async () => {
  const server = Hapi.server({
    port: 8081,
    host: '0.0.0.0',
    routes: {
      cors: process.env.build !== 'production',
      files: {
        relativeTo: path.resolve(process.cwd(), './dist')
      }
    }
  })

  server.validator(Joi)

  await server.register([
    jsonStoragePlugin,
    healthcheckPlugin,
    filesPlugin,
    helpPlugin,
    jwtPlugin,
    authenticationPlugin,
    uiApiPlugin
  ])

  await server.start()
  console.log('Server running on %s', server.info.uri)
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

init()
