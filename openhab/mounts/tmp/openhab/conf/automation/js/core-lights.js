const { rules, items, triggers, time } = require('openhab')
const { uniq, uniqBy } = require('lodash')
const {
  metadata,
  get_all_semantic_items,
  get_items_of_any_tags,
  create_helper_item,
  get_childs_with_condition,
  has_same_location,
  stringifiedFloat,
  DATETIME_FORMAT,
  DATETIME_FORMAT2,
  sync_group_with_semantic_items,
  get_location
} = require(__dirname + '/core-helpers')
const { PresenceState } = require(__dirname + '/core-presence')
const { get_scene_items, trigger_scene_items } = require(__dirname +
  '/core-scenes')

const LightMode = {
  OFF: 0,
  ON: 1,
  AUTO_ON: 2,
  UNCHANGED: 3,
  SIMULATE: 4
}

const AmbientLightCondition = {
  DARK: 0,
  OBSCURED: 1,
  BRIGHT: 2
}

const LIGHTS_EQUIPMENT_TAGS = ['Lightbulb', 'PowerOutlet', 'WallSwitch']
const LIGHTS_POINT_TAGS = ['Switch']
const LIGHT_MEASUREMENT_POINT_TAGS = [['Light', 'Measurement']]
const LIGHT_MEASUREMENT_ASTRO_SUNPHASE = ['CoreAstroSun']

function get_light_mode_group() {
  const condition = Number.parseFloat(
    items.getItem('Core_Lights_AmbientLightCondition').state
  )
  switch (condition) {
    case AmbientLightCondition.DARK:
      return items.getItem('gCore_Lights_DarkMode')
    case AmbientLightCondition.OBSCURED:
      return items.getItem('gCore_Lights_ObscuredMode')
    default:
    case AmbientLightCondition.BRIGHT:
      return items.getItem('gCore_Lights_BrightMode')
  }
}

function convert_to_light_condition(luminance) {
  const darkTresholdItem = items.getItem(
    'Core_Lights_AmbientLightCondition_LuminanceTreshold_Dark'
  )
  const obscuredTresholdItem = items.getItem(
    'Core_Lights_AmbientLightCondition_LuminanceTreshold_Obscured'
  )

  if (luminance < darkTresholdItem.state) {
    return AmbientLightCondition.DARK
  }
  if (luminance < obscuredTresholdItem.state) {
    return AmbientLightCondition.OBSCURED
  }
  return AmbientLightCondition.BRIGHT
}

function get_astro_light_condition() {
  for (const astroItem of items.getItemsByTag(
    ...LIGHT_MEASUREMENT_ASTRO_SUNPHASE
  )) {
    if (astroItem.state == 'NIGHT') {
      return AmbientLightCondition.DARK
    }
    if (astroItem.state == 'DAYLIGHT') {
      return AmbientLightCondition.BRIGHT
    }

    return AmbientLightCondition.OBSCURED
  }
  return undefined
}

function get_light_condition() {
  const conditionItem = items.getItem('Core_Lights_AmbientLightCondition')
  return conditionItem.state
}

function set_light_condition(condition, luminance) {
  const conditionItem = items.getItem('Core_Lights_AmbientLightCondition')
  if (conditionItem.state != condition) {
    conditionItem.postUpdate(stringifiedFloat(condition))
  }

  if (luminance !== undefined) {
    metadata(conditionItem).setConfiguration('lights', 'luminance', luminance)
  }
}

function get_darkest_light_condition(conditions) {
  const orderedConditions = [
    AmbientLightCondition.DARK,
    AmbientLightCondition.OBSCURED,
    AmbientLightCondition.BRIGHT
  ]
  for (const orderedCondition of orderedConditions) {
    if (conditions.some((condition) => orderedCondition == condition)) {
      return orderedCondition
    }
  }
}

function set_location_as_activated(switchable) {
  const location = get_location(switchable)
  if (location) {
    metadata(location).setConfiguration(
      'lights',
      'last-activation',
      time.ZonedDateTime.now().format(DATETIME_FORMAT2)
    )
  }
}

function is_on(state) {
  if (state == 'ON') {
    return true
  } else if (/\d{1,3},\d{1,3},(\d{1,3})/.test(state)) {
    return /\d{1,3},\d{1,3},(\d{1,3})/.exec(state)[1] > 0
  } else {
    return Number.parseFloat(state) > 0
  }
}

