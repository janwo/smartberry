from personal.core_helpers import intersection_count, get_date, enum, get_location, METADATA_NAMESPACE, get_items_of_any_tags
from core.jsr223.scope import events, OFF, ON, ir
from org.openhab.core.model.script.actions import Log
from org.openhab.core.types import UnDefType
from org.openhab.core.library.types import OnOffType
from core.metadata import get_key_value, set_key_value
from core.date import hours_between, ZonedDateTime, format_date
from personal.core_broadcast import BroadcastType, broadcast

LightMode = enum(
    OFF=0.0,
    ON=1.0,
    AUTO_ON=2.0,
    UNCHANGED=3.0,
    SIMULATE=4.0
)

AmbientLightCondition = enum(
    DARK=0.0,
    OBSCURED=1.0,
    BRIGHT=2.0
)

EQUIPMENT_TAGS = [
    "Lightbulb",
    "PowerOutlet",
    "WallSwitch"
]

POINT_TAGS = [
    "Switch"
]


def get_light_mode_group():
    condition = ir.getItem("Core_Lights_AmbientLightCondition").state
    return {
        AmbientLightCondition.DARK: ir.getItem("gCore_Lights_DarkMode"),
        AmbientLightCondition.OBSCURED: ir.getItem("gCore_Lights_ObscuredMode"),
        AmbientLightCondition.BRIGHT: ir.getItem("gCore_Lights_BrightMode")
    }.get(
        AmbientLightCondition.BRIGHT if isinstance(
            condition, UnDefType) else condition.floatValue(),
        ir.getItem("gCore_Lights_BrightMode")
    )


def set_location_as_activated(switchable):
    location = get_location(switchable)
    if location != None:
        set_key_value(
            location.name,
            METADATA_NAMESPACE,
            "light",
            "last-activation",
            format_date(ZonedDateTime.now())
        )


def is_elapsed(item):
    location = get_location(item)

    lastActivation = None if not location else get_key_value(
        location.name,
        METADATA_NAMESPACE,
        'light',
        "last-activation"
    )
    if lastActivation:
        durationItem = ir.getItem("Core_Lights_DefaultDuration")
        if isinstance(durationItem.state, UnDefType):
            text = "No value for {} is set.".format(durationItem.name)
            broadcast(text)
            return False

        return hours_between(
            get_date(lastActivation),
            ZonedDateTime.now()
        ) > durationItem.state.floatValue()

    return False


def turn_on_switchable_point(point, force=False):
    if point.getStateAs(OnOffType) != ON or force:
        events.sendCommand(point, ON)
    else:
        events.postUpdate(point, point.state)


def turn_off_switchable_point(point, force=False):
    if point.getStateAs(OnOffType) != OFF or force:
        events.sendCommand(point, OFF)
    elif point.getStateAs(OnOffType) != OFF:
        events.sendCommand(point, OFF)


def get_all_switchable_points():
    switchables = []
    for equipment in get_items_of_any_tags(EQUIPMENT_TAGS):
        switchables.extend(get_switchable_points(equipment))
    return set(switchables)


def get_switchable_points(equipment):
    if intersection_count(equipment.getTags(), EQUIPMENT_TAGS) > 0:
        return [equipment] if equipment.getType() != 'Group' else filter(
            lambda point: intersection_count(
                point.getTags(),
                POINT_TAGS
            ) > 0,
            equipment.allMembers
        )
    else:
        return []
