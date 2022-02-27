const { items, osgi, triggers, actions, time, rules } = require('openhab')
const {
  uniq,
  get,
  set,
  intersection,
  unset,
  uniqBy,
  isEmpty
} = require('lodash')

const Metadata = Java.type('org.openhab.core.items.Metadata')
const MetadataKey = Java.type('org.openhab.core.items.MetadataKey')
const MetadataRegistry = osgi.getService(
  'org.openhab.core.items.MetadataRegistry'
)

const BroadcastType = {
  INFO: 0,
  ATTENTION: 1
}

const BroadcastNotificationMode = {
  NONE: 0,
  DEFAULT: 1,
  ATTENTION_ONLY: 2
}

const METADATA_NAMESPACE = 'core'
const HELPER_ITEM_TAG = 'CoreHelperItem'
const DATETIME_FORMAT = time.DateTimeFormatter.ofPattern(
  "yyyy-MM-dd'T'HH:mm:ss.SSS[xxxx][xxxxx]"
)

function broadcast(text, broadcastType = BroadcastType.INFO) {
  const state = items.getItem('Core_Broadcast_NotificationMode').state
  let notificationMode = state || BroadcastNotificationMode.DEFAULT

  if (
    (broadcastType == BroadcastType.INFO &&
      notificationMode == BroadcastNotificationMode.DEFAULT) ||
    (broadcastType == BroadcastType.ATTENTION &&
      (notificationMode == BroadcastNotificationMode.DEFAULT ||
        notificationMode == BroadcastNotificationMode.ATTENTION_ONLY))
  ) {
    actions.NotificationAction.sendBroadcastNotification(text)
    console.log(
      'Broadcast message',
      `Following message was broadcasted to all users: ${text}`
    )
  } else {
    console.log('Broadcast message', `Following message was muted: ${text}`)
  }
}

function get_location(item) {
  if (typeof item == 'string') {
    try {
      item = items.getItem(item)
    } catch {
      return undefined
    }
  }

  item = actions.Semantics.getLocation(item.rawItem)
  return item ? items.getItem(item.name) : undefined
}

function has_same_location(item1, item2) {
  const locationItem1 = get_location(item1)
  const locationItem2 = get_location(item2)
  return (
    locationItem1 && locationItem2 && locationItem1.name == locationItem2.name
  )
}

function get_items_of_any_tags(tags = []) {
  return uniq(
    tags.reduce(
      (tags, tag) =>
        tags.concat(
          Array.isArray(tag)
            ? items.getItemsByTag(...tag)
            : items.getItemsByTag(tag)
        ),
      []
    )
  )
}

function sync_group_with_semantic_items(group, equipmentTags, pointTags) {
  if (typeof group == 'string') {
    group = items.getItem(group)
  }

  const actualGroupItems = group.members
  const actualGroupItemNames = actualGroupItems.map((item) => item.name)
  const targetedGroupItems = get_all_semantic_items(equipmentTags, pointTags)
  const targetedGroupItemNames = targetedGroupItems.map((item) => item.name)

  for (const actualGroupItem of actualGroupItems) {
    if (!targetedGroupItemNames.includes(actualGroupItem.name)) {
      actualGroupItem.removeGroups(group)
    }
  }

  for (const targetedGroupItem of targetedGroupItems) {
    if (!actualGroupItemNames.includes(targetedGroupItem.name)) {
      targetedGroupItem.addGroups(group)
    }
  }

  return targetedGroupItems
}

