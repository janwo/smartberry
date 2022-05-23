import * as Hapi from '@hapi/hapi'
import Joi from 'joi'

const openhabIrrigationPlugin = {
  name: 'app/openhab-irrigation',
  dependencies: ['app/openhab'],
  register: async (server: Hapi.Server) => {
    //TODO TBD
  }
}

export default openhabIrrigationPlugin
