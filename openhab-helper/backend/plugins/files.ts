import inertPlugin from '@hapi/inert'
import * as Accept from '@hapi/accept'
import * as fs from 'fs'
import * as Hapi from '@hapi/hapi'
import * as path from 'path'

function fileTree(directory: string, tree: { [key: string]: any } = {}) {
  const files = fs.readdirSync(directory)
  for (let file of files) {
    const filePath = path.join(directory, file)
    tree[file] = fs.lstatSync(filePath).isDirectory()
      ? fileTree(filePath, tree[file])
      : filePath
  }
  return tree
}

const filesPlugin = {
  name: 'app/files',
  register: async (server: Hapi.Server) => {
    const locales = fileTree(process.cwd() + '/dist/frontend')
    await server.register(inertPlugin)
    console.log(locales)
    server.route({
      method: 'GET',
      options: { auth: false },
      path: '/{p*}',
      handler: (request, h) => {
        const locale =
          Accept.language(
            request.headers['accept-language'],
            Object.keys(locales)
          ) || 'en'

        let path = locales[locale]
        for (const param of request.params.p.split('/')) {
          path = path[param]
          if (path === undefined) {
            break
          }
        }
        return h
          .file(typeof path !== 'string' ? locales[locale]['index.html'] : path)
          .code(200)
      }
    })
  }
}

export default filesPlugin
