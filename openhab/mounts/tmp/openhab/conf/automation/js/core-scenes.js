const { rules, items, triggers, time } = require('openhab')
const { uniqBy, isEmpty } = require('lodash')
const {
  create_helper_item,
  get_all_semantic_items,
  get_items_of_any_tags,
  get_item_of_helper_item,
  DATETIME_FORMAT,
  stringifiedFloat,
  json_storage,
  sync_group_with_semantic_items,
  get_childs_with_condition,
  get_location,
  has_same_location
} = require(__dirname + '/core-helpers')
const { LIGHTS_EQUIPMENT_TAGS, LIGHTS_POINT_TAGS, is_on } = require(__dirname +
  '/core-lights')

const SCENE_TAGS = ['CoreScene']
const SCENE_TRIGGER_TAGS = ['CoreSceneTrigger']
const SceneTriggerStyle = {
  AUTO: 0,
  COMMAND_AND_UPDATE: 1,
  UPDATE: 2
}

function get_default_scene_state(scene) {
  const stateDescription = scene?.rawItem?.getStateDescription()?.getOptions()
  if (stateDescription?.length) {
    const command = stateDescription[0]?.getValue()
    if (command?.length > 0) {
      return command
    }
  }

  return undefined
}

function get_scene_states(scene) {
  const stateDescription = scene?.rawItem?.getStateDescription()?.getOptions()
  let obj = {}

  if (!stateDescription?.length) {
    return obj
  }

  for (const stateOption of stateDescription) {
    const command = stateOption.getValue()
    const label = stateOption.getLabel()
    if (command?.length > 0 && label?.length > 0) {
      obj[label] = command
    }
  }
  return obj
}

function get_scene_items(scene) {
  const sceneMembers = json_storage(scene)
    .get('scenes', 'custom-members')
    ?.map((i) => i.trim()) || ['default:true']

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

  const states = json_storage(scene).get(
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

    json_storage(scene).set(
      'scenes',
      'states',
      stringifiedFloat(sceneState),
      sceneItemStates
    )
  }
}

function trigger_scene_items(scene, style = SceneTriggerStyle.AUTO) {
  const itemStates = get_scene_item_states(scene)
  for (const itemName in itemStates) {
    try {
      const item = items.getItem(itemName)
      switch (style) {
        case SceneTriggerStyle.UPDATE:
          item.postUpdate(item.state)
          break
        case SceneTriggerStyle.COMMAND_AND_UPDATE:
          item.postUpdate(itemStates[itemName])
          item.sendCommand(itemStates[itemName])
          break
        default:
          item.postUpdate(itemStates[itemName])
          if (
            item.groupNames.includes('gCore_Lights_Switchables') &&
            is_on(item.state)
          ) {
            item.sendCommand(itemStates[itemName])
          }
      }
    } catch {
      console.log(
        'trigger_scene_items',
        `Could not set item state: Item ${item} does not exist.`
      )
    }
  }
}

function apply_context(context) {
  for (const scene of items.getItem('gCore_Scenes').members) {
    const contextState = json_storage(scene).get(
      'scenes',
      'context-states',
      context
    )

    if (scene.state == contextState) {
      break
    }

    const sceneStates = get_scene_states(scene)
    if (
      Object.values(sceneStates).some(
        (sceneState) => sceneState == contextState
      )
    ) {
      scene.postUpdate(stringifiedFloat(contextState))
    }
  }
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
        // Create scene store trigger
        //TODO language
        create_helper_item(
          sceneMember,
          ['scenes', 'store-trigger'],
          'Number',
          'settings',
          `${sceneMember.label} überschreiben`,
          ['gCore_Scenes_StoreTriggers'],
          [],
          (helperItemName) => {
            let metadata = {}
            for (const path of ['listWidget', 'cellWidget']) {
              metadata[path] = {
                config: {
                  label: `=items.${sceneMember.name}.title`,
                  icon: 'f7:gear_alt',
                  action: 'options',
                  actionItem: helperItemName
                }
              }
            }

            const stateDescription = sceneMember.rawItem
              ?.getStateDescription()
              ?.getOptions()
            if (stateDescription?.length) {
              metadata.stateDescription = {
                config: {
                  options: (() => {
                    let optionArray = []
                    for (const option of stateDescription) {
                      optionArray.push(
                        `${option.getValue()}=${option.getLabel()}`
                      )
                    }
                    return optionArray.join(',')
                  })(),
                  pattern: '%d'
                }
              }
            }
          }
        )

        // Sync (Add) switches for each scene state
        const sceneLocation = get_location(sceneMember)
        const sceneStates = get_scene_states(sceneMember)
        for (const sceneName in sceneStates) {
          //TODO language
          const stateTriggerLabel = `${sceneName}-Szene`
          const stateTrigger = create_helper_item(
            sceneMember,
            ['scenes', `trigger-state-${sceneStates[sceneName]}`],
            'Switch',
            'party',
            stateTriggerLabel,
            ['gCore_Scenes_StateTriggers'],
            SCENE_TRIGGER_TAGS,
            (helperItemName) => {
              let metadata = {
                ga: {
                  value: 'Scene',
                  config: {
                    sceneReversible: false,
                    synonyms: sceneLocation
                      ? [
                          `${stateTriggerLabel} in ${sceneLocation.label}`,
                          sceneMember,
                          `${sceneMember}-Modus in ${sceneLocation.label}`
                        ].join(',')
                      : undefined
                  }
                }
              }

              for (const path of ['listWidget', 'cellWidget']) {
                metadata[path] = {
                  config: {
                    label: `=items.${helperItemName}.title`,
                    icon: 'f7:film',
                    subtitle: `=items.${helperItemName}.displayState`
                  }
                }
              }
              return metadata
            }
          )

          json_storage(stateTrigger).set('scenes', 'trigger-state', {
            to: sceneStates[sceneName],
            'target-scene': sceneMember.name,
            generated: true
          })
        }

        // Sync (Remove) switches for each scene state
        for (const stateTrigger of items.getItem('gCore_Scenes_StateTriggers')
          .members) {
          const triggerInfo = json_storage(stateTrigger).get(
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
    triggers: [
      triggers.GroupStateUpdateTrigger('gCore_Scenes'),
      triggers.GroupCommandTrigger('gCore_Scenes')
    ],
    execute: (event) => {
      const scene = items.getItem(event.itemName)
      json_storage(scene).set(
        'scenes',
        'last-activation',
        time.ZonedDateTime.now().format(DATETIME_FORMAT)
      )
      trigger_scene_items(
        scene,
        event.triggerType == 'ItemStateUpdateTrigger'
          ? SceneTriggerStyle.AUTO
          : SceneTriggerStyle.COMMAND_AND_UPDATE
      )
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
      const triggerInfo = json_storage(item).get('scenes', 'trigger-state')

      if (
        !triggerInfo ||
        !(triggerInfo['states'] || [item.state]).some(
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

          const lastActivation = json_storage(scene).get(
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
  SCENE_TRIGGER_TAGS,
  SceneTriggerStyle
}
