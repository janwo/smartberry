from personal.core_helpers import get_room_name
from personal.core_special_state_management import SpecialState, is_special_state, get_scene_item_states, save_scene_item_states, update_scene_members
from core.triggers import when
from core.rules import rule
from core.date import hours_between, ZonedDateTime, format_date
import re
from personal.core_broadcast import broadcast


@rule("Core - Set last activation if SpecialStateManagement changes.", description="Set last activation if SpecialStateManagement changes.", tags=[])
@when("Item SpecialStateManagement received update")
def set_last_activation(event):
    events.postUpdate(ir.getItem(
        "SpecialStateManagement_LastActivation"), format_date(ZonedDateTime.now()))


@rule("Core - Turn off light if SpecialStateManagement was set to sleep.", description="Turn off light if SpecialStateManagement was set to sleep.", tags=[])
@when("Item SpecialStateManagement received update {}".format(SpecialState.SLEEP))
def turn_off_switchables_on_sleep(event):
    for item in ir.getItem("gLightManagement_LightSwitchable_IgnoreWhenSleep").members:
        events.sendCommand(item, OFF)


@rule("Core - Reset scenes if SpecialStateManagement was set to sleep.", description="Reset scenes if SpecialStateManagement was set to sleep.", tags=[])
@when("Item SpecialStateManagement received update {}".format(SpecialState.SLEEP))
def reset_scenes_on_sleep(event):
    if ir.getItem("SpecialStateManagement_ResetScenesOnSleep").state == ON:
        for item in ir.getItem("gSpecialStateManagement_Scenes").members:
            reset_scenes_on_sleep.log.info(
                item.name + ": item.state != 0 => " + str(item.state != 0) + " item.state = " + str(item.state))
            if item.state != 0:
                events.sendCommand(item, 0)


@rule("Core - Set SpecialStateManagement to off if DefaultStateTrigger triggers.", description="Set SpecialStateManagement to off if DefaultStateTrigger triggers.", tags=[])
@when("Member of gSpecialStateManagement_DefaultStateTrigger received update ON")
def reset_on_default_trigger(event):
    hours_after_deactivation = ir.getItem(
        "SpecialStateManagement_HoursUntilTriggersActivated")
    if isinstance(hours_after_deactivation.state, UnDefType):
        text = "No value was set for {}.".format(hours_after_deactivation.name)
        broadcast(text)
        return

    if (
        not is_special_state(SpecialState.DEFAULT) and
        hours_between(ir.getItem("SpecialStateManagement_LastActivation").state,
                      ZonedDateTime.now()) > hours_after_deactivation.state.intValue()
    ):
        events.postUpdate(
            ir.getItem("SpecialStateManagement"),
            SpecialState.DEFAULT
        )


@rule("Core - Activate scene.", description="Activate scene.", tags=[])
@when("Member of gSpecialStateManagement_Scenes received update")
def activate_scene(event):
    scene_index = event.itemState
    scene = ir.getItem(event.itemName)
    update_scene_members(scene=scene, scene_index=scene_index)


@rule("Core - Store scene.", description="Store scene.", tags=[])
@when("Member of gSpecialStateManagement_StoreSceneTriggers received update ON")
def store_scene(event):
    scenes = ir.getItem("gSpecialStateManagement_Scenes").members
    room = get_room_name(event.itemName)
    scene = next(
        (scene for scene in scenes if scene.name.startswith(room)), None)
    if scene != None:
        save_scene_item_states(scene)
        events.postUpdate(ir.getItem(event.itemName), OFF)
    else:
        text = "No item of group SpecialStateManagement_Scenes found for room {}.".format(
            room)
        broadcast(text)


@rule("Core - Forward SpecialStateManagement_SelectStateHelpers to SpecialStateManagement.", description="Forward SpecialStateManagement_SelectStateHelpers to SpecialStateManagement.", tags=[])
@when("Member of gSpecialStateManagement_SelectStateHelpers received update")
def forward_scenehelper_to_specialstatemanagment(event):
    match = re.search(r"^.*?(\d+)$", event.itemName)
    if match is not None:
        events.postUpdate(ir.getItem("SpecialStateManagement"), match.group(1))


@rule("Core - Forward SpecialStateManagement_SelectSceneHelpers to relevant member of gSpecialStateManagement_Scenes.", description="Forward SpecialStateManagement_SelectSceneHelpers to relevant member of gSpecialStateManagement_Scenes.", tags=[])
@when("Member of gSpecialStateManagement_SelectSceneHelpers received update")
def forward_scenehelper_to_specialstatemanagment_scenes(event):
    room = get_room_name(event.itemName)
    match = re.search(r"^.*?(\d+)$", event.itemName)
    if match is not None:
        scenes = ir.getItem("gSpecialStateManagement_Scenes").members
        scene = next(
            (scene for scene in scenes if scene.name.startswith(room)), None)
        if scene is not None:
            events.postUpdate(scene, match.group(1))
        else:
            text = "No item of group SpecialStateManagement_Scenes found for room {}.".format(
                room)
            broadcast(text)
    else:
        text = "{} is malformatted as there is not integer at the end!".format(
            event.itemName)
        broadcast(text)
