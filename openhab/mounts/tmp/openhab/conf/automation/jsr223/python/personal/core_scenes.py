from __future__ import unicode_literals
from personal.core_helpers import reload_rules, get_date_string, get_date, get_location, sync_group_with_tags, has_same_location, METADATA_NAMESPACE, get_random_number, get_items_of_any_tags, create_helper_item, get_item_of_helper_item
from personal.core_scenes import SCENE_TAGS, get_scene_item_states, save_scene_item_states, trigger_scene_items, get_scene_states, SCENE_TRIGGER_TAGS
from core.triggers import when
from core.rules import rule
from core.jsr223.scope import ir, events, OFF, ON
from core.metadata import set_key_value, get_key_value, set_value
from org.openhab.core.types import UnDefType
from core.date import minutes_between, seconds_between, hours_between, ZonedDateTime
from org.openhab.core.model.script.actions import Log
from org.openhab.core.library.types import OnOffType


@rule("Core - Sync helper items of scenes", description="Core - Sync helper items", tags=['core', 'core-scenes'])
@when("Item added")
@when("Item updated")
@when("Item removed")
@when("System started")
@when("Item Core_Scenes_ReloadStates received update ON")
def sync_scenes_helpers(event):
    # Sync group gCore_Scenes_StateTriggers with scene trigger items
    sync_group_with_tags(
        ir.getItem("gCore_Scenes_StateTriggers"),
        SCENE_TRIGGER_TAGS
    )

    # Sync group gCore_Scenes with scene items
    sceneMembers = sync_group_with_tags(
        ir.getItem("gCore_Scenes"),
        SCENE_TAGS
    )

    # Check helper items
    for sceneMember in sceneMembers:
        # get scene location
        sceneLocation = get_location(sceneMember)

        # check metadata of context states
        contextStates = get_key_value(
            sceneMember.name,
            METADATA_NAMESPACE,
            'scenes',
            'context-states'
        )

        defaultContextStates = [
            ('reset', False)
        ]

        for context, state in defaultContextStates:
            if context not in contextStates:
                contextStates[context] = state

        set_key_value(
            sceneMember.name,
            METADATA_NAMESPACE,
            'scenes',
            'context-states',
            contextStates
        )

        # Create scene store trigger
        helper = create_helper_item(
            of=sceneMember,
            namespace='scenes',
            name='store-trigger',
            item_type='Number',
            category='settings',
            label="{0} überschreiben".format(
                sceneMember.label
            ),
            groups=['gCore_Scenes_StoreTriggers'],
            tags=['Point']
        )

        set_key_value(
            helper.name,
            'cellWidget',
            'label',
            '=items.{0}.title'.format(sceneMember.name)
        )

        set_key_value(
            helper.name,
            'cellWidget',
            'icon',
            'oh:settings'
        )

        set_key_value(
            helper.name,
            'cellWidget',
            'action',
            'options'
        )

        set_key_value(
            helper.name,
            'cellWidget',
            'actionItem',
            helper.name
        )

        set_key_value(
            helper.name,
            'listWidget',
            'action',
            'options'
        )

        set_key_value(
            helper.name,
            'listWidget',
            'actionItem',
            helper.name
        )

        set_key_value(
            helper.name,
            'listWidget',
            'icon',
            'oh:settings'
        )

        commandDescription = sceneMember.getCommandDescription()
        commandOptions = commandDescription.getCommandOptions() if commandDescription else []
        if commandOptions:
            set_key_value(
                helper.name,
                'stateDescription',
                'options',
                ','.join(
                    map(
                        lambda option: "{}={}".format(
                            option.getCommand(),
                            option.getLabel()
                        ),
                        commandOptions
                    )
                )
            )

            set_key_value(
                helper.name,
                'stateDescription',
                'pattern',
                '%d'
            )

        # Sync (Add) switches for each scene state
        stateValues = []
        for value, label in get_scene_states(sceneMember):
            stateValues.append(value)
            stateTriggerLabel = "{0}-Szene".format(label)
            stateTrigger = create_helper_item(
                of=sceneMember,
                namespace='scenes',
                name='trigger-state-{}'.format(value),
                item_type='Switch',
                category='party',
                label=stateTriggerLabel,
                groups=['gCore_Scenes_StateTriggers'],
                tags=SCENE_TRIGGER_TAGS
            )

            if stateTrigger.getLabel() != stateTriggerLabel:
                stateTrigger.setLabel(stateTriggerLabel)

            set_key_value(
                stateTrigger.name,
                METADATA_NAMESPACE,
                'scenes',
                'trigger-state',
                'to',
                value
            )

            set_key_value(
                stateTrigger.name,
                METADATA_NAMESPACE,
                'scenes',
                'trigger-state',
                'target-scene',
                sceneMember.name
            )

            set_key_value(
                stateTrigger.name,
                METADATA_NAMESPACE,
                'scenes',
                'trigger-state',
                'generated',
                True
            )

            set_value(
                stateTrigger.name,
                'ga',
                'Scene'
            )

            set_key_value(
                stateTrigger.name,
                'ga',
                'sceneReversible',
                False
            )

            if sceneLocation:
                set_key_value(
                    stateTrigger.name,
                    'ga',
                    'synonyms',
                    '{} in {}'.format(
                        stateTriggerLabel,
                        sceneLocation.label
                    )
                )

            set_key_value(
                stateTrigger.name,
                'cellWidget',
                'label',
                '=items.{0}.title'.format(stateTrigger.name)
            )

            set_key_value(
                stateTrigger.name,
                'cellWidget',
                'icon',
                'oh:party'
            )

            set_key_value(
                stateTrigger.name,
                'listWidget',
                'subtitle',
                '=items.{0}.displayState'.format(stateTrigger.name)
            )

            set_key_value(
                stateTrigger.name,
                'listWidget',
                'icon',
                'oh:party'
            )

        # Sync (Remove) switches for each scene state
        for stateTrigger in ir.getItem('gCore_Scenes_StateTriggers').members:
            triggerInfo = get_key_value(
                stateTrigger.name,
                METADATA_NAMESPACE,
                'scenes',
                'trigger-state'
            )

            # Do not remove manual created items that are just tagged wrong as it could be added manually to an existing (important) item.
            if not triggerInfo or 'generated' not in triggerInfo or not triggerInfo['generated']:
                continue

            if 'to' in triggerInfo and 'target-scene' in triggerInfo:
                try:
                    scene = ir.getItem(triggerInfo['target-scene'])
                    if scene and triggerInfo['to'] in map(
                        lambda (value, label): value,
                        get_scene_states(scene)
                    ):
                        continue
                except:
                    pass
            ir.remove(stateTrigger.name)

    # Reload rules
    reload_rules(
        activate_scene_triggers,
        activate_scene
    )
    reload_rules(
        store_scene_triggers,
        store_scene
    )
    reload_rules(
        manage_scenetriggers_triggers,
        manage_scenetriggers
    )