function is_elapsed(item) {
  const location = get_location(item)
  if (location) {
    const lastActivation = metadata(location).getConfiguration(
      'lights',
      'last-activation'
    )
    if (lastActivation) {
      const durationItem = items.getItem('Core_Lights_DefaultDuration')

      return (
        durationItem.state &&
        time.ZonedDateTime.parse(lastActivation, DATETIME_FORMAT).until(
          time.ZonedDateTime.now(),
          time.ChronoUnit.MINUTES
        ) > durationItem.state
      )
    }
  }
  return false
}

function turn_on_switchable_point(point) {
  if (!is_on(point.state)) {
    point.sendCommand('ON')
    point.postUpdate('ON')
  } else {
    point.postUpdate(point.state)
  }
}

function turn_off_switchable_point(point) {
  if (is_on(point.state)) {
    point.sendCommand('OFF')
    point.postUpdate('OFF')
  } else {
    point.postUpdate(point.state)
  }
}

function scriptLoaded() {
  rules.JSRule({
    name: 'sync_lights_helpers',
    description: 'Core (JS) - Sync helper items of lights',
    tags: ['core', 'core-lights'],
    triggers: [
      triggers.GenericCronTrigger('30 0/5 * ? * * *'),
      triggers.SystemStartlevelTrigger(100)
    ],
    execute: (event) => {
      // Sync group gCore_Lights_Switchables with switchable items - it's needed to create triggers on it
      const members = sync_group_with_semantic_items(
        'gCore_Lights_Switchables',
        LIGHTS_EQUIPMENT_TAGS,
        LIGHTS_POINT_TAGS
      )

      // Get locations
      const locations = uniqBy(
        members.map((l) => get_location(l)).filter((l) => l),
        (l) => l.name
      )

      // Create helper items for each location
      const helperItems = [
        {
          suffix: 'dark',
          label: (label) => `Lichtmodus (Dunkel) in ${label}`,
          groups: ['gCore_Lights_DarkMode'],
          icon: 'oh:moon'
        },
        {
          suffix: 'bright',
          label: (label) => `Lichtmodus (Hell) in ${label}`,
          groups: ['gCore_Lights_BrightMode'],
          icon: 'oh:sun'
        },
        {
          suffix: 'obscured',
          label: (label) => `Lichtmodus (Verdunkelt) in ${label}`,
          groups: ['gCore_Lights_ObscuredMode'],
          icon: 'oh:blinds'
        }
      ]

      for (const location of locations) {
        const helperGroupItem = create_helper_item(
          location,
          'lights',
          'light-mode-group',
          'Group',
          'colorlight',
          `Lichtmodus in ${location.label}`,
          [location.name],
          ['Equipment']
        )

        for (const item of helperItems) {
          const helperItem = create_helper_item(
            location,
            'lights',
            `light-mode-${item.suffix}`,
            'Number',
            item.icon,
            item.label(location.label),
            item.groups.concat([helperGroupItem.name]),
            ['Point']
          )

          if (!helperItem.groupNames.includes(helperGroupItem.name)) {
            helperItem.addGroups(helperGroupItem)
          }

          metadata(helperItem, 'stateDescription').setConfiguration({
            pattern: '%d',
            options:
              '0.0=Aus,1.0=An,2.0=Auto-An,3.0=Unveraendert,4.0=Simulierend'
          })

          for (const path of ['listWidget', 'cellWidget']) {
            metadata(helperItem, path).setConfiguration({
              label: `=items.${helperItem.name}.title`,
              icon: `oh:${item.icon}`,
              action: 'options',
              actionItem: helperItem.name,
              subtitle: `=items.${helperItem.name}.displayState`
            })
          }
        }
      }
    }
  })

  rules.JSRule({
    name: 'set_last_light_activation',
    description: 'Core (JS) - Keep last light activation update.',
    tags: ['core', 'core-lights'],
    triggers: [triggers.GroupStateUpdateTrigger('gCore_Lights_Switchables')],
    execute: (event) => {
      const item = items.getItem(event.itemName)
      if (is_on(item.state)) {
        set_location_as_activated(item)
      }
    }
  })

  rules.JSRule({
    name: 'check_daylight',
    description: 'Core (JS) - Manage daylight status changes.',
    tags: ['core', 'core-lights'],
    triggers: [
      triggers.ItemStateChangeTrigger(
        'Core_Lights_AmbientLightCondition_LuminanceTreshold_Dark'
      ),
      triggers.ItemStateChangeTrigger(
        'Core_Lights_AmbientLightCondition_LuminanceTreshold_Obscured'
      ),
      triggers.GenericCronTrigger('0 0/30 * ? * * *')
    ],
    execute: (event) => {
      const sensors = get_items_of_any_tags(
        LIGHT_MEASUREMENT_POINT_TAGS
      ).filter((sensor) => !Number.isNaN(Number.parseFloat(sensor.state)))

      const activeSwitchables = get_all_semantic_items(
        LIGHTS_EQUIPMENT_TAGS,
        LIGHTS_POINT_TAGS
      ).filter((switchable) => is_on(switchable.state))

      const activeRoomNames = activeSwitchables
        .map((switchable) => get_location(switchable))
        .filter((r) => r)
        .map((r) => r.name)

      const isNotActiveRoom = (location) => {
        return location && !activeRoomNames.includes(location.name)
      }

      const sensorsOfInactiveRooms = sensors
        .filter((sensor) => isNotActiveRoom(get_location(sensor)))
        .sort((sensor1, sensor2) => sensor1.state - sensor2.state)

      if (sensorsOfInactiveRooms.length == 0) {
        const astroLightCondition = get_astro_light_condition()
        if (astroLightCondition) {
          set_light_condition(astroLightCondition)
        }
        return
      }

      const medianSensorItem =
        sensorsOfInactiveRooms[Math.floor(sensorsOfInactiveRooms.length / 2)]
      const luminance = medianSensorItem.state
      const newCondition = get_darkest_light_condition([
        get_astro_light_condition(),
        convert_to_light_condition(luminance)
      ])
      set_light_condition(newCondition, luminance)
    }
  })

  rules.JSRule({
    name: 'manage_light_state',
    description: 'Core (JS) - Manage lights according to light conditions.',
    tags: ['core', 'core-lights'],
    triggers: [
      triggers.GroupStateUpdateTrigger('gCore_Lights_DarkMode'),
      triggers.GroupStateUpdateTrigger('gCore_Lights_BrightMode'),
      triggers.GroupStateUpdateTrigger('gCore_Lights_ObscuredMode'),
      triggers.ItemStateUpdateTrigger('Core_Lights_AmbientLightCondition'),
      triggers.ItemStateUpdateTrigger('Core_Presence')
    ],
    execute: (event) => {
      const lightModeGroup = get_light_mode_group()
      const switchOnRoomNames = lightModeGroup.members
        .filter((groupMember) => groupMember.state == LightMode.ON)
        .map((groupMember) => get_location(groupMember))
        .filter((r) => r)
        .map((r) => r.name)

      const switchOffRoomNames = lightModeGroup.members
        .filter((groupMember) => groupMember.state == LightMode.OFF)
        .map((groupMember) => get_location(groupMember))
        .filter((r) => r)
        .map((r) => r.name)

      for (const point of get_all_semantic_items(
        LIGHTS_EQUIPMENT_TAGS,
        LIGHTS_POINT_TAGS
      )) {
        const location = get_location(point)
        if (location && switchOnRoomNames.includes(location.name)) {
          turn_on_switchable_point(point)
        }
        if (location && switchOffRoomNames.includes(location.name)) {
          turn_off_switchable_point(point)
        }
      }
    }
  })

  rules.JSRule({
    name: 'manage_presence',
    description: 'Core (JS) - Manage lights on presence.',
    tags: ['core', 'core-lights'],
    triggers: [
      triggers.GroupStateUpdateTrigger('gCore_Presence_PresenceTrigger', 'ON'),
      triggers.GroupStateUpdateTrigger('gCore_Presence_PresenceTrigger', 'OPEN')
    ],
    execute: (event) => {
      const item = items.getItem(event.itemName)
      const location = get_location(item)
      const lightModeGroup = get_light_mode_group()
      const switchOnSwitchableNames = get_all_semantic_items(
        LIGHTS_EQUIPMENT_TAGS,
        LIGHTS_POINT_TAGS
      )
        .filter((item) => is_on(item.state))
        .map((s) => s.name)

      for (const member of lightModeGroup.members) {
        if (
          member.state == LightMode.AUTO_ON &&
          has_same_location(member, location)
        ) {
          const scene = items
            .getItem('gCore_Scenes')
            .members.find((scene) => has_same_location(scene, location))
          if (scene) {
            trigger_scene_items(
              scene,
              !!get_scene_items(scene).find((item) =>
                switchOnSwitchableNames.includes(item.name)
              )
            )
          } else if (
            get_childs_with_condition(location, (point) =>
              switchOnSwitchableNames.includes(point.name)
            ).length == 0
          ) {
            for (const point of get_all_semantic_items(
              LIGHTS_EQUIPMENT_TAGS,
              LIGHTS_POINT_TAGS
            )) {
              if (has_same_location(point, location)) {
                turn_on_switchable_point(point)
              }
            }
          }
          break
        }
      }
    }
  })

  rules.JSRule({
    name: 'welcome_light',
    description: 'Core (JS) - Manage lights when come back home.',
    tags: ['core', 'core-lights'],
    triggers: [
      triggers.ItemStateChangeTrigger('Core_Presence', PresenceState.HOME)
    ],
    execute: (event) => {
      const condition = items.getItem('Core_Lights_AmbientLightCondition')
      const welcomeLightModeMapping = {}
      welcomeLightModeMapping[AmbientLightCondition.DARK] =
        'Core_Lights_WelcomeLight_DarkMode'
      welcomeLightModeMapping[AmbientLightCondition.OBSCURED] =
        'Core_Lights_WelcomeLight_ObscuredMode'
      welcomeLightModeMapping[AmbientLightCondition.BRIGHT] =
        'Core_Lights_WelcomeLight_BrightMode'

      const welcomeLightMode =
        welcomeLightModeMapping[condition.state] &&
        items.getItem(welcomeLightModeMapping[condition.state])
      if (welcomeLightMode.state == 'ON') {
        const lightModeGroup = get_light_mode_group()
        const switchOnRoomNames = lightModeGroup.members
          .filter((mode) => mode.state == LightMode.AUTO_ON)
          .map((mode) => get_location(mode))
          .filter((r) => r)
          .map((r) => r.name)

        for (const point of get_all_semantic_items(
          LIGHTS_EQUIPMENT_TAGS,
          LIGHTS_POINT_TAGS
        )) {
          const location = get_location(point)
          if (location && switchOnRoomNames.includes(location.name)) {
            turn_on_switchable_point(point)
          }
        }
      }
    }
  })

  rules.JSRule({
    name: 'elapsed_lights',
    description: 'Core (JS) - Manage elapsed lights.',
    tags: ['core', 'core-lights'],
    triggers: [
      triggers.GenericCronTrigger('0 * * ? * * *'),
      triggers.ItemStateUpdateTrigger('Core_Lights_DefaultDuration')
    ],
    execute: (event) => {
      const lightModeGroup = get_light_mode_group()
      const switchOffRoomNames = uniq(
        lightModeGroup.members
          .filter((mode) =>
            [LightMode.AUTO_ON, LightMode.OFF].some(
              (state) => state == mode.state
            )
          )
          .map((mode) => get_location(mode))
          .filter((r) => r && is_elapsed(r))
          .map((r) => r.name)
      )

      for (const point of get_all_semantic_items(
        LIGHTS_EQUIPMENT_TAGS,
        LIGHTS_POINT_TAGS
      )) {
        const location = get_location(point)
        if (location && switchOffRoomNames.includes(location.name)) {
          turn_off_switchable_point(point)
        }
      }
    }
  })

  rules.JSRule({
    name: 'simulate_presence',
    description: 'Core (JS) - Simulate lights.',
    tags: ['core', 'core-lights'],
    triggers: [triggers.GenericCronTrigger('0 0/5 0 ? * * *')],
    execute: (event) => {
      const lightModeGroup = get_light_mode_group()
      const simulateLocations = uniqBy(
        lightModeGroup.members
          .filter((mode) => mode.state == LightMode.SIMULATE)
          .map((mode) => get_location(mode))
          .filter((l) => l),
        (l) => l.name
      )

      for (const point of get_all_semantic_items(
        LIGHTS_EQUIPMENT_TAGS,
        LIGHTS_POINT_TAGS
      )) {
        const location = get_location(point)
        if (
          location &&
          simulateLocations.includes(location.name) &&
          Math.random() <= 0.25
        ) {
          if (!is_on(point.state)) {
            turn_on_switchable_point(point)
          } else {
            turn_off_switchable_point(point)
          }
        }
      }
    }
  })
}

module.exports = {
  get_light_mode_group,
  get_light_condition,
  convert_to_light_condition,
  get_astro_light_condition,
  set_light_condition,
  get_darkest_light_condition,
  set_location_as_activated,
  is_elapsed,
  is_on,
  turn_on_switchable_point,
  turn_off_switchable_point,
  LightMode,
  AmbientLightCondition,
  LIGHTS_EQUIPMENT_TAGS,
  LIGHTS_POINT_TAGS,
  LIGHT_MEASUREMENT_POINT_TAGS,
  LIGHT_MEASUREMENT_ASTRO_SUNPHASE
}
