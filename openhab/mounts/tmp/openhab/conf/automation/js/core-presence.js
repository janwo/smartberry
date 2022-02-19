const { rules, items, triggers, time } = require('openhab')
const {
  metadata,
  DATETIME_FORMAT,
  sync_group_with_semantic_items,
  get_location
} = require(__dirname + '/core-helpers')

const PresenceState = {
  AWAY_SHORT: 0,
  HOME: 1,
  AWAY_LONG: 2
}

const POINT_TAGS = ['Presence']

function get_presence_provider_item(item) {
  if (!item) {
    return items.getItem('Core_Presence')
  }

  const location = get_location(item)
  return location ? location : items.getItem('Core_Presence')
}

function get_presence(item) {
  const presenceProvider = get_presence_provider_item(item)
  const lastUpdate = metadata(presenceProvider).getConfiguration(
    'presence',
    'last-update'
  )

  if (lastUpdate) {
    let skipExpireCheck = true
    const hours_away_long = items.getItem('Core_Presence_HoursUntilAwayLong')
    if (hours_away_long.state > 0) {
      skipExpireCheck = false
      if (
        time.ZonedDateTime.parse(lastUpdate, DATETIME_FORMAT).until(
          time.ZonedDateTime.now(),
          time.ChronoUnit.HOURS
        ) > hours_away_long.state
      ) {
        return PresenceState.AWAY_LONG
      }
    }

    const hours_away_short = items.getItem('Core_Presence_HoursUntilAwayShort')
    if (hours_away_short.state > 0) {
      skipExpireCheck = false
      if (
        time.ZonedDateTime.parse(lastUpdate, DATETIME_FORMAT).until(
          time.ZonedDateTime.now(),
          time.ChronoUnit.HOURS
        ) > hours_away_short.state
      ) {
        return PresenceState.AWAY_SHORT
      }
    }

    if (!skipExpireCheck) {
      return PresenceState.HOME
    }
  }

  if (presenceProvider.name == 'Core_Presence') {
    return Object.values(PresenceState).find(
      (state) => state == presenceProvider.state
    )
  } else {
    // Try again with root presence item.
    return get_presence()
  }
}

function trigger_presence(item) {
  let presenceProvider = get_presence_provider_item(item)
  metadata(presenceProvider).setConfiguration(
    'presence',
    'last-update',
    time.ZonedDateTime.now().format(DATETIME_FORMAT)
  )

  if (presenceProvider.name != 'Core_Presence') {
    presenceProvider = items.getItem('Core_Presence')
    metadata(presenceProvider).setConfiguration(
      'presence',
      'last-update',
      time.ZonedDateTime.now().format(DATETIME_FORMAT)
    )
  }

  if (presenceProvider.state != PresenceState.HOME) {
    presenceProvider.postUpdate(PresenceState.HOME.toFixed(1))
  }
}

function trigger_absence() {
  if (get_presence() == PresenceState.HOME) {
    const presenceProvider = items.getItem('Core_Presence')
    presenceProvider.postUpdate(PresenceState.AWAY_SHORT.toFixed(1))
  }
}

function scriptLoaded() {
  rules.JSRule({
    name: 'sync_presence_helpers',
    description: 'Core (JS) - Sync helper items of presence',
    tags: ['core', 'core-presence'],
    triggers: [
      triggers.GenericCronTrigger('30 0/5 * ? * * *'),
      triggers.SystemStartlevelTrigger(100)
    ],
    execute: (event) => {
      // Sync group gCore_Presence_PresenceTrigger with presence items - it's needed to create triggers on it
      sync_group_with_semantic_items(
        'gCore_Presence_PresenceTrigger',
        undefined,
        POINT_TAGS
      )
    }
  })

  rules.JSRule({
    name: 'trigger_presence_on_motion',
    description: 'Core (JS) - Trigger presence on motion.',
    tags: ['core', 'core-presence'],
    triggers: [
      triggers.GroupStateUpdateTrigger('gCore_Presence_PresenceTrigger')
    ],
    execute: (event) => {
      const item = items.getItem(event.itemName)
      const presenceStates = metadata(item).getConfiguration(
        'presence',
        'presence-states'
      ) || ['ON', 'OPEN']

      const absenceStates =
        metadata(item).getConfiguration('presence', 'absence-states') || []

      if (presenceStates.some((state) => state == item.state)) {
        trigger_presence(item)
      }

      if (absenceStates.some((state) => state == item.state)) {
        trigger_absence(item)
      }
    }
  })

  rules.JSRule({
    name: 'check_presence',
    description:
      'Core (JS) - Check for an absence presence state and update Core_Presence.',
    tags: ['core', 'core-presence'],
    triggers: [triggers.GenericCronTrigger('0 0 * ? * * *')],
    execute: (event) => {
      const presence = get_presence()
      const presenceManagement = items.getItem('Core_Presence')

      // Do not update to HOME as we only want to update to absence presence states.
      if (presence == PresenceState.HOME) {
        return
      }

      // Update presence state, if it changed.
      if (presence != presenceManagement.state) {
        presenceManagement.postUpdate(presence.toFixed(1))
      }
    }
  })
}

module.exports = {
  get_presence_provider_item,
  get_presence,
  trigger_presence,
  trigger_absence,
  PresenceState
}