activate_scene_triggers = [
    "Member of gCore_Scenes received update"
]


@rule("Core - Activate scene.", description="Activate scene.", tags=['core', 'core-scenes', 'core-reload-activate_scene'])
@when("Member of gCore_Scenes received update")
def activate_scene(event):
    scene = ir.getItem(event.itemName)
    set_key_value(
        scene.name,
        METADATA_NAMESPACE,
        'scenes',
        "last-activation",
        get_date_string(ZonedDateTime.now())
    )
    trigger_scene_items(scene)


store_scene_triggers = [
    "Member of gCore_Scenes_StoreTriggers received update"
]


@rule("Core - Store scene.", description="Store scene.", tags=['core', 'core-scenes', 'core-reload-store_scene'])
@when("Member of gCore_Scenes_StoreTriggers received update")
def store_scene(event):
    sceneTrigger = ir.getItem(event.itemName)
    scene = get_item_of_helper_item(sceneTrigger)
    save_scene_item_states(scene, event.itemState.toFullString())


manage_scenetriggers_triggers = [
    "Member of gCore_Scenes_StateTriggers received update"
]


@rule("Core - Manage gCore_Scenes_StateTriggers to trigger scene.", description="Manage gCore_Scenes_StateTriggers to trigger scene.", tags=['core', 'core-scenes', 'core-reload-manage_scenetriggers'])
@when("Member of gCore_Scenes_StateTriggers received update")
def manage_scenetriggers(event):
    item = ir.getItem(event.itemName)
    triggerInfo = get_key_value(
        item.name,
        METADATA_NAMESPACE,
        'scenes',
        'trigger-state'
    )

    if (
        'states' in triggerInfo and
        item.state.toFullString() not in triggerInfo['states']
    ):
        return

    if 'to' in triggerInfo and 'target-scene' in triggerInfo:
        try:
            scene = ir.getItem(triggerInfo['target-scene'])
        except:
            return
        if (
            'from' in triggerInfo and
            not isinstance(scene.state, UnDefType) and
            triggerInfo['from'] != scene.state.toFullString()
        ):
            return

        lastActivation = get_key_value(
            scene.name,
            METADATA_NAMESPACE,
            'scenes',
            'last-activation'
        )

        if not lastActivation or (
            'hours-until-active' in triggerInfo and
            hours_between(
                get_date(lastActivation),
                ZonedDateTime.now()
            ) <= triggerInfo['hours-until-active']
        ) or (
            'minutes-until-active' in triggerInfo and
            minutes_between(
                get_date(lastActivation),
                ZonedDateTime.now()
            ) <= triggerInfo['minutes-until-active']
        ) or (
            'seconds-until-active' in triggerInfo and
            seconds_between(
                get_date(lastActivation),
                ZonedDateTime.now()
            ) <= triggerInfo['seconds-until-active']
        ):
            return

        events.postUpdate(scene, triggerInfo['to'])