function metadata(item, namespace = METADATA_NAMESPACE) {
  if (typeof item != 'string') {
    item = item.name
  }

  const metadataKey = new MetadataKey(namespace, item)
  const metadata = MetadataRegistry.get(metadataKey)

  const remove = () => {
    if (metadata) {
      return MetadataRegistry.remove(metadata)
    }
  }

  const getValue = () => {
    return metadata ? metadata.getValue() : null
  }

  const getConfiguration = (...args) => {
    if (!metadata) {
      return undefined
    }

    const copy = (obj) => {
      if (!obj) {
        return obj
      }
      var value
      var objCopy = Array.isArray(obj) ? [] : {}
      for (let k in obj) {
        value = obj[k]
        objCopy[k] = typeof value === 'object' ? copy(value) : value
      }
      return objCopy
    }

    const configuration = copy(metadata.getConfiguration())
    if (args.length == 0) {
      return isEmpty(configuration) ? undefined : configuration
    }
    return get(configuration, args)
  }

  const setValue = (value) => {
    const newMetadata = new Metadata(
      metadataKey,
      value === undefined ? null : value,
      getConfiguration() || {}
    )

    if (metadata) {
      MetadataRegistry.update(newMetadata)
    } else {
      MetadataRegistry.add(newMetadata)
    }
  }

  const setConfiguration = (...args) => {
    let configuration = getConfiguration() || {}
    switch (args.length) {
      case 0:
        configuration = {}
        break

      case 1:
        configuration = args[0]
        break

      default:
        configuration = set(
          configuration,
          args.slice(0, -1),
          args[args.length - 1]
        )

        if (args[args.length - 1] === undefined) {
          unset(configuration, args.slice(0, -1))
        }
    }

    const newMetadata = new Metadata(metadataKey, getValue(), configuration)
    if (metadata) {
      MetadataRegistry.update(newMetadata)
    } else {
      MetadataRegistry.add(newMetadata)
    }
  }

  return { setConfiguration, getConfiguration, remove, getValue, setValue }
}

function get_helper_item(of, type, name) {
  try {
    const helperItemName = metadata(of).getConfiguration(
      'helper-items',
      type,
      name
    )

    return helperItemName ? items.getItem(helperItemName) : undefined
  } catch {
    return undefined
  }
}

function get_item_of_helper_item(helperItem) {
  try {
    const itemName = metadata(helperItem).getConfiguration('helper-item-of')
    if (itemName) {
      return items.getItem(itemName)
    }
  } catch {
    return undefined
  }
}

function create_helper_item(
  of,
  type,
  name,
  item_type,
  category,
  label,
  groups = [],
  tags = []
) {
  let helperItem = get_helper_item(of, type, name)
  if (!helperItem) {
    tags.push(HELPER_ITEM_TAG)
    helperItem = items.addItem(
      `Core_HelperItem${Math.floor(Math.random() * 1000000000)}_Of_${of.name}`,
      item_type,
      category,
      groups,
      label,
      tags
    )

    metadata(helperItem).setConfiguration('helper-item-of', of.name)

    metadata(of).setConfiguration('helper-items', type, name, helperItem.name)
  }

  return helperItem
}

function get_semantic_items(rootItem, equipmentTags, pointTags) {
  const equipments =
    equipmentTags && equipmentTags.length > 0
      ? get_childs_with_condition(rootItem, (item) => {
          for (const equipmentTag of equipmentTags) {
            if (Array.isArray(equipmentTag)) {
              const matchedTags = intersection(item.tags, equipmentTags)
              if (equipmentTags.length == matchedTags.length) {
                return true
              }
            } else if (item.tags.includes(equipmentTag)) {
              return true
            }
          }

          return false
        })
      : [rootItem]

  if (!pointTags || pointTags.length == 0) {
    return equipments
  }

  const points = equipments.reduce((pointsList, newEquipment) => {
    const newPoints = get_childs_with_condition(newEquipment, (item) => {
      for (const pointTag of pointTags) {
        if (Array.isArray(pointTag)) {
          const matchedTags = intersection(item.tags, pointTags)
          if (pointTags.length == matchedTags.length) {
            return true
          }
        } else if (item.tags.includes(pointTag)) {
          return true
        }
      }

      return false
    })
    return pointsList.concat(newPoints)
  }, [])

  return uniqBy(points, (item) => item.name)
}

