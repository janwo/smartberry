from __future__ import unicode_literals
from personal.core_helpers import reload_rules, get_date_string, get_all_semantic_items, get_semantic_items, intersection_count, sync_group_with_tags, get_date, has_same_location, METADATA_NAMESPACE
from core.triggers import when
from core.rules import rule
from personal.core_security import OperationState, is_security_state, ASSAULT_TRIGGER_EQUIPMENT_TAGS, ASSAULT_TRIGGER_POINT_TAGS, ASSAULT_DISARMER_EQUIPMENT_TAGS, ASSAULT_DISARMER_POINT_TAGS, LOCK_CLOSURE_EQUIPMENT_TAGS, LOCK_CLOSURE_POINT_TAGS, LOCK_EQUIPMENT_TAGS, LOCK_POINT_TAGS
from core.date import minutes_between, ZonedDateTime
from personal.core_broadcast import BroadcastType, broadcast
from core.jsr223.scope import ir, events, ON, OFF, OPEN, CLOSED
from org.openhab.core.types import UnDefType
from core.metadata import get_key_value, set_key_value
from org.openhab.core.model.script.actions import Log
from org.openhab.core.library.types import OnOffType, OpenClosedType


@rule("Core - Sync helper items of security", description="Core - Sync helper items", tags=['core', 'core-security'])
@when("Item added")
@when("Item updated")
@when("Item removed")
@when("System started")
def sync_security_helpers(event):
    # Sync group gCore_Security_AssaultTrigger with assault items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Security_AssaultTrigger"),
        ASSAULT_TRIGGER_EQUIPMENT_TAGS
    )

    # Sync group gCore_Security_AssaultDisarmamer with disarmer items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Security_AssaultDisarmamer"),
        ASSAULT_DISARMER_EQUIPMENT_TAGS
    )

    # Sync group gCore_Security_LockClosureTrigger with closure items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Security_LockClosureTrigger"),
        LOCK_CLOSURE_EQUIPMENT_TAGS
    )

    # Reload rules
    reload_rules(
        assault_trigger_triggers,
        assault_trigger
    )
    reload_rules(
        disarmament_triggers,
        disarmament
    )
    reload_rules(
        lock_closure_triggers,
        lock_closure
    )


assault_trigger_triggers = [
    "Descendent of gCore_Security_AssaultTrigger changed"
]


@rule("Core - Core_Security System - Trigger-Management", description="Core_Security System - Trigger-Management", tags=['core', 'core-security', 'core-reload-assault_trigger'])
@when("Descendent of gCore_Security_AssaultTrigger changed")
def assault_trigger(event):
    item = ir.getItem(event.itemName)
    if not is_security_state(OperationState.OFF) and (
        # Is target item:
        'gCore_Security_AssaultTrigger' in item.getGroupNames() or
        # Is Switch child of target item:
        intersection_count(item.getTags(), ASSAULT_TRIGGER_POINT_TAGS) > 0
    ):
        set_key_value(
            'Core_Security_OperationState',
            METADATA_NAMESPACE,
            'security',
            'last-alarm',
            get_date_string(ZonedDateTime.now())
        )

        message = "Silent alarm was triggered by {}!".format(item.label)
        if is_security_state(OperationState.ON):
            message = "Striking alarm was triggered by {}!".format(item.label)
            for alarm in ir.getItemsByTag("Alarm"):
                events.sendCommand(alarm, ON)

        broadcast(message, BroadcastType.ATTENTION)


