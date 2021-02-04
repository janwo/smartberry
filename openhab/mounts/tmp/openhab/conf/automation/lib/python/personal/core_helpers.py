from org.openhab.core.model.script.actions import Log
from core.metadata import get_key_value
from core.jsr223.scope import ir
import re  # deprecated
from random import randint
from org.openhab.core.types import UnDefType


METADATA_NAMESPACE = "core"


def enum(**enums):
    return type('Enum', (), enums)


def get_location(item):
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

    Log.logInfo("log", "{0} has location {1}".format(
        item.name,
        locationName
    ))

    return ir.getItem(locationName) if locationName else None


def has_same_location(item1, item2):
    locationItem1 = None if item1 == None else get_location(item1)
    locationItem2 = None if item2 == None else get_location(item2)
    return locationItem1 != None and locationItem2 != None and locationItem1.name == locationItem2.name


def get_random_number(length=10):
    return randint(10**(length-1), (10**length)-1)

# deprecated


def get_room_name(item_name):
    match = re.search(r"^([^_]+_[^_]+).*$", item_name)
    if match is None:
        return None
    return match.group(1)
