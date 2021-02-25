from __future__ import unicode_literals
from personal.core_helpers import get_date_string, get_equipment_points, get_childs_with_condition, intersection_count, sync_group_with_tags, get_date, get_items_of_any_tags, has_same_location, METADATA_NAMESPACE
from core.triggers import when
from core.rules import rule
from personal.core_presence import PresenceState, get_presence
from personal.core_security import OperationState, is_security_state, ASSAULT_TRIGGER_EQUIPMENT_TAGS, ASSAULT_TRIGGER_POINT_TAGS, ASSAULT_DISARMER_EQUIPMENT_TAGS, ASSAULT_DISARMER_POINT_TAGS, LOCK_CLOSURE_EQUIPMENT_TAGS, LOCK_CLOSURE_POINT_TAGS, LOCK_EQUIPMENT_TAGS, LOCK_POINT_TAGS
from core.date import minutes_between, ZonedDateTime
from personal.core_broadcast import BroadcastType, broadcast
from core.jsr223.scope import ir, events, ON, OFF, OPEN
from org.openhab.core.types import UnDefType
from core.metadata import get_key_value, set_key_value


@rule("Core - Sync helper items", description="Core - Sync helper items", tags=['core', 'security'])
@when("Item added")
@when("Item updated")
@when("Item removed")
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


@rule("Core - Core_Security System - Trigger-Management", description="Core_Security System - Trigger-Management", tags=['core', 'security'])
@when("Descendant of gCore_Security_AssaultTrigger received update OPEN")
@when("Descendant of gCore_Security_AssaultTrigger received update ON")
def assault_trigger(event):
    if is_security_state(OperationState.OFF):
        return

    item = ir.getItem(event.itemName)
    if (
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
            events.sendCommand(ir.getItem("Core_Security_Sirene"), ON)

        broadcast(message, BroadcastType.ATTENTION)


@rule("Core - Core_Security System - Check Armament", description="Core_Security System - Check Armament", tags=['core', 'security'])
@when("Item Core_Security_OperationState received update {0}".format(OperationState.ON))
@when("Item Core_Security_OperationState received update {0}".format(OperationState.SILENTLY))
def armament(event):
    blockingAssaultTriggers = filter(
        lambda point: point.state == OPEN or point.state == ON,
        reduce(
            lambda pointsList, newMember: pointsList + get_equipment_points(
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
        events.sendCommand(
            ir.getItem('Core_Security_OperationState'),
            OperationState.OFF
        )
        broadcast("{} is in an opened state. No initiation into assault detection.".format(
            ", ".join(map(
                lambda trigger: trigger.label,
                blockingAssaultTriggers
            ))
        ))


@rule("Core - Core_Security System - Disarmament-Management", description="Core_Security System - Disarmament-Management", tags=['core', 'security'])
@when("Descendant of gCore_Security_AssaultDisarmamer received update")
def disarmament(event):
    item = ir.getItem(event.itemName)
    if (
        # Is target item:
        'gCore_Security_AssaultDisarmamer' in item.getGroupNames() or
        # Is Switch child of target item:
        intersection_count(item.getTags(), ASSAULT_DISARMER_POINT_TAGS) > 0
    ):
        events.postUpdate(
            ir.getItem("Core_Security_OperationState"),
            OperationState.OFF
        )


@rule("Core - Core_Security System - Lock Closure-Management", description="Core_Security System - Lock Closure-Management", tags=['core', 'security'])
@when("Descendant of gCore_Security_LockClosureTrigger received update CLOSED")
@when("Descendant of gCore_Security_LockClosureTrigger received update OFF")
def lock_closure(event):
    item = ir.getItem(event.itemName)
    if (
        # Is target item:
        'gCore_Security_LockClosureTrigger' in item.getGroupNames() or
        # Is Switch child of target item:
        intersection_count(item.getTags(), LOCK_CLOSURE_POINT_TAGS) > 0
    ):
        for lock in get_equipment_points(item, LOCK_EQUIPMENT_TAGS, LOCK_POINT_TAGS):
            if has_same_location(item, lock):
                events.sendCommand(lock, ON)
                return

        broadcast("Lock not found for item {}.".format(item.name))


@rule("Core - Core_Security System - Turn off siren after Core_Security_OperationState update", description="Core_Security System - Turn off siren after Core_Security_OperationState update", tags=['core', 'security'])
@when("Item Core_Security_OperationState received update")
def siren_off(event):
    if ir.getItem("Core_Security_Sirene").state == ON:
        events.sendCommand(ir.getItem("Core_Security_Sirene"), OFF)


@rule("Core - Core_Security System - Turn off siren after X minutes", description="Core_Security System - Turn off siren after X minutes", tags=['core', 'security'])
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
        ir.getItem("Core_Security_Sirene").state != ON or
        not lastAlarmTime or
        minutes_between(
            get_date(lastAlarmTime),
            ZonedDateTime.now()
        ) > autoOffTime.state.floatValue()
    ):
        return

    events.sendCommand(ir.getItem("Core_Security_Sirene"), OFF)
    message = "Alarm was automatically disabled after {} minutes.".format(
        autoOffTime.state)
    broadcast(
        message,
        BroadcastType.ATTENTION
    )
