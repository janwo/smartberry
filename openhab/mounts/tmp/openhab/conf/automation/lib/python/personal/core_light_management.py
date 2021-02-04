from personal.core_helpers import enum
from core.jsr223.scope import events, OFF, ON, ir
from org.openhab.core.model.script.actions import Log
from personal.core_special_state_management import SpecialState, is_special_state
from org.openhab.core.types import UnDefType, OnOffType

LightMode = enum(
    OFF=0,
    ON=1,
    UNCHANGED=6,
    AUTO_ON=2,
    ON_AWAY_AND_SPECIAL_STATE_DEFAULT=3,
    ON_HOME_AND_SPECIAL_STATE_DEFAULT=4,
    ON_SPECIAL_STATE_DEFAULT=5
)

AmbientLightCondition = enum(
    DARK=0,
    OBSCURED=1,
    BRIGHT=2
)


def get_light_mode_group():
    condition = ir.getItem("LightManagement_AmbientLightCondition").state
    return {
        AmbientLightCondition.DARK: ir.getItem("gLightManagement_DarkMode"),
        AmbientLightCondition.OBSCURED: ir.getItem("gLightManagement_ObscuredMode"),
        AmbientLightCondition.BRIGHT: ir.getItem("gLightManagement_BrightMode")
    }.get(
        AmbientLightCondition.BRIGHT if isinstance(
            condition, UnDefType) else condition.intValue(),
        ir.getItem("gLightManagement_BrightMode")
    )


def isIgnored(switchable):
    if is_special_state(SpecialState.SLEEP) and 'gLightManagement_LightSwitchable_IgnoreWhenSleep' in switchable.groupNames:
        Log.logInfo(
            "{} was ignored during sleep state due to gLightManagement_LightSwitchable_IgnoreWhenSleep group.".format(
                switchable.name)
        )
        return True
    return False


def turnOn(switchable, force=False):
    if isIgnored(switchable):
        return

    if "gLight" in switchable.getGroupNames():
        if switchable.getStateAs(OnOffType) != ON or force:
            command = ir.getItem("LightManagement_DefaultBrightness").state if is_special_state(SpecialState.DEFAULT) else ir.getItem(
                "LightManagement_SleepBrightness").state
            events.sendCommand(switchable, command)
        else:
            events.postUpdate(switchable, switchable.state)

    elif "gPower" in switchable.getGroupNames():
        if switchable.getStateAs(OnOffType) != ON or force:
            events.sendCommand(switchable, ON)
        else:
            events.postUpdate(switchable, switchable.state)

    else:
        Log.logWarn(
            "{} has no suitable group to fullfill requirements of a member of gLightManagement_LightSwitchable".format(
                switchable.name)
        )


def turnOff(switchable, force=False):
    if force:
        events.sendCommand(switchable, OFF)
    elif switchable.getStateAs(OnOffType) != OFF:
        events.sendCommand(switchable, OFF)
