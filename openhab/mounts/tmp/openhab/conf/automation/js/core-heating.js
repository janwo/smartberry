const { rules, items, triggers, time } = require('openhab')
const {
  json_storage,
  get_all_semantic_items,
  DATETIME_FORMAT,
  sync_group_with_semantic_items,
  get_location,
  stringifiedFloat
} = require(__dirname + '/core-helpers')

const HeatingState = {
  OFF: 0,
  DEFAULT: 1,
  ECO: 2,
  POWER: 3
}

const OPEN_CONTACT_EQUIPMENT_TAGS = ['Door', 'Window']
const OPEN_CONTACT_POINT_TAGS = ['OpenState']
const HEATING_EQUIPMENT_TAGS = ['RadiatorControl']
const HEATING_POINT_TAGS = ['Setpoint']
const TEMPERATURE_MEASUREMENT_POINT_TAGS = [['Measurement', 'Temperature']]

function scriptLoaded() {
  rules.JSRule({
    name: 'sync_heating_helpers',
    description: 'Core (JS) - Sync helper items of heating',
    tags: ['core', 'core-heating'],
    triggers: [
      triggers.GenericCronTrigger('30 0/5 * ? * * *'),
      triggers.SystemStartlevelTrigger(100)
    ],
    execute: (event) => {
      // Sync group gCore_Heating_ContactSwitchable with contact items - it's needed to create triggers on it
      sync_group_with_semantic_items(
        'gCore_Heating_ContactSwitchable',
        OPEN_CONTACT_EQUIPMENT_TAGS,
        OPEN_CONTACT_POINT_TAGS
      )

      // Sync group gCore_Heating_Temperature with temperature items.
      sync_group_with_semantic_items(
        'gCore_Heating_Temperature',
        undefined,
        TEMPERATURE_MEASUREMENT_POINT_TAGS
      )
    }
  })

  rules.JSRule({
    name: 'update_heater_on_contact_trigger',
    description: 'Core (JS) - Check conditions to update heater values',
    tags: ['core', 'core-heating'],
    triggers: [
      triggers.GenericCronTrigger('0 0/5 * ? * * *'),
      triggers.GroupStateUpdateTrigger('gCore_Heating_ContactSwitchable'),
      triggers.ItemStateUpdateTrigger('Core_Heating_Thermostat_ModeDefault'),
      triggers.ItemStateUpdateTrigger(
        'Core_Heating_Thermostat_OpenContactShutdownMinutes'
      )
    ],
    execute: (event) => {
      const openContactLocations = get_all_semantic_items(
        OPEN_CONTACT_EQUIPMENT_TAGS,
        OPEN_CONTACT_POINT_TAGS
      )
        .filter((contact) => contact.state == 'OPEN')
        .map((contact) => get_location(contact))
        .filter((contact) => contact)
        .map((contact) => contact.name)

      let shutdownHeating = false
      const heatingShutdownMinutesItem = items.getItem(
        'Core_Heating_Thermostat_OpenContactShutdownMinutes'
      )

      if (openContactLocations.length > 0) {
        const openedSinceDate = (() => {
          const openedSince = json_storage(heatingShutdownMinutesItem).get(
            'heating',
            'open-contact-since'
          )
          if (openedSince) {
            return time.ZonedDateTime.parse(openedSince, DATETIME_FORMAT)
          }

          const now = time.ZonedDateTime.now()
          json_storage(heatingShutdownMinutesItem).set(
            'heating',
            'open-contact-since',
            now.format(DATETIME_FORMAT)
          )
          return now
        })()

        shutdownHeating =
          heatingShutdownMinutesItem.state &&
          openedSinceDate.until(
            time.ZonedDateTime.now(),
            time.ChronoUnit.MINUTES
          ) > heatingShutdownMinutesItem.state
      } else {
        json_storage(heatingShutdownMinutesItem).remove(
          'heating',
          'open-contact-since'
        )
      }

      const heaterModeItem = items.getItem(
        'Core_Heating_Thermostat_ModeDefault'
      )
      for (const point of get_all_semantic_items(
        HEATING_EQUIPMENT_TAGS,
        HEATING_POINT_TAGS
      )) {
        const location = get_location(point)
        if (location) {
          let state = stringifiedFloat(heaterModeItem.state)
          if (shutdownHeating || openContactLocations.includes(location.name)) {
            state = stringifiedFloat(HeatingState.OFF)
          }

          const pointCommandMap = json_storage(point).get(
            'heating',
            'command-map'
          )

          if (pointCommandMap[state] !== undefined) {
            state = pointCommandMap[state]
          }

          if (point.state != state) {
            point.sendCommand(state)
          }
        }
      }
    }
  })
}

module.exports = {
  HeatingState,
  OPEN_CONTACT_EQUIPMENT_TAGS,
  OPEN_CONTACT_POINT_TAGS,
  HEATING_EQUIPMENT_TAGS,
  HEATING_POINT_TAGS,
  TEMPERATURE_MEASUREMENT_POINT_TAGS
}
