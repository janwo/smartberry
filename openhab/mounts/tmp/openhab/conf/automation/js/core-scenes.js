const { rules, items, triggers, time } = require('openhab')
const { uniqBy, merge } = require('lodash')
const {
  metadata,
  create_helper_item,
  get_all_semantic_items,
  get_items_of_any_tags,
  DATETIME_FORMAT,
  sync_group_with_semantic_items,
  get_location,
  has_same_location
} = require(__dirname + '/core-helpers')

const SCENE_TAGS = ['CoreScene']
const SCENE_TRIGGER_TAGS = ['CoreSceneTrigger']

function get_default_scene_state(scene) {
  const stateDescription = metadata(
    helperItem,
    'stateDescription'
  ).getConfiguration('options')

  if (stateDescription) {
    const command = stateDescription.split(',')[0].split('=')[0]
    if (command.length > 0) {
      return command
    }
  }

  return undefined
}

function get_scene_states(scene) {
  const stateDescription = metadata(scene, 'stateDescription').getConfiguration(
    'options'
  )

  if (!stateDescription) {
    return {}
  }

  return stateDescription.split(',').reduce((obj, stateDescription) => {
    stateDescription = stateDescription.split('=')
    const command = stateDescription[0]
    const label = stateDescription[1]
    if (
      command !== undefined &&
      command.length > 0 &&
      label !== undefined &&
      label.length > 0
    ) {
      obj[command] = label
    }
    return obj
  }, {})
}

function get_scene_items(scene) {
  const sceneMembers = metadata(scene).getConfiguration(
    'scenes',
    'custom-members'
  ) || ['default:true']

  const handleMember = (member) => {
    if (member.startsWith('tag:')) {
      return get_items_of_any_tags([member.substring(4)]).filter(
        (item) => item.type != 'GroupItem' && has_same_location(item, scene)
      )
    }

    // Use lights as default items in list.
    if (member.startsWith('default:')) {
      if (member == 'default:true') {
        return get_all_semantic_items(
          LIGHTS_EQUIPMENT_TAGS,
          LIGHTS_POINT_TAGS
        ).filter(
          (item) => item.type != 'GroupItem' && has_same_location(item, scene)
        )
      }
    }
    return get_childs_with_condition(member, (item) => item.type != 'GroupItem')
  }

  return uniqBy(
    sceneMembers.reduce(
      (memberList, newMember) => memberList.concat(handleMember(newMember)),
      []
    ),
    (item) => item.name
  )
}

function get_scene_item_states(scene, scene_state) {
  scene_state = scene_state || get_default_scene_state(scene)

  if (scene_state === undefined) {
    return []
  }

  const states = metadata(scene).getConfiguration(
    'scenes',
    'states',
    scene_state
  )

  return get_scene_items(scene).reduce(
    (obj, newItem) => (obj[newItem.name] = states?.[newItem.name]),
    {}
  )
}

function save_scene_item_states(scene, scene_state) {
  const items = get_scene_items(scene)
  scene_state = scene_state || get_default_scene_state(scene)

  if (scene_state !== undefined) {
    for (let item in items) {
      items[item] = items.getItem(item)?.state
    }

    metadata(scene).setConfiguration('scenes', 'states', scene_state, items)
  }
}

function trigger_scene_items(scene, poke_only = false) {
  const item_states = get_scene_item_states(scene)
  for (let item in item_states) {
    item = items.getItem(item)
    if (poke_only) {
      item.postUpdate(item.state)
    } else {
      item.postUpdate(item_states[item.name])
      item.sendCommand(item_states[item.name])
    }
  }
}

function apply_context(scene, context) {
  const contextState = metadata(scene).getConfiguration(
    'scenes',
    'context-states',
    context
  )

  if (
    Object.values(get_scene_states(scene)).some(
      (sceneState) => sceneState == contextState
    )
  ) {
    scene.postUpdate(contextState)
    return true
  }
  return false
}

