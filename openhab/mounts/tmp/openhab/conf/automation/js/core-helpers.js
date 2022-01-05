const { items } = require('openhab')
const { uniq, get, intersection, uniqBy } = require('lodash')
const MetadataRegistry = osgi.getService(
  'org.openhab.core.items.MetadataRegistry'
)
const MetadataKey = Java.type('org.openhab.core.items.MetadataKey')

const METADATA_NAMESPACE = 'core'
const HELPER_ITEM_TAG = 'CoreHelperItem'

export function get_location(item) {
  if (typeof item == 'string') {
    try {
      item = items.getItem(item)
    } catch {
      return undefined
    }
  }

  return Semantics.getLocation(item)
}

export function has_same_location(item1, item2) {
  const locationItem1 = get_location(item1)
  const locationItem2 = get_location(item2)
  return (
    locationItem1 && locationItem2 && locationItem1.name == locationItem2.name
  )
}

export function get_items_of_any_tags(tags = []) {
  return uniq(
    tags.reduce((tags, tag) => tags.concat(items.getItemsByTag(tag)), [])
  )
}

export function sync_group_with_semantic_items(
  group,
  equipmentTags,
  pointTags
) {
  if (typeof group == 'string') {
    group = items.getItem(group)
  }

  const actualGroupItems = group.member
  const actualGroupItemNames = actualGroupItems.map((item) => item.name)
  const targetedGroupItems = get_all_semantic_items(equipmentTags, pointTags)
  const targetedGroupItemNames = targetedGroupItems.map((item) => item.name)

  for (const actualGroupItem of actualGroupItems) {
    if (!targetedGroupItemNames.includes(actualGroupItem.name)) {
      group.removeMember(actualGroupItem)
    }
  }

  for (const targetedGroupItem of targetedGroupItems) {
    if (!actualGroupItemNames.includes(targetedGroupItem.name)) {
      group.addMember(targetedGroupItem)
    }
  }

  return targetedGroupItems
}

export function metadata(item, namespace = METADATA_NAMESPACE) {
  if (typeof item != 'string') {
    item = item.name
  }

  const metadataKey = new MetadataKey(namespace, item)
  const metadata =
    MetadataRegistry.get(metadataKey) || new Metadata(metadataKey, null)

  return {
    getValue: () => metadata.getValue(),
    getConfiguration: (path) => get(metadata.getConfiguration(), path),
    setValue: (value) => {
      metadata.value = value
      return MetadataRegistry.update(metadata) || MetadataRegistry.add(metadata)
    },
    setConfiguration: (path, configuration) => {
      metadata.configuration = set(
        metadata.getConfiguration(),
        path,
        configuration
      )
      return MetadataRegistry.update(metadata) || MetadataRegistry.add(metadata)
    },
    remove: () => MetadataRegistry.remove(metadata)
  }
}

function get_helper_item(of, type, name) {
  try {
    const meta = metadata(of).getConfiguration(['helper-items', type, name])
    if (meta) {
      return items.getItem(meta)
    }
  } catch {
    return undefined
  }
}

export function get_item_of_helper_item(helperItem) {
  try {
    const meta = metadata(helperItem).getConfiguration('helper-item-of')
    if (meta) {
      return items.getItem(meta)
    }
  } catch {
    return undefined
  }
}

export function create_helper_item(
  of,
  type,
  name,
  item_type,
  category,
  label,
  groups = [],
  tags = []
) {
  const helperItem = get_helper_item(of, type, name)
  if (!helperItem) {
    tags.push(HELPER_ITEM_TAG)
    helperItem = items.addItem(
      'Core_HelperItem{0}_Of_{1}'.format(
        Math.floor(Math.random() * 1000000000),
        of.name
      ),
      item_type,
      category,
      groups,
      label,
      tags
    )

    metadata(helperItem).setConfiguration('helper-item-of', of.name)

    metadata(of).setConfiguration(
      ['helper-items', namespace, name],
      helperItem.name
    )
  }

  return helperItem
}

