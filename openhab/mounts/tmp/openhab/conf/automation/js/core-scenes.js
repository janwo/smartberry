const { rules, items, triggers, time } = require('openhab')
const { uniqBy, merge, isEmpty } = require('lodash')
const {
  metadata,
  create_helper_item,
  get_all_semantic_items,
  get_items_of_any_tags,
  get_item_of_helper_item,
  DATETIME_FORMAT,
  stringifiedFloat,
  sync_group_with_semantic_items,
  get_childs_with_condition,
  get_location,
  has_same_location
} = require(__dirname + '/core-helpers')
const { LIGHTS_EQUIPMENT_TAGS, LIGHTS_POINT_TAGS } = require(__dirname +
  '/core-lights')

const SCENE_TAGS = ['CoreScene']
const SCENE_TRIGGER_TAGS = ['CoreSceneTrigger']

function get_default_scene_state(scene) {
  const stateDescription = metadata(scene, 'stateDescription').getConfiguration(
    'options'
  )

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
      obj[label] = command
    }
    return obj
  }, {})
}

function get_scene_items(scene) {
  const sceneMembers = metadata(scene)
    .getConfiguration('scenes', 'custom-members')
    ?.split(',')
    .map((i) => i.trim()) || ['default:true']

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

function get_scene_item_states(scene) {
  let sceneState = Number.parseFloat(scene.state)
  sceneState = Number.isNaN(sceneState)
    ? get_default_scene_state(scene)
    : sceneState
  if (sceneState === undefined) {
    return []
  }

  const states = metadata(scene).getConfiguration(
    'scenes',
    'states',
    stringifiedFloat(sceneState)
  )

  return get_scene_items(scene).reduce((obj, newItem) => {
    if (states && states[newItem.name] !== undefined) {
      obj[newItem.name] = states[newItem.name]
    }
    return obj
  }, {})
}

function save_scene_item_states(scene, sceneState) {
  const sceneItems = get_scene_items(scene)
  sceneState = sceneState || get_default_scene_state(scene)

  if (sceneState !== undefined) {
    let sceneItemStates = {}
    for (const item of sceneItems) {
      sceneItemStates[item.name] = item.state
    }

    metadata(scene).setConfiguration(
      'scenes',
      'states',
      stringifiedFloat(sceneState),
      sceneItemStates
    )
  }
}

function trigger_scene_items(scene, pokeOnly = false) {
  const itemStates = get_scene_item_states(scene)
  for (const itemName in itemStates) {
    try {
      const item = items.getItem(itemName)
      if (pokeOnly) {
        item.postUpdate(item.state)
      } else {
        item.postUpdate(itemStates[itemName])
        item.sendCommand(itemStates[itemName])
      }
    } catch {
      console.log(
        'trigger_scene_items',
        `Could not set item state: Item ${item} does not exist.`
      )
    }
  }
}

function apply_context(scene, context) {
  const contextState = metadata(scene).getConfiguration(
    'scenes',
    'context-states',
    context
  )

  const sceneStates = get_scene_states(scene)
  if (
    Object.values(sceneStates).some((sceneState) => sceneState == contextState)
  ) {
    scene.postUpdate(stringifiedFloat(contextState))
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
          metadata(helper, path).setConfiguration({
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

          if (stateTrigger.label != stateTriggerLabel) {
            stateTrigger.rawItem.setLabel(stateTriggerLabel)
          }

          metadata(stateTrigger).setConfiguration('scenes', 'trigger-state', {
            to: sceneStates[sceneName],
            'target-scene': sceneMember.name,
            generated: true
          })

          metadata(stateTrigger, 'ga').setValue('Scene')

          metadata(stateTrigger, 'ga').setConfiguration({
            sceneReversible: false,
            synonyms: sceneLocation
              ? `${stateTriggerLabel} in ${sceneLocation.label}`
              : undefined
          })

          for (const path of ['listWidget', 'cellWidget']) {
            metadata(stateTrigger, path).setConfiguration({
              label: `=items.${stateTrigger.name}.title`,
              icon: 'oh:party',
              subtitle: `=items.${stateTrigger.name}.displayState`
            })
          }
        }

        const stateDescription = metadata(
          sceneMember,
          'stateDescription'
        ).getConfiguration('options')
        if (stateDescription) {
          metadata(helper, 'stateDescription').setConfiguration({
            options: stateDescription,
            pattern: '%d'
          })
        }

        // Sync (Remove) switches for each scene state
        for (const stateTrigger of items.getItem('gCore_Scenes_StateTriggers')
          .members) {
          const triggerInfo = metadata(stateTrigger).getConfiguration(
            'scenes',
            'trigger-state'
          )

          // Do not remove manual created items that are just tagged wrong as it could be added manually to an existing (important) item.
          if (isEmpty(triggerInfo) || !triggerInfo['generated']) {
            continue
          }

          if (triggerInfo['to'] !== undefined && triggerInfo['target-scene']) {
            try {
              const scene = items.getItem(triggerInfo['target-scene'])
              if (
                scene &&
                Object.values(get_scene_states(scene)).some(
                  (sceneState) =>
                    sceneState == Number.parseFloat(triggerInfo['to'])
                )
              ) {
                continue
              }
            } catch {}
          }
          try {
            items.removeItem(stateTrigger.name)
          } catch {}
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
        time.ZonedDateTime.now().format(DATETIME_FORMAT)
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
      save_scene_item_states(scene, sceneTrigger.state)
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
        !triggerInfo ||
        (triggerInfo['states']?.split(',') || []).some(
          (state) => state == item.state
        )
      ) {
        return
      }

      if (triggerInfo['to'] && triggerInfo['target-scene']) {
        try {
          const scene = items.getItem(triggerInfo['target-scene'])

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

          scene.postUpdate(stringifiedFloat(triggerInfo['to']))
        } catch {}
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
  apply_context,
  SCENE_TAGS,
  SCENE_TRIGGER_TAGS
}
