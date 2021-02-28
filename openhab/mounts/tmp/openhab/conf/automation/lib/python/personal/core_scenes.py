from __future__ import unicode_literals
from core.jsr223.scope import ir, ON, events
from personal.core_helpers import enum, METADATA_NAMESPACE
from core.metadata import get_metadata, set_metadata
from personal.core_helpers import METADATA_NAMESPACE, has_same_location, get_childs_with_condition
from org.openhab.core.types import UnDefType
from core.metadata import get_key_value, set_key_value

SCENE_TAGS = [
    'Scene'
]


def get_scene_state(scene):
    if not isinstance(scene.state, UnDefType):
        return scene.state.floatValue()
    else:
        commandDescription = scene.getCommandDescription()
        commandOptions = commandDescription.getCommandOptions() if commandDescription else []
        if commandOptions:
            return commandOptions[0].getCommand()

    return None


def get_scene_states(scene):
    commandDescription = scene.getCommandDescription()
    commandOptions = commandDescription.getCommandOptions() if commandDescription else []
    if not commandOptions:
        return []
    return map(
        lambda o: (o.getCommand(), o.getLabel()),
        commandOptions
    )


def trigger_scene(scene, scene_state=None, poke_only=False):
    item_states = get_scene_item_states(scene, scene_state)
    for item, state in item_states:
        if poke_only:
            events.postUpdate(item, item.state)
        elif state != None:
            events.sendCommand(item, str(state))


def save_scene_item_states(scene, scene_state=None):
    items = get_scene_items(scene)
    scene_state = get_scene_state(
        scene) if scene_state == None else scene_state

    if scene_state is not None:
        store = {}
        for item in items:
            store[item.name] = item.state.toString()

        set_key_value(
            scene.name,
            METADATA_NAMESPACE,
            'scenes',
            'states',
            scene_state,
            store
        )


def apply_context(scene, context):
    contextState = get_key_value(
        scene.name,
        METADATA_NAMESPACE,
        'scenes',
        'context-states',
        context
    )

    if contextState in map(
        lambda (state, label): state,
        get_scene_states(scene)
    ):
        events.sendCommand(scene, contextState)
        return True
    return False


def get_scene_items(scene):
    customMembers = get_key_value(
        scene.name,
        METADATA_NAMESPACE,
        'scenes',
        'custom-members'
    )

    if customMembers:
        return reduce(
            lambda customMemberList, newMember: customMemberList +
            get_childs_with_condition(newMember),
            customMembers,
            []
        )

    return filter(
        lambda item: item.getType() != 'Group' and has_same_location(item, scene),
        ir.getItems()
    )


def get_scene_item_states(scene, scene_state=None):
    scene_state = get_scene_state(
        scene) if scene_state == None else scene_state

    if scene_state is None:
        return []

    states = get_key_value(
        scene.name,
        METADATA_NAMESPACE,
        'scenes',
        'states',
        scene_state
    )

    return map(
        lambda item: (
            item,
            states[item.name]
        ) if states and item.name in states else(
            item,
            None
        ),
        get_scene_items(scene)
    )
