from datetime import datetime, timedelta
from core.metadata import get_metadata, set_metadata
from personal.core_helpers import enum, get_room_name
import re

SpecialState = enum(NONE=0, SLEEP=1)
SCENE_ITEM_METADATA_NAMESPACE = "scene-{0}-data"


@rule("Set last activation if SpecialStateManagement changes.", description="Set last activation if SpecialStateManagement changes.", tags=[])
@when("Item SpecialStateManagement received update")
def set_last_activation(event):
    ir.getItem("SpecialStateManagement_LastActivation").postUpdate(
        datetime.now())


@rule("Reset scenes if SpecialStateManagement was set to sleep.", description="Reset scenes if SpecialStateManagement was set to sleep.", tags=[])
@when("Item SpecialStateManagement received update 1")
def reset_scenes_on_sleep(event):
    for item in ir.getItem("gSpecialStateManagement_Scenes").members:
        item.sendCommand(0)


@rule("Set SpecialStateManagement to off if DefaultStateTrigger triggers.", description="Set SpecialStateManagement to off if DefaultStateTrigger triggers.", tags=[])
@when("Member of gSpecialStateManagement_DefaultStateTrigger received update ON")
def reset_on_default_trigger(event):
    item = ir.getItem("SpecialStateManagement")
    hours_after_deactivation = ir.getItem(
        "SpecialStateManagement_HoursUntilTriggersActivated").state.intValue()
    if (
        item.state != SpecialState.NONE and
        datetime.now() - timedelta(hours=hours_after_deactivation) > SpecialStateManagement_LastActivation.state.intValue()
    ):
        item.postUpdate(SpecialState.NONE)


@rule("Change scene.", description="Change scene.", tags=[])
@when("Member of gSpecialStateManagement_Scenes changed")
def change_scene(event):
    scene_index = event.triggeringItem.state.intValue()
    store = get_metadata(
        event.triggeringItem,
        SCENE_ITEM_METADATA_NAMESPACE.format(scene_index)
    )
    if store != None:
        for item, state in store.iteritems():
            if ir.getItem(item) != None:
                item.postCommand(state)
    else:
        change_scene.logInfo(
            "special-state-management.rules", "No states saved for scene " +
            event.triggeringItem.name + " [" + scene_index + "], yet."
        )


@rule("Store scene.", description="Store scene.", tags=[])
@when("Member of gSpecialStateManagement_StoreSceneTriggers received update ON")
def store_scene(event):
    scenes = ir.getItem("gSpecialStateManagement_Scenes").members
    room = get_room_name(event.triggeringItem.name)
    scene = next(
        (scene for scene in scenes if scene.name.startsWith(room)), None)
    if scene != None:
        scene_index = scene.state.intValue()
        store = {}
        for item in ir.getItem("gSpecialStateManagement_SceneMembers").members:
            if item.name.startsWith(room):
                store[item.name] = item.state

        set_metadata(
            scene,
            SCENE_ITEM_METADATA_NAMESPACE.format(scene_index),
            store,
            overwrite=True
        )
    else:
        store_scene.logInfo(
            "special-state-management.rules",
            "No item of group SpecialStateManagement_Scenes found for room " + room + "."
        )


@rule("Turn off light if SpecialStateManagement was set to sleep.", description="Turn off light if SpecialStateManagement was set to sleep.", tags=[])
@when("Item SpecialStateManagement received update 1")
def turn_off_switchables_on_sleep(event):
    for item in ir.getItem("gLightManagement_LightSwitchable_IgnoreWhenSleep").members:
        item.sendCommand(OFF)


@rule("Forward SpecialStateManagement_SelectStateHelpers to SpecialStateManagement.", description="Forward SpecialStateManagement_SelectStateHelpers to SpecialStateManagement.", tags=[])
@when("Member of gSpecialStateManagement_SelectStateHelpers received update")
def forward_scenehelper_to_specialstatemanagment(event):
    match = re.search(r"^.*?(\\d+)$", event.triggeringItem.name)
    if match is not None:
        ir.getItem("SpecialStateManagement").postUpdate(match.group())


@rule("Forward SpecialStateManagement_SelectSceneHelpers to relevant member of gSpecialStateManagement_Scenes.", description="Forward SpecialStateManagement_SelectSceneHelpers to relevant member of gSpecialStateManagement_Scenes.", tags=[])
@when("Member of gSpecialStateManagement_SelectSceneHelpers received update")
def forward_scenehelper_to_specialstatemanagment_scenes(event):
    room = get_room_name(event.triggeringItem.name)
    match = re.search(r"^.*?(\\d+)$", event.triggeringItem.name)
    if match is not None:
        scenes = ir.getItem("gSpecialStateManagement_Scenes").members
        scene = next(
            (scene for scene in scenes if scene.name.startsWith(room)), None)
        if scene is not None:
            scene.postUpdate(match.group())
        else:
            forward_scenehelper_to_specialstatemanagment_scenes.logError(
                "special-state-management.rules",
                "No item of group SpecialStateManagement_Scenes found for room " + room + "."
            )
    else:
        forward_scenehelper_to_specialstatemanagment_scenes.logError(
            "special-state-management.rules",
            event.triggeringItem.name + " is malformatted as there is not integer at the end!"
        )
