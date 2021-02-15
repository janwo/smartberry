from core.triggers import when
from core.rules import rule
from core.date import minutes_between, ZonedDateTime, format_date
from personal.core_presence import PresenceState
from personal.core_scenes import trigger_scene, get_scene_items
from personal.core_helpers import METADATA_NAMESPACE, get_location, has_same_location, get_item_of_helper_item, get_items_of_any_tags, sync_group_with_tags
from personal.core_lights import SWITCHABLE_TAGS, set_location_as_activated, is_elapsed, LightMode, AmbientLightCondition, get_light_mode_group, turnOn, turnOff, get_switchables
from personal.core_broadcast import broadcast
from core.jsr223.scope import ir, events, OFF, ON
from org.openhab.core.types import UnDefType
from org.openhab.core.library.types import OnOffType
from core.metadata import set_key_value, get_key_value
from random import randint


@rule("Core - Sync helper items", description="Core - Sync helper items", tags=['core', 'lights'])
@when("Item added")
@when("Item updated")
@when("Item removed")
def sync_helper_items(event):
    # Sync group gCore_Lights_Switchables with switchable items - it's needed to create triggers on it
    members = sync_group_with_tags(
        ir.getItem("gCore_Lights_Switchables"),
        SWITCHABLE_TAGS
    )


@rule("Core - Keep last light activation updated", description="Keep last light activation updated", tags=["core", 'lights'])
@when("Member of gCore_Lights_Switchables received update ON")
def set_last_activation(event):
    item = ir.getItem(event.itemName)
    set_location_as_activated(item)


@rule("Core - Manage daylight status changes.", description="Manage daylight status changes.", tags=["core", 'lights'])
@when("Time cron 0 0/5 * ? * * *")
@when("Item Core_Lights_AmbientLightCondition_LuminanceTreshold_Dark changed")
@when("Item Core_Lights_AmbientLightCondition_LuminanceTreshold_Obscured changed")
def check_daylight(event):
    activeSwitchables = filter(
        lambda switchable: switchable.getStateAs(OnOffType) == ON,
        get_switchables()
    )

    activeRoomNames = map(
        lambda r: r.name,
        filter(
            lambda r: r,
            map(
                lambda switchable: get_location(switchable),
                activeSwitchables
            )
        )
    )

    def isNotActiveRoom(location):
        return location and location.name not in activeRoomNames

    sensorsOfInactiveRooms = sorted(
        filter(
            lambda sensor: not isinstance(
                sensor.state,
                UnDefType
            ) and isNotActiveRoom(get_location(sensor)),
            get_switchables()
        ),
        key=lambda sensor: sensor.state
    )

    darkTresholdItem = ir.getItem(
        "Core_Lights_AmbientLightCondition_LuminanceTreshold_Dark")
    obscuredTresholdItem = ir.getItem(
        "Core_Lights_AmbientLightCondition_LuminanceTreshold_Obscured")

    if len(sensorsOfInactiveRooms) == 0:
        return

    medianSensorItem = sensorsOfInactiveRooms[len(sensorsOfInactiveRooms) / 2]

    if isinstance(medianSensorItem.state, UnDefType):
        return

    conditionItemName = "Core_Lights_AmbientLightCondition"
    set_key_value(
        conditionItemName,
        METADATA_NAMESPACE,
        'lights',
        'luminance',
        medianSensorItem.state
    )

    condition = AmbientLightCondition.BRIGHT
    if medianSensorItem.state < darkTresholdItem.state:
        condition = AmbientLightCondition.DARK
    elif medianSensorItem.state < obscuredTresholdItem.state:
        condition = AmbientLightCondition.OBSCURED

    conditionItem = ir.getItem(conditionItemName)
    if conditionItem.state != condition:
        events.postUpdate(conditionItem, condition)


@rule("Core - Manage lights according to respective modes among special states, nighttime and daytime.", description="Manage lights according to respective modes among special states, nighttime and daytime.", tags=['core', 'lights'])
@when("Member of gCore_Lights_DarkMode received update")
@when("Member of gCore_Lights_BrightMode received update")
@when("Member of gCore_Lights_ObscuredMode received update")
@when("Item Core_Lights_AmbientLightCondition received update")
@when("Item Core_Presence received update")
def manage_light_state(event):
    lightModeGroup = get_light_mode_group()
    switchOnRoomNames = map(
        lambda r: r.name,
        filter(
            lambda r: r,
            map(
                lambda groupMember: get_location(groupMember),
                filter(
                    lambda groupMember: (
                        not isinstance(groupMember.state, UnDefType) and
                        groupMember.state.floatValue() in [
                            LightMode.ON
                        ]
                    ),
                    lightModeGroup.members
                )
            )
        )
    )

    switchOffRoomNames = map(
        lambda r: r.name,
        filter(
            lambda r: r,
            map(
                lambda groupMember: get_location(groupMember),
                filter(
                    lambda groupMember: (
                        not isinstance(groupMember.state, UnDefType) and
                        groupMember.state.floatValue() in [
                            LightMode.OFF
                        ]
                    ),
                    lightModeGroup.members
                )
            )
        )
    )

    for switchable in get_switchables():
        location = get_location(switchable)
        if location and location.name in switchOnRoomNames:
            turnOn(switchable)
        if location and location.name in switchOffRoomNames:
            turnOff(switchable)


