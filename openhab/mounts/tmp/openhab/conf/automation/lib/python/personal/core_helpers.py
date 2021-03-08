from __future__ import unicode_literals
from core.jsr223.scope import ir
from core.metadata import set_key_value, get_key_value, remove_key_value, get_value
from core.items import add_item
from random import randint
from org.openhab.core.types import UnDefType
from java.time import LocalDateTime, ZonedDateTime, ZoneId
from core.date import format_date
from java.time.format import DateTimeFormatter
from org.openhab.core.model.script.actions import Log
from core.actions import Semantics

METADATA_NAMESPACE = "core"
DATE_STRING = "yyyy-MM-dd'T'HH:mm:ss.SSxx"


def enum(**enums):
    return type('Enum', (), enums)


def get_location(item):
    if isinstance(item, (str, unicode)):
        try:
            item = ir.getItem(item)
        except:
            return None

    return Semantics.getLocation(item)


def has_same_location(item1, item2):
    locationItem1 = None if item1 is None else get_location(item1)
    locationItem2 = None if item2 is None else get_location(item2)
    return locationItem1 is not None and locationItem2 is not None and locationItem1.name is locationItem2.name


def get_random_number(length=10):
    return randint(10**(length-1), (10**length)-1)


def get_items_of_any_tags(tags=[]):
    return set(reduce(lambda x, y: x + y, map(lambda tag: ir.getItemsByTag(tag),  tags)))


def sync_group_with_tags(group, tags):
    def mayRemoveFromGroup(groupMember, group, allowedTags):
        for allowedTag in allowedTags:
            if isinstance(allowedTag, list):
                matchedTags = set(allowedTag).intersection(
                    set(groupMember.getTags())
                )
                if len(allowedTag) is len(matchedTags):
                    return False
            elif allowedTag in groupMember.getTags():
                return False

        group.removeMember(groupMember)
        return True

    currentGroupMembers = filter(
        lambda member: not mayRemoveFromGroup(member, group, tags),
        group.allMembers
    )

    currentGroupMemberNames = map(
        lambda member: member.name,
        currentGroupMembers
    )

    for tagItem in get_items_of_any_tags(tags):
        if tagItem.name not in currentGroupMemberNames:
            currentGroupMembers.append(tagItem)
            group.addMember(tagItem)

    return currentGroupMembers


def get_helper_item(of, namespace, name):
    try:
        meta = get_key_value(
            of.name,
            METADATA_NAMESPACE,
            'helper-items',
            namespace,
            name
        )
        if meta:
            return ir.getItem(meta)
    except:
        return None


def get_item_of_helper_item(helperItem):
    try:
        meta = get_key_value(
            helperItem.name,
            METADATA_NAMESPACE,
            'helper-item-of'
        )
        if meta:
            return ir.getItem(meta)
    except:
        return None


def create_helper_item(of, namespace, name, item_type, category, label, groups=[], tags=[]):
    helperItem = get_helper_item(of, namespace, name)
    if not helperItem:
        tags.append('CoreHelperItem')
        helperItem = add_item(
            "Core_HelperItem{0}_Of_{1}".format(
                get_random_number(10),
                of.name
            ),
            item_type=item_type,
            category=category,
            groups=groups,
            label=label,
            tags=tags
        )

        set_key_value(
            helperItem.name,
            METADATA_NAMESPACE,
            'helper-item-of',
            of.name
        )

        set_key_value(
            of.name,
            METADATA_NAMESPACE,
            'helper-items',
            namespace,
            name,
            helperItem.name
        )
    return helperItem


def remove_unlinked_helper_items():
    for helper in ir.getItemsByTag('CoreHelperItem'):
        of = get_key_value(
            helper.name,
            METADATA_NAMESPACE,
            'helper-item-of'
        )

        if not of:
            Log.logInfo(
                "remove_unlinked_helper_items",
                "Remove invalid helper item {}: There is no targeted item set in metadata.".format(
                    helper.name
                )
            )

            ir.remove(helper.name)
            continue
        try:
            ir.getItem(of)
        except:
            Log.logInfo(
                "remove_unlinked_helper_items",
                "Remove invalid helper item {}: The targeted item {} does not exist.".format(
                    helper.name, of
                )
            )
            ir.remove(helper.name)


def remove_invalid_helper_items():
    for item in ir.getItems():
        meta = get_key_value(
            item.name,
            METADATA_NAMESPACE,
            'helper-items'
        )

        if meta and isinstance(meta, dict):
            for namespace, namespaceDictionary in meta.iteritems():
                if isinstance(namespaceDictionary, dict):
                    for name, itemName in namespaceDictionary.iteritems():
                        try:
                            ir.getItem(itemName)
                        except:
                            Log.logInfo(
                                "remove_invalid_helper_items",
                                "Remove invalid metadata of item {}: {} [{}] is no valid helper item for .".format(
                                    item.name, name, namespace
                                ))
                            remove_key_value(
                                item.name,
                                METADATA_NAMESPACE,
                                'helper-items',
                                namespace,
                                name
                            )


def get_date(dateString, format_string=DATE_STRING):
    return ZonedDateTime.parse(dateString, DateTimeFormatter.ofPattern(format_string)).withZoneSameInstant(ZoneId.systemDefault())


def get_date_string(date, format_string=DATE_STRING):
    return format_date(date, format_string)


def intersection_count(set1, set2):
    return len(set(set1).intersection(set(set2)))


def get_semantic_items(rootItem, equipmentTags, pointTags):
    equipments = get_childs_with_condition(
        rootItem,
        condition=lambda item: intersection_count(
            item.getTags(), equipmentTags
        ) > 0
    ) if equipmentTags else [rootItem]

    if not pointTags:
        return equipments

    points = reduce(
        lambda pointsList, newEquipment: pointsList +
        get_childs_with_condition(
            newEquipment,
            condition=lambda item: intersection_count(
                item.getTags(), pointTags
            ) > 0
        ),
        equipments,
        []
    )

    return unique_items(points)


def get_all_semantic_items(equipmentTags, pointTags):
    points = reduce(
        lambda pointsList, newEquipment: pointsList +
        get_semantic_items(newEquipment, None, pointTags),
        get_items_of_any_tags(equipmentTags),
        []
    )

    return unique_items(points)


def get_parents_with_condition(item, condition=lambda item: True):
    if isinstance(item, (str, unicode)):
        try:
            item = ir.getItem(item)
        except:
            return []

    if condition(item):
        return [item]

    if not item.getGroupNames():
        return []

    groupMembers = reduce(
        lambda memberList, newMember: memberList +
        get_parents_with_condition(newMember, condition),
        item.getGroupNames(),
        []
    )

    return unique_items(groupMembers)


def get_childs_with_condition(item, condition=lambda item: True):
    if isinstance(item, (str, unicode)):
        try:
            item = ir.getItem(item)
        except:
            return []

    if condition(item):
        return [item]

    if item.getType() != 'Group':
        return []

    groupMembers = reduce(
        lambda memberList, newMember: memberList +
        get_childs_with_condition(newMember, condition),
        item.members,
        []
    )

    return unique_items(groupMembers)


def unique_items(items):
    def check_duplicate(m, checkedList):
        if m.name not in checkedList:
            checkedList.append(m.name)
            return True
        return False

    checkedGroupMemberNames = []
    return filter(
        lambda m: check_duplicate(m, checkedGroupMemberNames),
        items
    )
