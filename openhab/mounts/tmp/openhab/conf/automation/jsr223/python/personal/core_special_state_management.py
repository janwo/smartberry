from core.metadata import get_metadata, set_metadata
from personal.core_helpers import get_room_name
from personal.core_special_state_management import SpecialState, is_special_state
from core.triggers import when
from core.rules import rule
from core.date import hours_between, ZonedDateTime, format_date
import re

SCENE_ITEM_METADATA_NAMESPACE = "scene-{0}-data"


@rule("Set last activation if SpecialStateManagement changes.", description="Set last activation if SpecialStateManagement changes.", tags=[])
@when("Item SpecialStateManagement received update")
def set_last_activation(event):
    events.postUpdate(ir.getItem(
        "SpecialStateManagement_LastActivation"), format_date(ZonedDateTime.now()))


@rule("Turn off light if SpecialStateManagement was set to sleep.", description="Turn off light if SpecialStateManagement was set to sleep.", tags=[])
@when("Item SpecialStateManagement received update {}".format(SpecialState.SLEEP))
def turn_off_switchables_on_sleep(event):
    for item in ir.getItem("gLightManagement_LightSwitchable_IgnoreWhenSleep").members:
        events.sendCommand(item, OFF)


@rule("Reset scenes if SpecialStateManagement was set to sleep.", description="Reset scenes if SpecialStateManagement was set to sleep.", tags=[])
@when("Item SpecialStateManagement received update {}".format(SpecialState.SLEEP))
def reset_scenes_on_sleep(event):
    if ir.getItem("SpecialStateManagement_ResetScenesOnSleep").state == ON:
        for item in ir.getItem("gSpecialStateManagement_Scenes").members:
            events.sendCommand(item, 0)


@rule("Set SpecialStateManagement to off if DefaultStateTrigger triggers.", description="Set SpecialStateManagement to off if DefaultStateTrigger triggers.", tags=[])
@when("Member of gSpecialStateManagement_DefaultStateTrigger received update ON")
def reset_on_default_trigger(event):
    hours_after_deactivation = ir.getItem(
        "SpecialStateManagement_HoursUntilTriggersActivated")
    if isinstance(hours_after_deactivation.state, UnDefType):
        reset_on_default_trigger.log.warn(
            "No value set for {}.".format(hours_after_deactivation.name))
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


@rule("Change scene.", description="Change scene.", tags=[])
@when("Member of gSpecialStateManagement_Scenes received update")
def change_scene(event):
    scene_index = event.itemState
    store = get_metadata(
        event.itemName,
        SCENE_ITEM_METADATA_NAMESPACE.format(scene_index)
    )

    if store != None:
        for item, state in store.configuration.iteritems():
            if ir.getItem(item) != None:
                events.sendCommand(ir.getItem(item), str(state))
    else:
        change_scene.log.info(
            "No states saved for scene {0} [{1}], yet.".format(
                event.itemName, scene_index)
        )


@rule("Store scene.", description="Store scene.", tags=[])
@when("Member of gSpecialStateManagement_StoreSceneTriggers received update ON")
def store_scene(event):
    scenes = ir.getItem("gSpecialStateManagement_Scenes").members
    room = get_room_name(event.itemName)
    scene = next(
        (scene for scene in scenes if scene.name.startswith(room)), None)
    if scene != None:
        scene_index = scene.state
        store = {}
        for item in ir.getItem("gSpecialStateManagement_SceneMembers").members:
            if item.name.startswith(room):
                store[item.name] = item.state.toString()

        set_metadata(
            scene.name,
            SCENE_ITEM_METADATA_NAMESPACE.format(scene_index),
            store,
            overwrite=True
        )

        events.postUpdate(ir.getItem(event.itemName), OFF)
    else:
        store_scene.log.info(
            "No item of group SpecialStateManagement_Scenes found for room {}.".format(
                room)
        )


@rule("Forward SpecialStateManagement_SelectStateHelpers to SpecialStateManagement.", description="Forward SpecialStateManagement_SelectStateHelpers to SpecialStateManagement.", tags=[])
@when("Member of gSpecialStateManagement_SelectStateHelpers received update")
def forward_scenehelper_to_specialstatemanagment(event):
    match = re.search(r"^.*?(\d+)$", event.itemName)
    if match is not None:
        events.postUpdate(ir.getItem("SpecialStateManagement"), match.group(1))


@rule("Forward SpecialStateManagement_SelectSceneHelpers to relevant member of gSpecialStateManagement_Scenes.", description="Forward SpecialStateManagement_SelectSceneHelpers to relevant member of gSpecialStateManagement_Scenes.", tags=[])
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
            forward_scenehelper_to_specialstatemanagment_scenes.log.error(
                "No item of group SpecialStateManagement_Scenes found for room {}.".format(
                    room)
            )
    else:
        forward_scenehelper_to_specialstatemanagment_scenes.log.error(
            "{} is malformatted as there is not integer at the end!".format(
                event.itemName)
        )
