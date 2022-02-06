const { rules, items, triggers, time } = require('openhab')
const { uniqBy } = require('lodash')
const { TemporalUnit } = require('openhab/time')
const {
  metadata,
  create_helper_item,
  get_all_semantic_items,
  get_items_of_any_tags,
  sync_group_with_semantic_items,
  get_location,
  has_same_location
} = require('./core-helpers')

const SCENE_TAGS = ['CoreScene']

const SCENE_TRIGGER_TAGS = ['CoreSceneTrigger']

function get_scene_state(scene) {
  if (['NULL', 'UNDEF'].includes(scene.state)) {
    return scene.state
  } else {
    const commandDescription = scene.getCommandDescription()
    const commandOptions = commandDescription
      ? commandDescription.getCommandOptions()
      : []
    if (commandOptions) {
      return commandOptions[0].getCommand()
    }
  }
  return undefined
}

function get_scene_states(scene) {
  const commandDescription = scene.getCommandDescription()
  const commandOptions = commandDescription
    ? commandDescription.getCommandOptions()
    : []
  if (!commandOptions) {
    return []
  }
  return commandOptions.reduce(
    (obj, newOption) => (obj[newOption.getCommand()] = newOption.getLabel()),
    {}
  )
}

function get_scene_items(scene) {
  const sceneMembers = metadata(scene).getConfiguration([
    'scenes',
    'custom-members'
  ]) || ['default:true']

  const handleMember = (member) => {
    if (member.startsWith('tag:')) {
      return get_items_of_any_tags([member.substring(4)]).filter(
        (item) => item.getType() != 'Group' && has_same_location(item, scene)
      )
    }

    // Use lights as default items in list.
    if (member.startsWith('default:')) {
      if (member == 'default:true') {
        return get_all_semantic_items(
          LIGHTS_EQUIPMENT_TAGS,
          LIGHTS_POINT_TAGS
        ).filter(
          (item) => item.getType() != 'Group' && has_same_location(item, scene)
        )
      }
    }
    return get_childs_with_condition(
      member,
      (item) => item.getType() != 'Group'
    )
  }

  return uniqBy(
    sceneMembers.reduce(
      (memberList, newMember) => memberList.concat(handleMember(newMember)),
      []
    ),
    (item) => item.name
  )
}

function get_scene_item_states(scene, scene_state = undefined) {
  const scene_state = scene_state || get_scene_state(scene)

  if (scene_state === undefined) {
    return []
  }

  const states = metadata(scene).getConfiguration([
    'scenes',
    'states',
    scene_state
  ])

  return get_scene_items(scene).reduce(
    (obj, newItem) => (obj[newItem.name] = states?.[newItem.name]),
    {}
  )
}

