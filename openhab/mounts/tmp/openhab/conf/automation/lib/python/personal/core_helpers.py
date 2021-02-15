from org.openhab.core.model.script.actions import Log
from core.jsr223.scope import ir
from core.metadata import set_key_value, get_key_value
from core.items import add_item
from random import randint
from org.openhab.core.types import UnDefType


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
    return reduce(lambda x, y: x + y, map(lambda tag: ir.getItemsByTag(tag),  tags))


def sync_group_with_tags(group, tags):
    tagItems = get_items_of_any_tags(tags)

    def mayRemoveFromGroup(groupMember, tagSet, group):
        if groupMember not in tagSet:
            group.removeMember(groupMember)
            return True
        return False

    currentGroupMembers = filter(
        lambda member: not mayRemoveFromGroup(member, tagItems, group),
        group.allMembers
    )

    for tagItem in tagItems:
        if tagItem not in currentGroupMembers:
            currentGroupMembers.append(tagItem)
            group.addMember(tagItem)

    return currentGroupMembers


def get_helper_item(of, namespace, name):
    meta = get_key_value(
        of.name,
        METADATA_NAMESPACE,
        namespace,
        'helper-items',
        name
    )
    try:
        if meta:
            return ir.getItem(meta)
    except:
        return None


def get_item_of_helper_item(helperItem):
    meta = get_key_value(
        helperItem.name,
        METADATA_NAMESPACE,
        'helper-item-of'
    )
    try:
        if meta:
            return ir.getItem(meta)
    except:
        return None


def create_helper_item(of, namespace, name, item_type, category, label, groups=[], tags=[]):
    helperItem = get_helper_item(of, namespace, name)
    if not helperItem:
        tags.append('HelperItem')
        helperItem = add_item(
            "Core_HelperItem{0}_Of_{1}_As_{2}_In_{3}".format(
                get_random_number(10),
                of.name,
                name,
                namespace
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
            name
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
            ir.getItem(of.name)
        except:
            ir.remove(helper.name)
