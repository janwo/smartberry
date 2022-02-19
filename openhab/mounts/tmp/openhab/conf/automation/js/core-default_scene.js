const { rules, items, triggers } = require('openhab')
const { apply_context } = require(__dirname + '/core-scenes')
const { metadata } = require(__dirname + '/core-helpers')
const { PresenceState } = require(__dirname + '/core-presence')

const DefaultSceneState = {
  HOME: 0,
  AWAY_SHORT: 1,
  AWAY_LONG: 2,
  SLEEP: 3
}

function scriptLoaded() {
  rules.JSRule({
    name: 'default_scene_updated',
    description: 'Core (JS) - Manage changes of default scene.',
    tags: ['core', 'core-default_scene'],
    triggers: [triggers.ItemStateUpdateTrigger('Core_DefaultScene')],
    execute: (event) => {
      if (event.itemState == DefaultSceneState.SLEEP) {
        for (scene of items.getItem('gCore_Scenes').members) {
          const contexts = ['sleep', 'reset']
          for (context of contexts) {
            if (apply_context(scene, context)) {
              break
            }
          }
        }
      }
    }
  })

  rules.JSRule({
    name: 'presence_updated',
    description: 'Core (JS) - Adjust default scene on presence changes.',
    tags: ['core', 'core-default_scene'],
    triggers: [triggers.ItemStateChangeTrigger('Core_Presence')],
    execute: (event) => {
      const scene = items.getItem('Core_DefaultScene')
      if (scene.state == DefaultSceneState.SLEEP) {
        return
      }

      const defaultSceneMapping = {}
      defaultSceneMapping[PresenceState.HOME] = DefaultSceneState.HOME
      defaultSceneMapping[PresenceState.AWAY_SHORT] =
        DefaultSceneState.AWAY_SHORT
      defaultSceneMapping[PresenceState.AWAY_LONG] = DefaultSceneState.AWAY_LONG

      scene.postUpdate(defaultSceneMapping[event.itemState].toFixed(1))
    }
  })

  rules.JSRule({
    name: 'sync_default_scene_helpers',
    description: 'Core (JS) - Add custom-members.',
    tags: ['core', 'core-default_scene'],
    triggers: [
      triggers.SystemStartlevelTrigger(100),
      triggers.GenericCronTrigger('30 0/5 * ? * * *')
    ],
    execute: (event) => {
      metadata('Core_DefaultScene').setConfiguration(
        'scenes',
        'custom-members',
        [
          'Core_Security_OperationState',
          'Core_Heating_Thermostat_ModeDefault',
          'gCore_Lights_DarkMode',
          'gCore_Lights_BrightMode',
          'gCore_Lights_ObscuredMode',
          'Core_Lights_DefaultDuration'
        ]
      )
    }
  })
}

module.exports = {
  DefaultSceneState
}