function get_all_semantic_items(equipmentTags, pointTags) {
  const points = (
    equipmentTags && equipmentTags.length > 0
      ? get_items_of_any_tags(equipmentTags)
      : items.getItems()
  ).reduce((pointsList, newEquipment) => {
    const newPoints = get_semantic_items(newEquipment, undefined, pointTags)
    return pointsList.concat(newPoints)
  }, [])

  return uniqBy(points, (item) => item.name)
}

function get_parents_with_condition(item, condition = (item) => !!item) {
  if (typeof item == 'string') {
    item = items.getItem(item)
  }

  if (condition(item)) {
    return [item]
  }

  if (item.groupNames.length == 0) {
    return []
  }

  const groupMembers = item.groupNames.reduce((memberList, newMember) => {
    const newMembers = get_parents_with_condition(newMember, condition)
    return memberList.concat(newMembers)
  }, [])

  return uniqBy(groupMembers, (item) => item.name)
}

function get_childs_with_condition(item, condition = (item) => true) {
  if (typeof item == 'string') {
    item = items.getItem(item)
  }

  if (condition(item)) {
    return [item]
  }

  if (item.type != 'GroupItem') {
    return []
  }

  const groupMembers = item.members.reduce((memberList, newMember) => {
    const newMembers = get_childs_with_condition(newMember, condition)
    return memberList.concat(newMembers)
  }, [])

  return uniqBy(groupMembers, (item) => item.name)
}

function remove_unlinked_helper_items() {
  for (const helper of items.getItemsByTag(HELPER_ITEM_TAG)) {
    const of = metadata(helper).getConfiguration('helper-item-of')

    if (!of) {
      console.log(
        'remove_unlinked_helper_items',
        `Remove invalid helper item ${helper.name}: There is no targeted item set in metadata.`
      )

      items.removeItem(helper)
      continue
    }

    try {
      items.getItem(of)
    } catch {
      console.log(
        'remove_unlinked_helper_items',
        `Remove invalid helper item ${helper.name}: The targeted item ${of} does not exist.`
      )
      items.removeItem(helper)
    }
  }
}

function remove_invalid_helper_items() {
  for (const item of items.getItems()) {
    const helperItemTypes = metadata(item).getConfiguration('helper-items')
    for (const type in helperItemTypes) {
      const itemNames = helperItemTypes[type]
      for (const name in itemNames) {
        try {
          items.getItem(itemNames[name])
        } catch {
          console.log(
            'remove_invalid_helper_items',
            `Remove invalid metadata of item ${item.name}: [${type} => ${name}] is no valid helper item.`
          )
          metadata(item).setConfiguration('helper-items', type, name, undefined)
        }
      }
    }
  }
}

function stringifiedFloat(state) {
  const number = Number.parseFloat(state)
  if (!Number.isNaN(number)) {
    return number.toFixed(1)
  }
  return state
}

function scriptLoaded() {
  rules.JSRule({
    name: 'remove_unlinked_or_invalid_helper_items',
    description: 'Core (JS) - Check helper items.',
    tags: ['core', 'core-helpers'],
    triggers: [
      triggers.GenericCronTrigger('30 0/5 * ? * * *'),
      triggers.SystemStartlevelTrigger(100)
    ],
    execute: (event) => {
      remove_unlinked_helper_items()
      remove_invalid_helper_items()
    }
  })
}

module.exports = {
  get_childs_with_condition,
  get_parents_with_condition,
  get_all_semantic_items,
  get_semantic_items,
  create_helper_item,
  get_helper_item,
  get_item_of_helper_item,
  metadata,
  sync_group_with_semantic_items,
  get_items_of_any_tags,
  stringifiedFloat,
  has_same_location,
  get_location,
  broadcast,
  BroadcastType,
  BroadcastNotificationMode,
  DATETIME_FORMAT,
  METADATA_NAMESPACE,
  HELPER_ITEM_TAG
}
