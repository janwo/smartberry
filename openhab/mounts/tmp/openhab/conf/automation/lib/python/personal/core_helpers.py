from org.openhab.core.model.script.actions import Log
from core.jsr223.scope import ir
from core.metadata import set_key_value, get_key_value
from core.items import add_item
from random import randint
from org.openhab.core.types import UnDefType
from java.time import LocalDateTime, ZonedDateTime
from java.time import ZoneId, ZoneOffset
from java.time.format import DateTimeFormatter

METADATA_NAMESPACE = "core"


def enum(**enums):
    return type('Enum', (), enums)


def get_location(item):
    if isinstance(item, (str, unicode)):
        item = ir.getItem(item)

    equipmentName = get_key_value(
        item.name,
        'semantics',
        'isPointOf'
    )

    locationName = get_key_value(
        equipmentName if equipmentName else item.name,
        'semantics',
        'hasLocation'
    )

    return ir.getItem(locationName) if locationName else None


def has_same_location(item1, item2):
    locationItem1 = None if item1 == None else get_location(item1)
    locationItem2 = None if item2 == None else get_location(item2)
    return locationItem1 != None and locationItem2 != None and locationItem1.name == locationItem2.name


def get_random_number(length=10):
    return randint(10**(length-1), (10**length)-1)


def get_items_of_any_tags(tags=[]):
    return set(reduce(lambda x, y: x + y, map(lambda tag: ir.getItemsByTag(tag),  tags)))


def sync_group_with_tags(group, tags):
    def mayRemoveFromGroup(groupMember, group, allowedTags):
        if len(set(allowedTags).intersection(set(groupMember.getTags()))) == 0:
            group.removeMember(groupMember)
            return True
        return False

    currentGroupMembers = filter(
        lambda member: not mayRemoveFromGroup(member, group, tags),
        group.allMembers
    )

    currentGroupMemberNames = map(
        lambda member: member.name,
        currentGroupMembers
    )

    Log.logInfo(
        "sync_group_with_tags core_helpers",
        " currentGroupMembers {}".format(currentGroupMemberNames)
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
            namespace,
            'helper-items',
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
        tags.append('HelperItem')
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
            namespace,
            'helper-items',
            name,
            helperItem.name
        )
    return helperItem


def remove_unlinked_helper_items():
    for helper in ir.getItemsByTag('HelperItem'):
        of = get_key_value(
            helper.name,
            METADATA_NAMESPACE,
            'helper-item-of'
        )

        if not of:
            ir.remove(helper.name)
        try:
            ir.getItem(of)
        except:
            ir.remove(helper.name)


def get_date(dateString, format_string="yyyy-MM-dd'T'HH:mm:ss.SSxx"):
    return LocalDateTime.parse(dateString, DateTimeFormatter.ofPattern(format_string)).atZone(ZoneId.systemDefault())


def intersection_count(set1, set2):
    return len(set(set1).intersection(set(set2)))


def get_equipment_points(equipment, equipmentTags, pointTags):
    if equipment.getType() != 'Group':
        return [equipment] if not equipmentTags or intersection_count(equipment.getTags(), equipmentTags) > 0 else []
    else:
        return filter(
            lambda point: intersection_count(
                point.getTags(),
                pointTags
            ) > 0,
            equipment.allMembers
        )


def get_all_equipment_points(equipmentTags, pointTags):
    points = []
    for equipment in get_items_of_any_tags(equipmentTags):
        points.extend(
            get_equipment_points(equipment, None, pointTags)
        )
    return set(points)


def get_parent_with_group(item, groupName):
    if isinstance(item, (str, unicode)):
        item = ir.getItem(item)
    groupNames = item.getGroupNames()
    if not groupNames:
        return None
    elif groupName in groupNames:
        return item
    else:
        for _groupName in groupNames:
            _item = get_parent_with_group(_groupName, groupName)
            if _item:
                return _item
        return None