function scriptLoaded() {
  rules.JSRule({
    name: 'sync_scenes_helpers',
    description: 'Core (JS) - Sync helper items of scenes',
    tags: ['core', 'core-scenes'],
    triggers: [
      triggers.GenericCronTrigger('30 0/5 * ? * * *'),
      triggers.SystemStartlevelTrigger(100),
      triggers.ItemStateUpdateTrigger('Core_Scenes_ReloadStates', 'ON')
    ],
    execute: (event) => {
      //Sync group gCore_Scenes_StateTriggers with scene trigger items
      sync_group_with_semantic_items(
        'gCore_Scenes_StateTriggers',
        SCENE_TRIGGER_TAGS
      )

      // Sync group gCore_Scenes with scene items
      const sceneMembers = sync_group_with_semantic_items(
        'gCore_Scenes',
        SCENE_TAGS
      )

      // Check helper items
      for (const sceneMember of sceneMembers) {
        // check metadata of context states
        const contextStates = metadata(sceneMember).getConfiguration(
          'scenes',
          'context-states'
        )

        const defaultContextStates = {
          reset: false
        }

        metadata(sceneMember).setConfiguration(
          'scenes',
          'context-states',
          merge(defaultContextStates, contextStates)
        )

        // Create scene store trigger
        const helper = create_helper_item(
          sceneMember,
          'scenes',
          'store-trigger',
          'Number',
          'settings',
          `${sceneMember.label} überschreiben`,
          ['gCore_Scenes_StoreTriggers'],
          ['Point']
        )

        for (const path of ['listWidget', 'cellWidget']) {
          metadata(helper).setConfiguration(path, {
            label: `=items.${sceneMember.name}.title`,
            icon: 'oh:settings',
            action: 'options',
            actionItem: helper.name
          })
        }

        // Sync (Add) switches for each scene state
        const sceneLocation = get_location(sceneMember)
        const sceneStates = get_scene_states(sceneMember)
        for (const sceneName in sceneStates) {
          const stateTriggerLabel = `${sceneName}-Szene`
          const stateTrigger = create_helper_item(
            sceneMember,
            'scenes',
            `trigger-state-${sceneStates[sceneName]}`,
            'Switch',
            'party',
            stateTriggerLabel,
            ['gCore_Scenes_StateTriggers'],
            SCENE_TRIGGER_TAGS
          )

          if (stateTrigger.getLabel() != stateTriggerLabel) {
            stateTrigger.setLabel(stateTriggerLabel)
          }

          const meta = metadata(stateTrigger)

          meta.setConfiguration('scenes', 'trigger-state', {
            to: sceneStates[sceneName],
            'target-scene': sceneMember.name,
            generated: true
          })

          meta.setValue('ga', 'Scene')

          meta.setConfiguration('ga', {
            sceneReversible: false,
            synonyms: sceneLocation
              ? `${stateTriggerLabel} in ${sceneLocation.label}`
              : undefined
          })

          for (const path of ['listWidget', 'cellWidget']) {
            meta.setConfiguration(path, {
              label: `=items.${stateTrigger.name}.title`,
              icon: 'oh:party',
              subtitle: `=items.${stateTrigger.name}.displayState`
            })
          }
        }

        // Sync (Remove) switches for each scene state
        for (const stateTrigger of items.getItem('gCore_Scenes_StateTriggers')
          .members) {
          const triggerInfo = metadata(stateTrigger).getConfiguration(
            'scenes',
            'trigger-state'
          )

          // Do not remove manual created items that are just tagged wrong as it could be added manually to an existing (important) item.
          if (!triggerInfo || !triggerInfo['generated']) {
            continue
          }

          if (triggerInfo['to'] && triggerInfo['target-scene']) {
            try {
              const scene = items.getItem(triggerInfo['target-scene'])
              if (
                scene &&
                Object.values(get_scene_states(scene)).some(
                  (sceneState) => sceneState == triggerInfo['to']
                )
              ) {
                continue
              }
            } catch {}
          }
          items.remove(stateTrigger.name)
        }
      }
    }
  })

  rules.JSRule({
    name: 'activate_scene',
    description: 'Core (JS) - Activate scene.',
    tags: ['core', 'core-scenes'],
    triggers: [triggers.GroupStateUpdateTrigger('gCore_Scenes')],
    execute: (event) => {
      const scene = items.getItem(event.itemName)
      metadata(scene).setConfiguration(
        'scenes',
        'last-activation',
        get_date_string(ZonedDateTime.now())
      )
      trigger_scene_items(scene)
    }
  })

  rules.JSRule({
    name: 'store_scene',
    description: 'Core (JS) - Store scene.',
    tags: ['core', 'core-scenes'],
    triggers: [triggers.GroupStateUpdateTrigger('gCore_Scenes_StoreTriggers')],
    execute: (event) => {
      const sceneTrigger = items.getItem(event.itemName)
      const scene = get_item_of_helper_item(sceneTrigger)
      save_scene_item_states(scene, event.itemState)
    }
  })

  rules.JSRule({
    name: 'manage_scenetriggers',
    description:
      'Core (JS) - Manage gCore_Scenes_StateTriggers to trigger scene.',
    tags: ['core', 'core-default_scene'],
    triggers: [triggers.GroupStateUpdateTrigger('gCore_Scenes_StateTriggers')],
    execute: (event) => {
      const item = items.getItem(event.itemName)
      const triggerInfo = metadata(item).getConfiguration(
        'scenes',
        'trigger-state'
      )

      if (
        triggerInfo['states'] &&
        !triggerInfo['states'].some((state) => state == item.state)
      ) {
        return
      }

      if (triggerInfo['to'] && triggerInfo['target-scene']) {
        let scene
        try {
          scene = items.getItem(triggerInfo['target-scene'])
        } catch {
          return
        }

        if (
          triggerInfo['from'] &&
          triggerInfo['from'] != Number.parseFloat(scene.state)
        ) {
          return
        }

        const lastActivation = metadata(scene).getConfiguration(
          'scenes',
          'last-activation'
        )

        if (
          !lastActivation ||
          (triggerInfo['hours-until-active'] &&
            time.ZonedDateTime.parse(lastActivation, DATETIME_FORMAT).until(
              time.ZonedDateTime.now(),
              time.ChronoUnit.HOURS
            ) <= triggerInfo['hours-until-active']) ||
          (triggerInfo['minutes-until-active'] &&
            time.ZonedDateTime.parse(lastActivation, DATETIME_FORMAT).until(
              time.ZonedDateTime.now(),
              time.ChronoUnit.MINUTES
            ) <= triggerInfo['minutes-until-active']) ||
          (triggerInfo['seconds-until-active'] &&
            time.ZonedDateTime.parse(lastActivation, DATETIME_FORMAT).until(
              time.ZonedDateTime.now(),
              time.ChronoUnit.HOURS
            ) <= triggerInfo['seconds-until-active'])
        ) {
          return
        }

        scene.postUpdate(triggerInfo['to'])
      }
    }
  })
}

module.exports = {
  get_default_scene_state,
  get_scene_states,
  get_scene_items,
  get_scene_item_states,
  save_scene_item_states,
  trigger_scene_items,
  apply_context
}