@rule("Core - Core_Security System - Check Armament", description="Core_Security System - Check Armament", tags=['core', 'core-security'])
@when("Item Core_Security_OperationState received update {0}".format(OperationState.ON))
@when("Item Core_Security_OperationState received update {0}".format(OperationState.SILENTLY))
def armament(event):
    blockingAssaultTriggers = filter(
        lambda point: point.state in [OPEN, ON],
        reduce(
            lambda pointsList, newMember: pointsList + get_semantic_items(
                newMember,
                ASSAULT_TRIGGER_EQUIPMENT_TAGS,
                ASSAULT_TRIGGER_POINT_TAGS
            ),
            ir.getItem("gCore_Security_AssaultTrigger").members,
            []
        )
    )

    set_key_value(
        'Core_Security_OperationState',
        METADATA_NAMESPACE,
        'security',
        'blocking-assault-triggers',
        map(
            lambda trigger: trigger.name,
            blockingAssaultTriggers
        )
    )

    if blockingAssaultTriggers:
        events.postUpdate(
            ir.getItem('Core_Security_OperationState'),
            OperationState.OFF
        )
        broadcast("{} is in an OPEN state. No initiation into assault detection.".format(
            ", ".join(map(
                lambda trigger: trigger.label,
                blockingAssaultTriggers
            ))
        ))


disarmament_triggers = [
    "Descendent of gCore_Security_AssaultDisarmamer changed"
]


@rule("Core - Core_Security System - Disarmament-Management", description="Core_Security System - Disarmament-Management", tags=['core', 'core-security', 'core-reload-disarmament'])
@when("Descendent of gCore_Security_AssaultDisarmamer changed")
def disarmament(event):
    item = ir.getItem(event.itemName)
    if (
        # Is target item:
        'gCore_Security_AssaultDisarmamer' in item.getGroupNames() or
        # Is Switch child of target item:
        intersection_count(item.getTags(), ASSAULT_DISARMER_POINT_TAGS) > 0
    ) and (
        item.getStateAs(OnOffType) == ON or
        item.getStateAs(OpenClosedType) == OPEN
    ):
        events.postUpdate(
            ir.getItem("Core_Security_OperationState"),
            OperationState.OFF
        )


lock_closure_triggers = [
    "Descendent of gCore_Security_LockClosureTrigger changed"
]


@rule("Core - Core_Security System - Lock Closure-Management", description="Core_Security System - Lock Closure-Management", tags=['core', 'core-security', 'core-reload-lock_closure'])
@when("Descendent of gCore_Security_LockClosureTrigger changed")
def lock_closure(event):
    item = ir.getItem(event.itemName)
    if (
        # Is target item:
        'gCore_Security_LockClosureTrigger' in item.getGroupNames() or
        # Is Switch child of target item:
        intersection_count(item.getTags(), LOCK_CLOSURE_POINT_TAGS) > 0
    ) and (
        item.getStateAs(OnOffType) == OFF or
        item.getStateAs(OpenClosedType) == CLOSED
    ):
        for lock in get_all_semantic_items(LOCK_EQUIPMENT_TAGS, LOCK_POINT_TAGS):
            if has_same_location(item, lock):
                events.sendCommand(lock, ON)
                break


@rule("Core - Core_Security System - Turn off siren after Core_Security_OperationState update", description="Core_Security System - Turn off siren after Core_Security_OperationState update", tags=['core', 'core-security'])
@when("Item Core_Security_OperationState received update")
def siren_off(event):
    for alarm in ir.getItemsByTag("Alarm"):
        if alarm.getStateAs(OnOffType) != OFF:
            events.sendCommand(alarm, OFF)


@rule("Core - Core_Security System - Turn off siren after X minutes", description="Core_Security System - Turn off siren after X minutes", tags=['core', 'core-security'])
@when("Time cron 0 * * ? * * *")
def siren_autooff(event):
    autoOffTime = ir.getItem("Core_Security_SireneAutoOff")

    lastAlarmTime = get_key_value(
        'Core_Security_OperationState',
        METADATA_NAMESPACE,
        'security',
        'last-alarm'
    )

    if (
        isinstance(autoOffTime.state, UnDefType) or
        autoOffTime.state.floatValue() == 0 or
        not lastAlarmTime or
        minutes_between(
            get_date(lastAlarmTime),
            ZonedDateTime.now()
        ) > autoOffTime.state.floatValue()
    ):
        return

    for alarm in ir.getItemsByTag("Alarm"):
        if alarm.getStateAs(OnOffType) != OFF:
            events.sendCommand(alarm, OFF)
            broadcast(
                "Alarm item {} was automatically disabled after {} minutes.".format(
                    alarm.label,
                    autoOffTime.state
                ),
                BroadcastType.ATTENTION
            )