@rule("Core - Manage lights on presence.", description="Manage lights on presence.", tags=['core', 'lights'])
@when("Member of gCore_Presence_PresenceTrigger received update ON")
def manage_presence(event):
    location = get_location(event.itemName)
    lightModeGroup = get_light_mode_group()

    for member in lightModeGroup.members:
        if (
            isinstance(member.state, UnDefType) and
            member.state.floatValue() in [
                LightMode.AUTO_ON
            ] and
            has_same_location(member, location)
        ):

            scene = next((scene for scene in ir.getItem(
                'gCore_Scenes').members if has_same_location(scene, location)), None)
            if scene:
                trigger_scene(
                    scene=scene,
                    scene_state=None,
                    poke_only=len(
                        filter(
                            lambda item: (
                                not isinstance(item.state, UnDefType) and
                                set(SWITCHABLE_TAGS).intersection(set(item.getTags())) and
                                item.getStateAs(OnOffType) == ON
                            ),
                            get_scene_items(scene)
                        )
                    ) > 0
                )
            else:
                for switchable in get_switchables():
                    if has_same_location(switchable, location):
                        turnOn(switchable)

            break


@rule("Core - Manage lights when come back home.", description="Manage lights when come back home.", tags=['core', 'lights'])
@when("Item Core_Presence changed to {}".format(PresenceState.HOME))
def welcome_light(event):
    condition = ir.getItem("Core_Lights_AmbientLightCondition")
    welcomeLightModeMapping = {
        AmbientLightCondition.DARK: ir.getItem("Core_Lights_WelcomeLight_DarkMode"),
        AmbientLightCondition.OBSCURED: ir.getItem("Core_Lights_WelcomeLight_ObscuredMode"),
        AmbientLightCondition.BRIGHT: ir.getItem("Core_Lights_WelcomeLight_BrightMode")
    }
    welcomeLightMode = welcomeLightModeMapping.get(
        AmbientLightCondition.BRIGHT if isinstance(
            condition, UnDefType) else condition.state.floatValue(),
        ir.getItem("Core_Lights_WelcomeLight_BrightMode")
    )

    if welcomeLightMode.state == ON:
        lightModeGroup = get_light_mode_group()
        switchOnRoomNames = map(
            lambda r: r.name,
            filter(
                lambda r: r,
                map(
                    lambda mode: get_location(mode),
                    filter(
                        lambda mode: isinstance(
                            mode.state,
                            UnDefType
                        ) and mode.state.floatValue() == LightMode.AUTO_ON,
                        lightModeGroup.members
                    )
                )
            )
        )

        for switchable in get_switchables():
            location = get_location(switchable)
            if location and location.name in switchOnRoomNames:
                turnOn(switchable)


@rule("Core - Manage elapsed lights.", description="Manage elapsed lights.", tags=['core', 'lights'])
@when("Time cron 0 * * ? * * *")
@when("Item Core_Lights_DefaultDuration received update")
def elapsed_lights(event):
    lightModeGroup = get_light_mode_group()
    switchOffRoomNames = map(
        lambda r: r.name,
        filter(
            lambda r: r and is_elapsed(r),
            set(map(
                lambda mode: get_location(mode),
                filter(
                    lambda mode: not isinstance(
                        mode.state,
                        UnDefType
                    ) and mode.state.floatValue() == LightMode.AUTO_ON,
                    lightModeGroup.members
                )
            ))
        ))

    for switchable in get_switchables():
        if switchable.getStateAs(OnOffType) == ON:
            location = get_location(switchable)
            if location and location.name in switchOffRoomNames:
                turnOff(switchable)


@rule("Core - Simulate lights.", description="Simulate lights.", tags=['core', 'lights'])
@when("Time cron 0 0/5 0 ? * * *")
def simulate_presence(event):
    lightModeGroup = get_light_mode_group()
    simulateLocations = set(map(
        lambda mode: get_location(mode),
        filter(
            lambda mode: not isinstance(
                mode.state,
                UnDefType
            ) and mode.state.floatValue() == LightMode.SIMULATE,
            lightModeGroup.members
        )
    ))

    for switchable in get_switchables():
        location = get_location(switchable)
        if location and location.name in simulateLocations and randint(0, 10) <= 2:
            if switchable.getStateAs(OnOffType) == ON:
                turnOff(switchable)
            else:
                turnOn(switchable)
