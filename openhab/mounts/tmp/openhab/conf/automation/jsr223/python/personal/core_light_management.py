from core.log import logging
from core.triggers import when
from core.rules import rule
from core.date import minutes_between, ZonedDateTime, format_date
from personal.core_presence_management import PresenceState
from personal.core_special_state_management import SpecialState
from personal.core_helpers import enum, get_room_name
from personal.core_light_management import LightMode, AmbientLightCondition, get_light_mode_group, turnOn, turnOff


@rule("Keep last light activation updated", description="Keep last light activation updated", tags=[])
@when("Member of gLightManagement_LightSwitchable received update")
def set_last_activation(event):
    if event.itemState == 0 or event.itemState == OFF:
        return

    room = get_room_name(event.itemName)
    activations = ir.getItem("gLightManagement_LastActivation").members
    activation = next(
        (activation for activation in activations if activation.name.startswith(room)), None)

    if activation != None:
        events.sendCommand(activation, format_date(ZonedDateTime.now()))
    else:
        set_last_activation.log.warn(
            "gLightManagement_LastActivation not found for room {}.".format(
                room)
        )


@rule("Manage daylight status changes.", description="Manage daylight status changes.", tags=[])
@when("Member of gSensor_Luminance changed")
@when("Item LightManagement_AmbientLightCondition_LuminanceTreshold_Dark changed")
@when("Item LightManagement_AmbientLightCondition_LuminanceTreshold_Obscured changed")
def check_daylight(event):
    activeSwitchables = filter(
        lambda switchable: not isinstance(switchable.state, UnDefType) and (
            switchable.state > 0 or switchable.state == ON),
        ir.getItem("gLightManagement_LightSwitchable").members
    )
    activeRooms = map(
        lambda switchable: get_room_name(switchable.name),
        activeSwitchables
    )

    sensorsOfInactiveRooms = sorted(
        filter(
            lambda sensor: not isinstance(sensor.state, UnDefType) and any(
                activeRoom == get_room_name(sensor.name) for activeRoom in activeRooms
            ) is None,
            ir.getItem("gSensor_Luminance").members
        ),
        key=lambda sensor: sensor.state
    )

    median = sensorsOfInactiveRooms.get(
        len(sensorsOfInactiveRooms) / 2).state
    darkTreshold = ir.getItem(
        "LightManagement_AmbientLightCondition_LuminanceTreshold_Dark").state
    obscuredTreshold = ir.getItem(
        "LightManagement_AmbientLightCondition_LuminanceTreshold_Obscured").state

    mode = LightMode.BRIGHT
    if not isinstance(median, UnDefType):
        events.postUpdate(ir.getItem(
            "LightManagement_AmbientLightCondition_LuminanceTreshold"), median)
        if median < darkTreshold:
            mode = LightMode.DARK
        elif median < obscuredTreshold:
            mode = LightMode.OBSCURED

    if ir.getItem("LightManagement_AmbientLightCondition").state != mode:
        events.postUpdate(ir.getItem(
            "LightManagement_AmbientLightCondition"), mode)


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
    lightModeGroup = get_light_mode_group()
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
            lightModeGroup.members
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
            lightModeGroup.members
        )
    )

    for switchable in ir.getItem("gLightManagement_LightSwitchable").members:
        room = get_room_name(switchable.name)
        if any(r == room for r in switchOnRooms):
            turnOn(switchable, "SpecialStateManagement" == event.itemName)

        if any(r == room for r in switchOffRooms):
            turnOff(switchable, "SpecialStateManagement" == event.itemName)


@rule("Manage lights on presence.", description="Manage lights on presence.", tags=[])
@when("Member of gPresenceManagement_LastPresence received update")
def manage_presence(event):
    room = get_room_name(event.itemName)
    lightModeGroup = get_light_mode_group()

    if any((
            mode.name.startswith(room) and
            mode.state == LightMode.AUTO_ON
        ) for mode in lightModeGroup.members
    ):
        # Trigger scene instead of lights, if scene is present in room.
        scenes = filter(
            lambda scene: scene.name.startswith(room),
            ir.getItem("gSpecialStateManagement_Scenes").members
        )

        if len(scenes) > 0:
            events.postUpdate(scenes.get(0), scenes.get(0).state)
            return

        for switchable in ir.getItem("gLightManagement_LightSwitchable").members:
            if switchable.name.startswith(room):
                turnOn(switchable)


@rule("Manage lights when come back home.", description="Manage lights when come back home.", tags=[])
@when("Item PresenceManagement changed to {}".format(PresenceState.HOME))
def welcome_light(event):
    condition = ir.getItem("LightManagement_AmbientLightCondition")
    welcomeLightModeMapping = {
        AmbientLightCondition.DARK: ir.getItem("LightManagement_WelcomeLight_DarkMode"),
        AmbientLightCondition.OBSCURED: ir.getItem("LightManagement_WelcomeLight_ObscuredMode"),
        AmbientLightCondition.BRIGHT: ir.getItem(
            "LightManagement_WelcomeLight_BrightMode")
    }
    welcomeLightMode = welcomeLightModeMapping.get(
        AmbientLightCondition.BRIGHT if isinstance(
            condition, UnDefType) else condition.state,
        ir.getItem("LightManagement_WelcomeLight_BrightMode")
    )

    if welcomeLightMode.state == ON:
        lightModeGroup = get_light_mode_group()
        switchOnRooms = map(
            lambda mode: get_room_name(mode.name),
            filter(
                lambda mode: mode.state == LightMode.AUTO_ON,
                lightModeGroup.members
            )
        )

    for switchable in ir.getItem("gLightManagement_LightSwitchable").members:
        room = get_room_name(switchable.name)
        if any(r == room for r in switchOnRooms):
            turnOn(switchable)


@rule("Manage elapsed lights.", description="Manage elapsed lights.", tags=[])
@when("Time cron 0 * * ? * * *")
@when("Item SpecialStateManagement received update")
@when("Item LightManagement_DefaultDuration received update")
@when("Item LightManagement_SleepDuration received update")
def elapsed_lights(event):
    duration = ir.getItem("LightManagement_DefaultDuration").state if ir.getItem(
        "SpecialStateManagement").state == SpecialState.DEFAULT else ir.getItem("LightManagement_SleepDuration").state

    lightModeGroup = get_light_mode_group()

    elapsedRooms = map(
        lambda mode: get_room_name(mode.name),
        filter(
            lambda activation: (
                isinstance(activation.state, UnDefType) or
                minutes_between(
                    activation.state, ZonedDateTime.now()
                ) > duration
            ),
            ir.getItem("gLightManagement_LastActivation").members
        )
    )

    switchOffRooms = filter(
        lambda room: any(elapsedRoom == room for elapsedRoom in elapsedRooms),
        map(
            lambda mode: get_room_name(mode.name),
            filter(
                lambda mode: mode.state == LightMode.AUTO_ON,
                lightModeGroup.members
            )
        )
    )

    for switchable in ir.getItem("gLightManagement_LightSwitchable").members:
        if ((switchable.state == ON or switchable.state != 0) and
                any(room == get_room_name(switchable.name) for room in switchOffRooms)):
            events.sendCommand(switchable, OFF)
