from core.jsr223.scope import ir, UnDefType, ON, events
from personal.core_helpers import enum
from core.metadata import get_metadata, set_metadata
from personal.core_helpers import get_room_name

SpecialState = enum(DEFAULT=0, SLEEP=1)
SCENE_ITEM_METADATA_NAMESPACE = "scene-{0}-data"


def is_special_state(state=SpecialState.DEFAULT):
    actualState = ir.getItem("SpecialStateManagement").state
    return not isinstance(actualState, UnDefType) and actualState.intValue() == state


def has_scene_member_of_state(scene_item, state=ON, scene_index=-1):
    item_states = get_scene_item_states(scene_item, scene_index)

    if item_states != None:
        for item, saved_state in item_states:
            itemObj = ir.getItem(item)
            if itemObj != None and itemObj.getStateAs(state.getClass()) == state:
                return True
    return False


def poke_scene_members(scene_item, scene_index=-1):
    item_states = get_scene_item_states(scene_item, scene_index)
    if item_states != None:
        for item, saved_state in item_states:
            itemObj = ir.getItem(item)
            events.postUpdate(itemObj, itemObj.state)


def get_scene_item_states(scene_item, scene_index=-1):
    scene_index = scene_item.state if scene_index < 0 else scene_index
    store = get_metadata(
        scene_item.name,
        SCENE_ITEM_METADATA_NAMESPACE.format(scene_index)
    )

    if store == None:
        return store

    return store.configuration.iteritems()


def save_scene_item_states(scene_item, scene_index=-1):
    room = get_room_name(scene_item.name)
    scene_index = scene_item.state if scene_index < 0 else scene_index
    store = {}
    for item in ir.getItem("gSpecialStateManagement_SceneMembers").members:
        if item.name.startswith(room):
            store[item.name] = item.state.toString()

    set_metadata(
        scene_item.name,
        SCENE_ITEM_METADATA_NAMESPACE.format(scene_index),
        store,
        overwrite=True
    )
