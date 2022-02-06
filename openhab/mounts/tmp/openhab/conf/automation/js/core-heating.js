const { rules, items, triggers, time } = require('openhab')
const { TemporalUnit } = require('openhab/time')
const {
  metadata,
  get_all_semantic_items,
  sync_group_with_semantic_items,
  get_location
} = require(__dirname + '/core-helpers')

const HeatingState = {
  OFF: 0.0,
  DEFAULT: 1.0,
  ECO: 2.0,
  POWER: 3.0
}

const OPEN_CONTACT_EQUIPMENT_TAGS = ['Door', 'Window']
const OPEN_CONTACT_POINT_TAGS = ['OpenState']
const HEATING_EQUIPMENT_TAGS = ['RadiatorControl']
const HEATING_POINT_TAGS = ['Setpoint']
const TEMPERATURE_MEASUREMENT_POINT_TAGS = [['Measurement', 'Temperature']]

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

    const shutdownHeating = false
    const heatingShutdownMinutesItem = items.getItem(
      'Core_Heating_Thermostat_OpenContactShutdownMinutes'
    )

    if (openContactLocations) {
      const openedSince = (() => {
        const meta = metadata(heatingShutdownMinutesItem).getConfiguration([
          'heating',
          'open-contact-since'
        ])
        if (meta) {
          return time.ZonedDateTime.parse(meta)
        }

        const now = time.ZonedDateTime.now()
        metadata(heatingShutdownMinutesItem).setConfiguration(
          ['heating', 'open-contact-since'],
          now.toString()
        )
        return now
      })()

      shutdownHeating =
        heatingShutdownMinutesItem.state &&
        openedSince.until(time.ZonedDateTime.now(), TemporalUnit.MINUTES) >
          heatingShutdownMinutesItem.state
    } else {
      metadata(heatingShutdownMinutesItem).setConfiguration(
        ['heating', 'open-contact-since'],
        undefined
      )
    }

    const heaterModeItem = items.getItem('Core_Heating_Thermostat_ModeDefault')
    for (const point of get_all_semantic_items(
      HEATING_EQUIPMENT_TAGS,
      HEATING_POINT_TAGS
    )) {
      const location = get_location(point)
      if (location) {
        const state = heaterModeItem.state
        if (shutdownHeating || openContactLocations.includes(location.name)) {
          state = HeatingState.OFF
        }

        const pointCommandMap = metadata(point).getConfiguration([
          'heating',
          'command-map'
        ])

        if (pointCommandMap && Object.keys(pointCommandMap).includes(state)) {
          state = pointCommandMap[state]
        }

        if (point.state != state) {
          point.sendCommand(state)
        }
      }
    }
  }
})

module.exports = {
  HeatingState
}
