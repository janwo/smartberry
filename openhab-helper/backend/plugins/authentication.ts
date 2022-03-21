import * as hapi from '@hapi/hapi'
import * as Joi from 'joi'
import * as Jwt from '@hapi/jwt'
import * as Boom from '@hapi/boom'
import axios from 'axios'

export const API_AUTH_STATEGY = 'API'
const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_JWT_SECRET'
const HOST = process.env.build === 'production' ? 'openhab' : 'smartberry'
const OPENHAB_URL = `http://${HOST}:8080/rest/items`

declare module '@hapi/hapi' {
  interface AuthCredentials extends JWTToken {}
}

export type JWTToken = {
  openhab: { bearer: string }
}

async function handleToken(
  request: hapi.Request,
  h: hapi.ResponseToolkit
): Promise<hapi.ResponseObject | Boom.Boom> {
  const { bearer } = request.payload as any

  //connect to openhab
  const result: { success: boolean; error?: string; bearer?: string } =
    await axios
      .get(OPENHAB_URL, {
        headers: {
          Authorization: `Bearer ${bearer}`
        }
      })
      .then((response) => {
        return {
          success: true,
          bearer: signJWT({
            openhab: {
              bearer
            }
          })
        }
      })
      .catch((e) => {
        return { success: false, error: e.response?.statusText || e.code }
      })

  return h.response(result).code(200)
}

function signJWT(payload: JWTToken): string {
  return Jwt.token.generate(
    payload,
    {
      key: JWT_SECRET,
      algorithm: 'HS512'
    },
    {
      iat: false
    }
  )
}

const authenticationPlugin = {
  name: 'app/authentication',
  register: async (server: hapi.Server) => {
    // Add jwt scheme
    server.auth.strategy(API_AUTH_STATEGY, 'jwt', {
      keys: JWT_SECRET,
      verify: { aud: false, iss: false, sub: false },
      validate: false
    })
    server.auth.default(API_AUTH_STATEGY)

    // Add authentication routes
    server.route({
      method: 'POST',
      path: '/api/authenticate',
      options: {
        auth: false,
        validate: {
          payload: Joi.object({
            bearer: Joi.string().required()
          })
        }
      },
      handler: handleToken
    })
  }
}

export default authenticationPlugin
