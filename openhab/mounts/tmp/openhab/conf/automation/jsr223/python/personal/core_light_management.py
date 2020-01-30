from core.log import logging
from core.triggers import when
from core.rules import rule
from datetime import datetime, timedelta
from personal.core_presence_management import PresenceState
from personal.core_special_state_management import SpecialState
from personal.core_helpers import enum, get_room_name

LightMode = enum(
    OFF=0,
    ON=1,
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


def get_light_mode():
    return {
        0: ir.getItem("gLightManagement_DarkMode"),
        1: ir.getItem("gLightManagement_ObscuredMode"),
        2: ir.getItem("gLightManagement_BrightMode")
    }.get(
        ir.getItem("LightManagement_AmbientLightCondition").state.intValue(),
        ir.getItem("gLightManagement_BrightMode")
    ).state


def turnOn(switchable, force=False):
    if ir.getItem("SpecialStateManagement").state == SpecialState.SLEEP and 'gLightManagement_LightSwitchable_IgnoreWhenSleep' in switchable.getGroupNames():
        logging.info(
            switchable.name + " was ignored during sleep state due to gLightManagement_LightSwitchable_IgnoreWhenSleep group."
        )
        return

    if "gLight" in switchable.getGroupNames():
        if(switchable.state != 0 or force):
            command = ir.getItem("LightManagement_DefaultBrightness").state.intValue(
            ) if ir.getItem("SpecialStateManagement").state == SpecialState.DEFAULT else ir.getItem("LightManagement_SleepBrightness").state.intValue()
            events.sendCommand(switchable.name, command)

    elif "gPower" in switchable.getGroupNames():
        if(switchable.state != OFF or force):
            events.sendCommand(switchable.name, command)

    else:
        logging.warn(
            switchable.name + " has no suitable group to fullfill requirements of a member of gLightManagement_LightSwitchable"
        )


def turnOff(switchable, force=False):
    if force:
        events.sendCommand(switchable.name, OFF)
    elif switchable.state != OFF:
        events.sendCommand(switchable.name, OFF)


@rule("Keep last light activation updated", description="Keep last light activation updated", tags=[])
@when("Member of gLightManagement_LightSwitchable received update")
def set_last_activation(event):
    if event.triggeringItem.state == 0 or event.triggeringItem.state == OFF:
        return

    room = get_room_name(event.triggeringItem.name)
    activations = ir.getItem("gLightManagement_LastActivation").members
    activation = next(
        (activation for activation in activations if activation.name.startsWith(room)), None)

    if activation != None:
        events.sendCommand(activation.name, datetime.now())
    else:
        set_last_activation.log.warn(
            "light-management.rules",
            "gLightManagement_LastActivation not found for room " + room
        )


@rule("Manage daylight status changes.", description="Manage daylight status changes.", tags=[])
@when("Member of gSensor_Luminance changed")
@when("Item LightManagement_AmbientLightCondition_LuminanceTreshold_Dark changed")
@when("Item LightManagement_AmbientLightCondition_LuminanceTreshold_Obscured changed")
def check_daylight(event):
    activeSwitchables = filter(
        lambda switchable: switchable.state != None and (
            switchable.state > 0 or switchable.state == ON),
        ir.getItem("gLightManagement_LightSwitchable").members
    )
    activeRooms = map(
        lambda switchable: get_room_name(switchable.name),
        activeSwitchables
    )

    sensorsOfInactiveRooms = sorted(
        filter(
            lambda sensor: sensor.state != None and any(
                lambda activeRoom: activeRoom == get_room_name(sensor.name),
                activeRooms
            ) is None,
            ir.getItem("gSensor_Luminance").members
        ),
        key=lambda sensor: sensor.state
    )

    median = sensorsOfInactiveRooms.get(
        len(sensorsOfInactiveRooms) / 2).state.intValue()
    darkTreshold = ir.getItem(
        "LightManagement_AmbientLightCondition_LuminanceTreshold_Dark").state.intValue()
    obscuredTreshold = ir.getItem(
        "LightManagement_AmbientLightCondition_LuminanceTreshold_Obscured").state.intValue()

    mode = LightMode.BRIGHT
    if median < darkTreshold:
        mode = LightMode.DARK
    elif median < obscuredTreshold:
        mode = LightMode.OBSCURED

    events.postUpdate(
        "LightManagement_AmbientLightCondition_LuminanceTreshold", median)
    if ir.getItem("LightManagement_AmbientLightCondition").state != mode:
        events.postUpdate("LightManagement_AmbientLightCondition", mode)


@rule("Manage lights according to respective modes among special states, nighttime and daytime.", description="Manage lights according to respective modes among special states, nighttime and daytime.", tags=[])
@when("Member of gLightManagement_DarkMode received update")
@when("Member of gLightManagement_BrightMode received update")
@when("Member of gLightManagement_ObscuredMode received update")
@when("Item LightManagement_AmbientLightCondition received update")
@when("Item SpecialStateManagement received update")
@when("Item PresenceManagement received update")
@when("Item LightManagement_DefaultBrightness received update")
@when("Item LightManagement_SleepBrightness received update")
def manage_light_state(event):
    mode = get_light_mode()
    switchOnRooms = map(
        lambda switchable: get_room_name(switchable.name),
        filter(
            lambda switchable: (
                switchable.state == LightMode.ON or (
                    switchable.state == LightMode.ON_HOME_AND_SPECIAL_STATE_DEFAULT and
                    ir.getItem("SpecialStateManagement").state == SpecialState.DEFAULT and
                    ir.getItem(
                        "PresenceManagement").state == PresenceState.HOME
                ) or (
                    switchable.state == LightMode.ON_AWAY_AND_SPECIAL_STATE_DEFAULT and
                    ir.getItem("SpecialStateManagement").state == SpecialState.DEFAULT and
                    ir.getItem(
                        "PresenceManagement").state != PresenceState.HOME
                ) or (
                    switchable.state == LightMode.ON_SPECIAL_STATE_DEFAULT and
                    ir.getItem(
                        "SpecialStateManagement").state == SpecialState.DEFAULT
                )
                # TODO: Wenn abwesend im Standardmodus => AN
            ),
            mode.members
        )
    )

    switchOffRooms = map(
        lambda switchable: get_room_name(switchable.name),
        filter(
            lambda switchable: (
                switchable.state == LightMode.OFF or (
                    switchable.state == LightMode.ON_HOME_AND_SPECIAL_STATE_DEFAULT and (
                        ir.getItem("SpecialStateManagement").state != SpecialState.DEFAULT or
                        ir.getItem(
                            "PresenceManagement").state != PresenceState.HOME
                    )
                ) or (
                    switchable.state == LightMode.ON_AWAY_AND_SPECIAL_STATE_DEFAULT and (
                        ir.getItem("SpecialStateManagement").state != SpecialState.DEFAULT or
                        ir.getItem(
                            "PresenceManagement").state == PresenceState.HOME
                    )
                ) or (
                    switchable.state == LightMode.ON_SPECIAL_STATE_DEFAULT and
                    ir.getItem(
                        "SpecialStateManagement").state != SpecialState.DEFAULT
                )
            ),
            mode.members
        )
    )

    for switchable in ir.getItem("gLightManagement_LightSwitchable").members:
        room = get_room_name(switchable.name)
        if any(
            lambda r: r == room,
            switchOnRooms
        ):
            turnOn(switchable, "SpecialStateManagement" ==
                   event.triggeringItem.name)

        if any(
            lambda r: r == room,
            switchOffRooms
        ):
            turnOff(switchable, "SpecialStateManagement" ==
                    event.triggeringItem.name)


@rule("Manage lights on presence.", description="Manage lights on presence.", tags=[])
@when("Member of gPresenceManagement_LastPresence received update")
def manage_presence(event):
    room = get_room_name(event.triggeringItem.name)
    mode = get_light_mode()

    if any(
        lambda mode: (
            mode.name.startsWith(room) and
            mode.state == LightMode.AUTO_ON
        ),
        mode.members
    ):
        # Trigger scene instead of lights, if scene is present in room.
        scenes = filter(
            lambda scene: scene.name.startsWith(room),
            ir.getItem("gSpecialStateManagement_Scenes").members
        )

        if len(scenes) > 0:
            events.postUpdate(scenes.get(0).name,
                              scenes.get(0).state.intValue())
            return

        for switchable in ir.getItem("gLightManagement_LightSwitchable").members:
            if switchable.name.startsWith(room):
                turnOn(switchable)


@rule("Manage lights when come back home.", description="Manage lights when come back home.", tags=[])
@when("Item PresenceManagement changed to " + PresenceState.HOME)
def welcome_light(event):
    welcomeLightModeMapping = {
        0: ir.getItem("LightManagement_WelcomeLight_DarkMode"),
        1: ir.getItem("LightManagement_WelcomeLight_ObscuredMode"),
        2: ir.getItem("LightManagement_WelcomeLight_BrightMode")
    }
    welcomeLightMode = welcomeLightModeMapping.get(
        ir.getItem("LightManagement_AmbientLightCondition").state.intValue(),
        ir.getItem("LightManagement_WelcomeLight_BrightMode")
    )

    if welcomeLightMode.state == ON:
        mode = get_light_mode()
        switchOnRooms = map(
            lambda mode: get_room_name(mode.name),
            filter(
                lambda mode: mode.state == LightMode.AUTO_ON,
                mode.members
            )
        )

        for switchable in ir.getItem("gLightManagement_LightSwitchable").members:
            room = get_room_name(switchable.name)
            if any(lambda r: r == room, switchOnRooms):
                turnOn(switchable)


@rule("Manage elapsed lights.", description="Manage elapsed lights.", tags=[])
@when("Time cron 0 * * ? * * *")
@when("Item SpecialStateManagement received update")
@when("Item LightManagement_DefaultDuration received update")
@when("Item LightManagement_SleepDuration received update")
def elapsed_lights(event):
    duration = ir.getItem("LightManagement_DefaultDuration").state if ir.getItem(
        "SpecialStateManagement").state == SpecialState.DEFAULT else ir.getItem("LightManagement_SleepDuration").state

    mode = get_light_mode()

    elapsedRooms = map(
        lambda mode: get_room_name(mode.name),
        filter(
            lambda activation: (activation.state == None or
                                datetime.now() - timedelta(minutes=duration.intValue()) > activation.state.intValue()
                                ),
            ir.getItem("gLightManagement_LastActivation").members
        )
    )

    switchOffRooms = filter(
        lambda room: any(
            lambda elapsedRoom: elapsedRooms == room,
            elapsedRooms
        ),
        map(
            lambda mode: get_room_name(mode.name),
            filter(
                lambda mode: mode.state == LightMode.AUTO_ON,
                mode.members
            )
        )
    )

    for switchable in ir.getItem("gLightManagement_LightSwitchable").members:
        if ((switchable.state == ON or switchable.state != 0) and
                any(lambda room: room == get_room_name(switchable.name), switchOffRooms)):
            events.sendCommand(switchable.name, OFF)
