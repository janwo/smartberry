from personal.core_helpers import get_location, sync_group_with_tags, has_same_location, METADATA_NAMESPACE, get_random_number, get_items_of_any_tags, create_helper_item, get_item_of_helper_item, remove_unlinked_helper_items
from personal.core_scenes import get_scene_item_states, save_scene_item_states, trigger_scene, get_scene_states
from core.triggers import when
from core.rules import rule
from core.date import ZonedDateTime, format_date
from core.jsr223.scope import ir, events, OFF, ON
from core.metadata import set_key_value, get_key_value, set_value
from org.openhab.core.types import UnDefType
from core.date import minutes_between, seconds_between, hours_between, format_date, ZonedDateTime
from org.openhab.core.model.script.actions import Log


@rule("Core - Sync helper items", description="Core - Sync helper items", tags=['core', 'scenes'])
@when("Item added")
@when("Item updated")
@when("Item removed")
def sync_helper_items(event):
    # Sync group gCore_Scenes with Scene items
    members = sync_group_with_tags(
        ir.getItem("gCore_Scenes"),
        ['Scene']
    )

    # Check helper items
    for member in members:
        # check metadata of context states
        contextStates = get_key_value(
            member.name,
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

        # Create scene store trigger
        helper = create_helper_item(
            member,
            'scenes',
            'store-trigger',
            'Number',
            'settings',
            u"{0}-Szene überschreiben".format(member.name),
            ['gCore_Scenes_StoreTriggers'],
            ['Point']
        )

        set_key_value(
            helper.name,
            'cellWidget',
            'label',
            '=items.{0}.title'.format(member.name)
        )

        set_key_value(
            helper.name,
            'cellWidget',
            'icon',
            'oh:settings'
        )

        set_key_value(
            helper.name,
            'listWidget',
            'subtitle',
            '=items.{0}.displayState'.format(member.name)
        )

        set_key_value(
            helper.name,
            'listWidget',
            'icon',
            'oh:settings'
        )

        commandDescription = member.getCommandDescription()

        Log.logInfo(
            "Log Scenes",
            commandDescription
        )

        if (
            commandDescription and
            'options' in commandDescription and
            len(commandDescription.options) > 0
        ):
            set_key_value(
                helper.name,
                'stateDescription',
                'options',
                map(
                    lambda option: {
                        'value': option.getValue(),
                        'label': option.getLabel()
                    },
                    commandDescription.options
                )
            )

        # Sync switches for each scene state
        stateValues = []
        for value, label in get_scene_states():
            stateValues.append(value)
            stateTriggerLabel = "{0}-Szene".format(label)
            stateTrigger = create_helper_item(
                member,
                'scenes',
                'state-trigger'
                'Switch',
                'party',
                stateTriggerLabel,
                ['gCore_Scenes_StateTriggers']
            )

            if stateTrigger.getLabel() != stateTriggerLabel:
                stateTrigger.setLabel(stateTriggerLabel)

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

            set_key_value(
                stateTrigger.name,
                METADATA_NAMESPACE,
                'scenes',
                'trigger-state',
                'to',
                value
            )

            set_key_value(
                helper.name,
                'cellWidget',
                'label',
                '=items.{0}.title'.format(stateTrigger.name)
            )

            set_key_value(
                helper.name,
                'cellWidget',
                'icon',
                'oh:settings'
            )

            set_key_value(
                helper.name,
                'listWidget',
                'subtitle',
                '=items.{0}.displayState'.format(stateTrigger.name)
            )

            set_key_value(
                helper.name,
                'listWidget',
                'icon',
                'oh:settings'
            )

        for stateTrigger in ir.getItem('gCore_Scenes_StateTriggers').members:
            scene = get_item_of_helper_item(stateTrigger)
            state = get_key_value(
                stateTrigger.name,
                METADATA_NAMESPACE,
                'scenes',
                'trigger-state',
                'to'
            )

            if state and scene:
                try:
                    sceneStateValues = map(
                        lambda value, label: value,
                        get_scene_states(scene)
                    )
                    if state not in sceneStateValues:
                        ir.remove(stateTrigger.name)
                except:
                    ir.remove(stateTrigger.name)
            else:
                ir.remove(stateTrigger.name)

    remove_unlinked_helper_items()


@rule("Core - Activate scene.", description="Activate scene.", tags=['core', 'scenes'])
@when("Member of gCore_Scenes received command")
def activate_scene(event):
    set_key_value(
        event.itemName,
        METADATA_NAMESPACE,
        'scenes',
        "last-activation",
        format_date(ZonedDateTime.now())
    )

    trigger_scene(ir.getItem(event.itemName), event.itemState)


@rule("Core - Store scene.", description="Store scene.", tags=['core', 'scenes'])
@when("Member of gCore_Scenes_StoreTriggers received update")
def store_scene(event):
    sceneTrigger = ir.getItem(event.itemName)
    scene = get_item_of_helper_item(sceneTrigger)
    save_scene_item_states(scene, event.itemState.floatValue())


@rule("Core - Manage gCore_Scenes_StateTriggers to trigger scene.", description="Manage gCore_Scenes_StateTriggers to trigger scene.", tags=['core', 'scenes'])
@when("Member of gCore_Scenes_StateTriggers received update ON")
@when("Member of gCore_Scenes_StateTriggers received update OPEN")
def manage_scenetriggers(event):
    scene = get_item_of_helper_item(ir.getItem(event.itemName))
    triggerInfo = get_key_value(
        event.itemName,
        METADATA_NAMESPACE,
        'scenes',
        'trigger-state'
    )

    if scene and triggerInfo and 'to' in triggerInfo:
        if 'from' in triggerInfo and (
            isinstance(scene.state, UnDefType) or
            triggerInfo['from'] is not scene.state.floatValue()
        ):
            return

        lastActivation = get_key_value(
            scene.name,
            METADATA_NAMESPACE,
            'scenes',
            'last-activation'
        )

        if ('hours-until-active' in triggerInfo and (
            not lastActivation or hours_between(
                lastActivation,
                ZonedDateTime.now()
            ) < triggerInfo['hours-until-active']
        )) or ('minutes-until-active' in triggerInfo and (
            not lastActivation or minutes_between(
                lastActivation,
                ZonedDateTime.now()
            ) < triggerInfo['minutes-until-active']
        )) or ('seconds-until-active' in triggerInfo and (
            not lastActivation or seconds_between(
                lastActivation,
                ZonedDateTime.now()
            ) < triggerInfo['seconds-until-active']
        )):
            return

        events.sendCommand(scene, triggerInfo['to'])
