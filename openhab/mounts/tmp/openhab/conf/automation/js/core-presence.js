const { TemporalUnit } = require('openhab/time')
const { rules, items, triggers, time } = require('openhab')
const {
  metadata,
  sync_group_with_semantic_items,
  get_location
} = require(__dirname + '/core-helpers')

const PresenceState = { AWAY_SHORT: 0.0, HOME: 1.0, AWAY_LONG: 2.0 }

const POINT_TAGS = ['Presence']

function get_presence_provider_item(item = undefined) {
  if (!item) {
    return items.getItem('Core_Presence')
  }

  const location = get_location(item)
  if (!location) {
    return items.getItem('Core_Presence')
  }

  return location
}

function get_presence(item = undefined) {
  const presenceProvider = get_presence_provider_item(item)
  const lastUpdate = metadata(presenceProvider).getConfiguration([
    'presence',
    'last-update'
  ])

  if (lastUpdate) {
    let skipExpireCheck = true
    const hours_away_long = items.getItem('Core_Presence_HoursUntilAwayLong')
    if (Number.parseFloat(hours_away_long.state) > 0) {
      skipExpireCheck = false
      if (
        time
          .parse(lastUpdate)
          .until(time.ZonedDateTime.now(), TemporalUnit.HOURS) >
        hours_away_long.state
      ) {
        return PresenceState.AWAY_LONG
      }
    }

    const hours_away_short = ir.getItem('Core_Presence_HoursUntilAwayShort')
    if (Number.parseFloat(hours_away_short.state) > 0) {
      skipExpireCheck = False
      if (
        time
          .parse(lastUpdate)
          .until(time.ZonedDateTime.now(), TemporalUnit.HOURS) >
        hours_away_short.state
      ) {
        return PresenceState.AWAY_SHORT
      }
    }

    if (!skipExpireCheck) {
      return PresenceState.HOME
    }
  }

  if (presenceProvider.name == 'Core_Presence') {
    return Object.values(PresenceState).includes(presenceProvider.state)
      ? presenceProvider.state
      : PresenceState.HOME
  } else {
    // Try again with root presence item.
    return get_presence()
  }
}

function trigger_presence(item) {
  let presenceProvider = get_presence_provider_item(item)
  metadata(presenceProvider).setConfiguration(
    ['presence', 'last-update'],
    time.ZonedDateTime.now().toString()
  )

  if (presenceProvider.name != 'Core_Presence') {
    presenceProvider = items.getItem('Core_Presence')
    metadata(presenceProvider).setConfiguration(
      ['presence', 'last-update'],
      time.ZonedDateTime.now().toString()
    )
  }

  if (presenceProvider.state != PresenceState.HOME) {
    presenceProvider.postUpdate(PresenceState.HOME)
  }
}

function trigger_absence(item) {
  if (get_presence() == PresenceState.HOME) {
    const presenceProvider = items.getItem('Core_Presence')
    presenceProvider.postUpdate(PresenceState.AWAY_SHORT)
  }
}

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
    const presenceStates = metadata(item).getConfiguration([
      'presence',
      'presence-states'
    ]) || ['ON', 'OPEN']

    const absenceStates =
      metadata(item).getConfiguration(['presence', 'absence-states']) || []

    if (presenceStates.includes(item.state)) {
      trigger_presence(item)
    }

    if (absenceStates.includes(item.state)) {
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
      presenceManagement.postUpdate(presence)
    }
  }
})

module.exports = {
  get_presence_provider_item,
  get_presence,
  trigger_presence,
  trigger_absence,
  PresenceState
}
