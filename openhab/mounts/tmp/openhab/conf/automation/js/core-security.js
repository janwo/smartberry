const { rules, items, triggers, time } = require('openhab')
const {
  metadata,
  get_all_semantic_items,
  sync_group_with_semantic_items,
  broadcast,
  BroadcastType,
  DATETIME_FORMAT,
  has_same_location
} = require(__dirname + '/core-helpers')

const OperationState = {
  OFF: 0,
  ON: 1,
  SILENTLY: 2
}

const ASSAULT_TRIGGER_EQUIPMENT_TAGS = ['Window', 'Door', 'CoreAssaultTrigger']
const ASSAULT_TRIGGER_POINT_TAGS = ['OpenState', 'Switch']
const ASSAULT_DISARMER_EQUIPMENT_TAGS = ['CoreAssaultDisarmer']
const ASSAULT_DISARMER_POINT_TAGS = ['OpenState', 'Switch']
const ASSAULT_ALARM_POINT_TAGS = ['Alarm']
const LOCK_CLOSURE_EQUIPMENT_TAGS = ['CoreLockClosure']
const LOCK_CLOSURE_POINT_TAGS = ['OpenState', 'Switch']
const LOCK_EQUIPMENT_TAGS = ['Lock']
const LOCK_POINT_TAGS = ['OpenState', 'Switch']

function is_security_state(state = OperationState.OFF) {
  const OperationStateItem = items.getItem('Core_Security_OperationState')
  return OperationStateItem.state == state
}

