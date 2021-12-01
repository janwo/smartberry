from __future__ import unicode_literals
from personal.core_helpers import get_date_string, get_date, enum, get_location, METADATA_NAMESPACE
from core.jsr223.scope import events, OFF, ON, ir
from org.openhab.core.types import UnDefType
from org.openhab.core.library.types import OnOffType
from core.metadata import get_key_value, set_key_value
from core.date import minutes_between, ZonedDateTime
from personal.core_broadcast import broadcast

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

LIGHTS_EQUIPMENT_TAGS = [
    "Lightbulb",
    "PowerOutlet",
    "WallSwitch"
]

LIGHTS_POINT_TAGS = [
    "Switch"
]

LIGHT_MEASUREMENT_POINT_TAGS = [
    ['Light', 'Measurement']
]

LIGHT_MEASUREMENT_ASTRO_SUNPHASE = [
    'CoreAstroSun'
]


def get_light_mode_group():
    condition = ir.getItem("Core_Lights_AmbientLightCondition").state
    return {
        AmbientLightCondition.DARK: ir.getItem("gCore_Lights_DarkMode"),
        AmbientLightCondition.OBSCURED: ir.getItem("gCore_Lights_ObscuredMode"),
        AmbientLightCondition.BRIGHT: ir.getItem("gCore_Lights_BrightMode")
    }.get(
        AmbientLightCondition.BRIGHT if isinstance(
            condition, UnDefType) else condition.floatValue()
    )


def convert_to_light_condition(luminance):
    darkTresholdItem = ir.getItem(
        "Core_Lights_AmbientLightCondition_LuminanceTreshold_Dark")
    obscuredTresholdItem = ir.getItem(
        "Core_Lights_AmbientLightCondition_LuminanceTreshold_Obscured")
    if luminance < darkTresholdItem.state:
        return AmbientLightCondition.DARK
    if luminance < obscuredTresholdItem.state:
        return AmbientLightCondition.OBSCURED
    return AmbientLightCondition.BRIGHT


def get_astro_light_condition():
    for astroItem in ir.getItemsByTag(LIGHT_MEASUREMENT_ASTRO_SUNPHASE):          
        if astroItem.state.toFullString() == 'NIGHT': 
            return AmbientLightCondition.DARK
        elif astroItem.state.toFullString() == 'DAYLIGHT':
            return AmbientLightCondition.BRIGHT
        return AmbientLightCondition.OBSCURED
    return None


def get_light_condition():
    conditionItem = ir.getItem("Core_Lights_AmbientLightCondition")
    if not isinstance(conditionItem.state, UnDefType):
        return conditionItem.state.floatValue()
    return AmbientLightCondition.BRIGHT


def set_light_condition(condition, luminance=None):
    conditionItem = ir.getItem("Core_Lights_AmbientLightCondition")
    if (
        isinstance(conditionItem.state, UnDefType) or
        conditionItem.state.floatValue() != condition
    ):
        events.postUpdate(conditionItem, condition)
    
    if luminance is not None:
        set_key_value(
            conditionItem.name,
            METADATA_NAMESPACE,
            'lights',
            'luminance',
            luminance
        )


def get_darkest_light_condition(conditions):
    orderedConditions = [AmbientLightCondition.DARK, AmbientLightCondition.OBSCURED, AmbientLightCondition.BRIGHT]
    for condition in orderedConditions: 
        if condition in conditions:
            return condition


def set_location_as_activated(switchable):
    location = get_location(switchable)
    if location:
        set_key_value(
            location.name,
            METADATA_NAMESPACE,
            'lights',
            "last-activation",
            get_date_string(ZonedDateTime.now())
        )


def is_elapsed(item):
    location = get_location(item)
    if location:
        lastActivation = get_key_value(
            location.name,
            METADATA_NAMESPACE,
            'lights',
            "last-activation"
        )
        if lastActivation:
            durationItem = ir.getItem("Core_Lights_DefaultDuration")
            if isinstance(durationItem.state, UnDefType):
                broadcast("No value for {} is set.".format(durationItem.name))
                return False

            return minutes_between(
                get_date(lastActivation),
                ZonedDateTime.now()
            ) > durationItem.state.floatValue()

    return False


def turn_on_switchable_point(point, force=False):
    if point.getStateAs(OnOffType) != ON or force:
        events.sendCommand(point, ON)
        events.postUpdate(point, ON)
    else:
        events.postUpdate(point, point.state)


def turn_off_switchable_point(point, force=False):
    if point.getStateAs(OnOffType) != OFF or force:
        events.sendCommand(point, OFF)
        events.postUpdate(point, OFF)
    else:
        events.postUpdate(point, point.state)
