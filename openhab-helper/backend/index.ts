import Joi from 'joi'
import * as path from 'path'
import * as Hapi from '@hapi/hapi'
import filesPlugin from './plugins/files.js'
import healthcheckPlugin from './plugins/healthcheck.js'
import jsonStoragePlugin from './plugins/json-storage.js'
import openhabHeatingPlugin from './plugins/openhab-heating.js'
import openhabScenesPlugin from './plugins/openhab-scenes.js'
import openhabPresencePlugin from './plugins/openhab-presence'
import openhabPlugin from './plugins/openhab.js'
import authenticationPlugin from './plugins/authentication.js'
import { plugin as jwtPlugin } from '@hapi/jwt'

const init = async () => {
  const server = Hapi.server({
    port: 8081,
    host: '0.0.0.0',
    routes: {
      cors: process.env.build !== 'production',
      validate: {
        failAction: async (request, h, err) => {
          if (process.env.build !== 'production') {
            console.error(err)
            throw err
          }
        }
      }
    }
  })

  server.validator(Joi)

  await server.register([
    jsonStoragePlugin,
    healthcheckPlugin,
    filesPlugin,
    openhabPlugin,
    openhabHeatingPlugin,
    openhabPresencePlugin,
    jwtPlugin,
    authenticationPlugin,
    openhabScenesPlugin
  ])

  await server.start()
  console.log('Server running on %s', server.info.uri)
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

init()