function scriptLoaded() {
  rules.JSRule({
    name: 'sync_security_helpers',
    description: 'Core (JS) - Sync helper items of security',
    tags: ['core', 'core-security'],
    triggers: [
      triggers.GenericCronTrigger('30 0/5 * ? * * *'),
      triggers.SystemStartlevelTrigger(100)
    ],
    execute: (event) => {
      // Sync group gCore_Security_AssaultTrigger with assault items - it's needed to create triggers on it
      sync_group_with_semantic_items(
        'gCore_Security_AssaultTrigger',
        ASSAULT_TRIGGER_EQUIPMENT_TAGS,
        ASSAULT_TRIGGER_POINT_TAGS
      )

      // Sync group gCore_Security_AssaultDisarmamer with disarmer items - it's needed to create triggers on it
      sync_group_with_semantic_items(
        'gCore_Security_AssaultDisarmamer',
        ASSAULT_DISARMER_EQUIPMENT_TAGS,
        ASSAULT_DISARMER_POINT_TAGS
      )

      // Sync group gCore_Security_LockClosureTrigger with closure items - it's needed to create triggers on it
      sync_group_with_semantic_items(
        'gCore_Security_LockClosureTrigger',
        LOCK_CLOSURE_EQUIPMENT_TAGS,
        LOCK_CLOSURE_POINT_TAGS
      )
    }
  })

  rules.JSRule({
    name: 'assault_trigger',
    description: 'Core (JS) - Core_Security System - Trigger-Management.',
    tags: ['core', 'core-security'],
    triggers: [
      triggers.GroupStateChangeTrigger('gCore_Security_AssaultTrigger')
    ],
    execute: (event) => {
      if (is_security_state(OperationState.OFF)) {
        return
      }

      const item = items.getItem(event.itemName)
      metadata('Core_Security_OperationState').setConfiguration(
        'security',
        'last-alarm',
        time.ZonedDateTime.now().format(DATETIME_FORMAT)
      )

      let message = `Silent alarm was triggered by ${item.label}!`
      if (is_security_state(OperationState.ON)) {
        message = `Striking alarm was triggered by ${item.label}!`
        for (const alarm of items.getItemsByTag(...ASSAULT_ALARM_POINT_TAGS)) {
          alarm.sendCommand('ON')
        }

        broadcast(message, BroadcastType.ATTENTION)
      }
    }
  })

  rules.JSRule({
    name: 'armament',
    description: 'Core (JS) - Core_Security System - Check Armament.',
    tags: ['core', 'core-security'],
    triggers: [
      triggers.ItemStateUpdateTrigger(
        'Core_Security_OperationState',
        OperationState.ON
      ),
      triggers.ItemStateUpdateTrigger(
        'Core_Security_OperationState',
        OperationState.SILENTLY
      )
    ],
    execute: (event) => {
      const blockingAssaultTriggers = items
        .getItem('gCore_Security_AssaultTrigger')
        .members.reduce((pointsList, newMember) => {
          const newPoints = get_semantic_items(
            newMember,
            ASSAULT_TRIGGER_EQUIPMENT_TAGS,
            ASSAULT_TRIGGER_POINT_TAGS
          )
          return pointsList.concat(newPoints)
        }, [])
        .filter((point) => [OPEN, ON].some((state) => state == point.state))

      metadata('Core_Security_OperationState').setConfiguration(
        'security',
        'blocking-assault-triggers',
        blockingAssaultTriggers.map((trigger) => trigger.name)
      )

      if (blockingAssaultTriggers.length > 0) {
        items
          .getItem('Core_Security_OperationState')
          .postUpdate(OperationState.OFF.toFixed(1))
        broadcast(
          `${', '.join(
            blockingAssaultTriggers.map((trigger) => trigger.label)
          )} is in an OPEN state. No initiation into assault detection.`
        )
      }
    }
  })

  rules.JSRule({
    name: 'disarmament',
    description: 'Core (JS) - Core_Security System - Disarmament-Management.',
    tags: ['core', 'core-security'],
    triggers: [
      triggers.GroupStateChangeTrigger('gCore_Security_AssaultDisarmamer')
    ],
    execute: (event) => {
      const item = items.getItem(event.itemName)
      if (['ON', 'OPEN'].some((state) => state == item.state)) {
        items
          .getItem('Core_Security_OperationState')
          .postUpdate(OperationState.OFF.toFixed(1))
      }
    }
  })

  rules.JSRule({
    name: 'lock_closure',
    description: 'Core (JS) - Core_Security System - Lock Closure-Management.',
    tags: ['core', 'core-security'],
    triggers: [
      triggers.GroupStateChangeTrigger('gCore_Security_LockClosureTrigger')
    ],
    execute: (event) => {
      const item = items.getItem(event.itemName)
      if (['OFF', 'CLOSED'].some((state) => state == item.state)) {
        for (const lock of get_all_semantic_items(
          LOCK_EQUIPMENT_TAGS,
          LOCK_POINT_TAGS
        )) {
          if (has_same_location(item, lock)) {
            lock.sendCommand('ON')
            break
          }
        }
      }
    }
  })

  rules.JSRule({
    name: 'siren_off',
    description:
      'Core (JS) - Turn off siren after Core_Security_OperationState update.',
    tags: ['core', 'core-security'],
    triggers: [triggers.ItemStateUpdateTrigger('Core_Security_OperationState')],
    execute: (event) => {
      for (const alarm of items.getItemsByTag(...ASSAULT_ALARM_POINT_TAGS)) {
        if (alarm.state != 'OFF') {
          alarm.sendCommand('OFF')
        }
      }
    }
  })

  rules.JSRule({
    name: 'siren_autooff',
    description: 'Core (JS) - Turn off siren after X minutes.',
    tags: ['core', 'core-security'],
    triggers: [triggers.GenericCronTrigger('0 * * ? * * *')],
    execute: (event) => {
      const autoOffTime = items.getItem('Core_Security_SireneAutoOff')
      const lastAlarmTime = metadata(
        'Core_Security_OperationState'
      ).getConfiguration('security', 'last-alarm')

      if (
        autoOffTime.state == 0 ||
        !lastAlarmTime ||
        time.ZonedDateTime.parse(lastAlarmTime, DATETIME_FORMAT).until(
          time.ZonedDateTime.now(),
          time.ChronoUnit.MINUTES
        ) > autoOffTime.state
      ) {
        return
      }

      for (const alarm of items.getItemsByTag(...ASSAULT_ALARM_POINT_TAGS)) {
        if (alarm.state != 'OFF') {
          alarm.sendCommand('OFF')
          broadcast(
            `Alarm item ${alarm.label} was automatically disabled after ${autoOffTime.state} minutes.`,
            BroadcastType.ATTENTION
          )
        }
      }
    }
  })
}

module.exports = {
  is_security_state,
  OperationState
}
