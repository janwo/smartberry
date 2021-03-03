from __future__ import unicode_literals
from core.jsr223.scope import ir, ON, events
from personal.core_helpers import METADATA_NAMESPACE
from core.metadata import get_metadata, set_metadata
from personal.core_helpers import get_all_semantic_items, METADATA_NAMESPACE, has_same_location, get_childs_with_condition
from org.openhab.core.types import UnDefType
from core.metadata import get_key_value, set_key_value
from personal.core_lights import LIGHTS_POINT_TAGS, LIGHTS_EQUIPMENT_TAGS
from org.openhab.core.model.script.actions import Log

SCENE_TAGS = [
    'Scene'
]


def get_scene_state(scene):
    if not isinstance(scene.state, UnDefType):
        return scene.state.toFullString()
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
            get_childs_with_condition(
                newMember,
                lambda item: item.getType() != 'Group'
            ),
            customMembers,
            []
        )

    # Use lights as default items in list.
    return filter(
        lambda item: item.getType() != 'Group' and has_same_location(item, scene),
        get_all_semantic_items(LIGHTS_EQUIPMENT_TAGS, LIGHTS_POINT_TAGS)
    )


def get_scene_item_states(scene, scene_state=None):
    scene_state = scene_state or get_scene_state(scene)

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


def save_scene_item_states(scene, scene_state=None):
    items = get_scene_items(scene)
    scene_state = scene_state or get_scene_state(scene)

    if scene_state is not None:
        store = {}
        for item in items:
            store[item.name] = item.state.toFullString()

        set_key_value(
            scene.name,
            METADATA_NAMESPACE,
            'scenes',
            'states',
            scene_state,
            store
        )


def trigger_scene_items(scene, poke_only=False):

    item_states = get_scene_item_states(scene)
    for item, state in item_states:
        Log.logInfo("trigger_scene_items", "{} item {} via scene {}.".format(
            "Poke" if poke_only else "Trigger",
            item.name,
            scene.name
        ))
        if poke_only:
            events.postUpdate(item, item.state)
        elif state is not None:
            events.postUpdate(item, state)
            events.sendCommand(item, state)


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
        events.postUpdate(scene, contextState)
        return True
    return False