function save_scene_item_states(scene, scene_state = undefined) {
  const items = get_scene_items(scene)
  const scene_state = scene_state || get_scene_state(scene)

  if (scene_state !== undefined) {
    for (let item in items) {
      items[item] = items.getItem(item)?.state
    }

    metadata(scene).setConfiguration(['scenes', 'states', scene_state], items)
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
  const contextState = metadata(scene).getConfiguration([
    'scenes',
    'context-states',
    context
  ])

  if (Object.values(get_scene_states(scene)).includes(contextState)) {
    scene.postUpdate(contextState)
    return true
  }
  return false
}

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
      // get scene location
      const sceneLocation = get_location(sceneMember)

      // check metadata of context states
      const contextStates = metadata(sceneMember).getConfiguration([
        'scenes',
        'context-states'
      ])

      const defaultContextStates = {
        reset: false
      }

      for (const key of Object.keys(defaultContextStates)) {
        if (!contextStates.includes(key)) {
          contextStates[key] = defaultContextStates[key]
        }
      }

      metadata(sceneMember).setConfiguration(
        ['scenes', 'context-states'],
        contextStates
      )

      // Create scene store trigger
      const helper = create_helper_item(
        sceneMember,
        'scenes',
        'store-trigger',
        'Number',
        'settings',
        '{0} überschreiben'.format(sceneMember.label),
        ['gCore_Scenes_StoreTriggers'],
        ['Point']
      )

      for (const path of ['listWidget', 'cellWidget']) {
        metadata(helper).setConfiguration(path, {
          label: '=items.{0}.title'.format(sceneMember.name),
          icon: 'oh:settings',
          action: 'options',
          actionItem: helper.name
        })
      }

      const commandDescription = sceneMember.getCommandDescription()
      const commandOptions = commandDescription
        ? commandDescription.getCommandOptions()
        : []
      if (commandOptions) {
        metadata(helper).setConfiguration('stateDescription', {
          options: commandOptions
            .map((option) =>
              '{}={}'.format(option.getCommand(), option.getLabel())
            )
            .join(','),
          pattern: '%d'
        })
      }

      // Sync (Add) switches for each scene state
      const sceneStates = get_scene_states(sceneMember)
      for (const sceneName in sceneStates) {
        const stateTriggerLabel = '{0}-Szene'.format(sceneName)
        const stateTrigger = create_helper_item(
          sceneMember,
          'scenes',
          'trigger-state-{}'.format(sceneStates[sceneName]),
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

        meta.setConfiguration(['scenes', 'trigger-state'], {
          to: sceneStates[sceneName],
          'target-scene': sceneMember.name,
          generated: true
        })

        meta.setValue('ga', 'Scene')

        meta.setConfiguration('ga', {
          sceneReversible: false,
          synonyms: sceneLocation
            ? '{} in {}'.format(stateTriggerLabel, sceneLocation.label)
            : undefined
        })

        for (const path of ['listWidget', 'cellWidget']) {
          meta.setConfiguration(path, {
            label: '=items.{0}.title'.format(stateTrigger.name),
            icon: 'oh:party',
            subtitle: '=items.{0}.displayState'.format(stateTrigger.name)
          })
        }
      }

      // Sync (Remove) switches for each scene state
      for (const stateTrigger of items.getItem('gCore_Scenes_StateTriggers')
        .members) {
        const triggerInfo = metadata(stateTrigger).getConfiguration([
          'scenes',
          'trigger-state'
        ])

        // Do not remove manual created items that are just tagged wrong as it could be added manually to an existing (important) item.
        if (!triggerInfo || !triggerInfo['generated']) {
          continue
        }

        if (triggerInfo['to'] && triggerInfo['target-scene']) {
          try {
            const scene = items.getItem(triggerInfo['target-scene'])
            if (
              scene &&
              Object.values(get_scene_states(scene)).includes(triggerInfo['to'])
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
      ['scenes', 'last-activation'],
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
    const triggerInfo = metadata(item).getConfiguration([
      'scenes',
      'trigger-state'
    ])

    if (triggerInfo['states'] && !triggerInfo['states'].includes(item.state)) {
      return
    }

    if (triggerInfo['to'] && triggerInfo['target-scene']) {
      try {
        const scene = items.getItem(triggerInfo['target-scene'])
      } catch {
        return
      }

      if (triggerInfo['from'] && triggerInfo['from'] != scene.state) {
        return
      }

      const lastActivation = metadata(scene).getConfiguration([
        'scenes',
        'last-activation'
      ])

      if (
        !lastActivation ||
        (triggerInfo['hours-until-active'] &&
          time
            .parse(lastActivation)
            .until(time.ZonedDateTime.now(), TemporalUnit.HOURS) <=
            triggerInfo['hours-until-active']) ||
        (triggerInfo['minutes-until-active'] &&
          time
            .parse(lastActivation)
            .until(time.ZonedDateTime.now(), TemporalUnit.MINUTES) <=
            triggerInfo['minutes-until-active']) ||
        (triggerInfo['seconds-until-active'] &&
          time
            .parse(lastActivation)
            .until(time.ZonedDateTime.now(), TemporalUnit.HOURS) <=
            triggerInfo['seconds-until-active'])
      ) {
        return
      }

      scene.postUpdate(triggerInfo['to'])
    }
  }
})

module.exports = {
  get_scene_state,
  get_scene_states,
  get_scene_items,
  get_scene_item_states,
  save_scene_item_states,
  trigger_scene_items,
  apply_context
}
