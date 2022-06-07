const { items, triggers, actions, time, rules } = require('openhab')
const { uniq, intersection, uniqBy } = require('lodash')

const BroadcastType = {
  INFO: 0,
  ATTENTION: 1
}

const BroadcastNotificationMode = {
  NONE: 0,
  DEFAULT: 1,
  ATTENTION_ONLY: 2
}

const TIMEOUT = 5000
const HELPER_ITEM_TAG = 'CoreHelperItem'
const DATETIME_FORMAT = time.DateTimeFormatter.ofPattern(
  "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
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

  if (actions.Semantics.isLocation(item.rawItem)) {
    return item
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

function json_storage(item) {
  if (typeof item != 'string') {
    item = item.name
  }

  const urlSegments = [item]
  const getUrl = (segments) =>
    `http://openhab-helper:8082/json-storage/${segments.join('/')}`

  return {
    remove: () => {
      const url = getUrl(urlSegments)
      return JSON.parse(actions.HTTP.sendHttpDeleteRequest(url, TIMEOUT))
        .success
    },
    get: (...args) => {
      const url = getUrl(urlSegments.concat(args))
      return JSON.parse(actions.HTTP.sendHttpGetRequest(url, TIMEOUT)).data
    },
    set: (...args) => {
      if (args.length > 1) {
        const url = getUrl(urlSegments.concat(args.slice(0, -1)))
        return JSON.parse(
          actions.HTTP.sendHttpPostRequest(
            url,
            'application/json',
            JSON.stringify(args[args.length - 1]),
            TIMEOUT
          )
        ).success
      }
    }
  }
}

function info() {
  const url = `http://openhab-helper:8081/api/info`
  return JSON.parse(actions.HTTP.sendHttpGetRequest(url, TIMEOUT)).data
}

function get_helper_item(of, name) {
  name = Array.isArray(name) ? name : [name]
  const helperItemName = json_storage(of).get('helper-items', ...name)
  try {
    return helperItemName ? items.getItem(helperItemName) : undefined
  } catch {
    return undefined
  }
}

function get_item_of_helper_item(helperItem) {
  const itemName = json_storage(helperItem).get('helper-item-of')
  if (itemName) {
    try {
      return items.getItem(itemName)
    } catch {
      return undefined
    }
  }
}

function create_helper_item(
  of,
  name,
  type,
  category,
  label,
  groups = [],
  tags = [],
  metadata
) {
  name = Array.isArray(name) ? name : [name]
  let helperItem = get_helper_item(of, name)
  if (!helperItem) {
    tags.push(HELPER_ITEM_TAG)
    const helperItemName = `Core_HelperItem${Math.floor(
      Math.random() * 1000000000
    )}_Of_${of.name}`
    helperItem = items.addItem({
      name: helperItemName,
      type,
      category,
      groups,
      label,
      tags,
      metadata:
        typeof metadata == 'function' ? metadata(helperItemName) : metadata
    })

    json_storage(helperItem).set('helper-item-of', of.name)
    json_storage(of).set('helper-items', ...name, helperItemName)
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
          const matchedTags = intersection(item.tags, pointTag)
          if (pointTag.length == matchedTags.length) {
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
    const of = json_storage(helper).get('helper-item-of')
    let remove = undefined

    if (of) {
      try {
        items.getItem(of)
      } catch {
        remove = `Remove invalid helper item ${helper.name}: The targeted item ${of} does not exist.`
      }
    } else {
      remove = `Remove invalid helper item ${helper.name}: There is no targeted item set in metadata.`
    }

    if (remove) {
      console.log('remove_unlinked_helper_items', remove)
      try {
        items.removeItem(helper.name)
      } catch {}
    }
  }
}

function remove_invalid_helper_items() {
  for (const item of items.getItems()) {
    const helperItemTypes = json_storage(item).get('helper-items')
    for (const type in helperItemTypes) {
      const itemNames = helperItemTypes[type]
      for (const name in itemNames) {
        try {
          items.getItem(itemNames[name])
        } catch {
          console.log(
            'remove_invalid_helper_items',
            `Remove invalid json-storage of item ${item.name}: [${type} => ${itemNames[name]}] is no valid helper item.`
          )
          json_storage(item).remove('helper-items', type, name)
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
      triggers.GenericCronTrigger('5 0/5 * ? * * *'),
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
  sync_group_with_semantic_items,
  get_items_of_any_tags,
  stringifiedFloat,
  has_same_location,
  get_location,
  info,
  json_storage,
  broadcast,
  BroadcastType,
  BroadcastNotificationMode,
  DATETIME_FORMAT,
  HELPER_ITEM_TAG
}
