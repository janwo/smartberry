const healthcheckPlugin = {
  name: 'healthcheck',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/healthcheck',
      handler: (_, h) => {
        return h.response({ up: true }).code(200)
      }
    })
  }
}

export default healthcheckPlugin