export function remove_unlinked_helper_items() {
  for (const helper of items.getItemsByTag(HELPER_ITEM_TAG)) {
    of = metadata(helper).getConfiguration('helper-item-of')

    if (!of) {
      console.log(
        'remove_unlinked_helper_items',
        'Remove invalid helper item {}: There is no targeted item set in metadata.'.format(
          helper.name
        )
      )

      items.removeItem(helper.name)
      continue
    }

    try {
      items.getItem(of)
    } catch {
      console.log(
        'remove_unlinked_helper_items',
        'Remove invalid helper item {}: The targeted item {} does not exist.'.format(
          helper.name,
          of
        )
      )
      items.removeItem(helper.name)
    }
  }
}

export function remove_invalid_helper_items() {
  for (const item of items.getItems()) {
    const meta = metadata(item)
    for (const type in meta.getConfiguration('helper-items')) {
      const itemNames = meta[type]
      for (const name in itemNames) {
        try {
          items.getItem(itemNames[name])
        } catch {
          console.log(
            'remove_invalid_helper_items',
            'Remove invalid metadata of item {}: {} [{}] is no valid helper item for .'.format(
              item.name,
              name,
              type
            )
          )
          meta.setConfiguration(['helper-items', namespace, name], undefined)
        }
      }
    }
  }
}

export function get_semantic_items(rootItem, equipmentTags, pointTags) {
  const equipments = equipmentTags
    ? get_childs_with_condition(rootItem, (item) => {
        for (const equipmentTag of equipmentTags) {
          if (Array.isArray(equipmentTag)) {
            matchedTags = intersection(item.getTags(), equipmentTags)
            if (equipmentTags.length == matchedTags.length) {
              return true
            }
          } else if (item.getTags().includes(equipmentTag)) {
            return true
          }
        }

        return false
      })
    : [rootItem]

  if (!pointTags) {
    return equipments
  }

  const points = equipments.reduce((pointsList, newEquipment) => {
    const newPoints = get_childs_with_condition(newEquipment, (item) => {
      for (const pointTag of pointTags) {
        if (Array.isArray(pointTag)) {
          matchedTags = intersection(item.getTags(), pointTags)
          if (pointTags.length == matchedTags.length) {
            return true
          }
        } else if (item.getTags().includes(pointTag)) {
          return true
        }
      }

      return false
    })
    return pointsList.concat(newPoints)
  }, [])

  return uniqBy(points, (item) => item.name)
}

export function get_all_semantic_items(equipmentTags, pointTags) {
  const points = get_items_of_any_tags(equipmentTags).reduce(
    (pointsList, newEquipment) => {
      const newPoints = get_semantic_items(newEquipment, undefined, pointTags)
      return pointsList.concat(newPoints)
    },
    []
  )

  return uniqBy(points, (item) => item.name)
}

export function get_parents_with_condition(item, condition = (item) => true) {
  if (typeof item == 'string') {
    item = items.getItem(item)
  }

  if (condition(item)) {
    return [item]
  }

  if (!item.getGroupNames()) {
    return []
  }

  const groupMembers = item.getGroupNames().reduce((memberList, newMember) => {
    const newMembers = get_parents_with_condition(newMember, condition)
    return memberList.concat(newMembers)
  }, [])

  return uniqBy(groupMembers, (item) => item.name)
}

export function get_childs_with_condition(item, condition = (item) => true) {
  if (typeof item == 'string') {
    item = items.getItem(item)
  }

  if (condition(item)) {
    return [item]
  }

  if (item.getType() != 'Group') {
    return []
  }

  const groupMembers = item.members.reduce((memberList, newMember) => {
    const newMembers = get_childs_with_condition(newMember, condition)
    return memberList.concat(newMembers)
  }, [])

  return uniqBy(groupMembers, (item) => item.name)
}
