from __future__ import unicode_literals
from personal.core_helpers import sync_group_with_tags, get_date, get_items_of_any_tags, has_same_location, METADATA_NAMESPACE
from core.triggers import when
from core.rules import rule
from personal.core_presence import PresenceState, get_presence
from personal.core_security import OperationState, is_security_state
from core.date import minutes_between, ZonedDateTime, format_date
from personal.core_broadcast import BroadcastType, broadcast
from core.jsr223.scope import ir, events, ON, OFF, OPEN
from org.openhab.core.types import UnDefType
from core.metadata import get_key_value, set_key_value

TAGS = {
    "assault-trigger": ["Core-Security-AssaultTrigger"],
    "assault-disarmer": ["Core-Security-Disarmer"],
    "lock-closure-trigger": ["Core-Security-LockClosureTrigger"],
}


@rule("Core - Sync helper items", description="Core - Sync helper items", tags=['core', 'security'])
@when("Item added")
@when("Item updated")
@when("Item removed")
def sync_security_helpers(event):
    # Sync group gCore_Security_AssaultTrigger with assault items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Security_AssaultTrigger"),
        TAGS['assault-trigger']
    )

    # Sync group gCore_Security_AssaultDisarmamer with disarmer items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Security_AssaultDisarmamer"),
        TAGS['assault-disarmer']
    )

    # Sync group gCore_Security_LockClosureTrigger with closure items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Security_LockClosureTrigger"),
        TAGS['lock-closure-trigger']
    )


@rule("Core - Core_Security System - Trigger-Management", description="Core_Security System - Trigger-Management", tags=['core', 'security'])
@when("Member of gCore_Security_AssaultTrigger received update OPEN")
@when("Member of gCore_Security_AssaultTrigger received update ON")
def assault_trigger(event):
    if is_security_state(OperationState.OFF):
        return

    set_key_value(
        'Core_Security_OperationState',
        METADATA_NAMESPACE,
        'security',
        'last-alarm',
        format_date(ZonedDateTime.now())
    )

    label = ir.getItem(event.itemName).label
    message = "Silent alarm was triggered by {}!".format(label)
    if is_security_state(OperationState.ON):
        message = "Striking alarm was triggered by {}!".format(label)
        events.sendCommand(ir.getItem("Core_Security_Sirene"), ON)

    broadcast(message, BroadcastType.ATTENTION)


@rule("Core - Core_Security System - Check Armament", description="Core_Security System - Check Armament", tags=['core', 'security'])
@when("Item Core_Security_OperationState received update {0}".format(OperationState.ON))
@when("Item Core_Security_OperationState received update {0}".format(OperationState.SILENTLY))
def armament(event):
    blockingAssaultTriggers = filter(
        lambda trigger: trigger.state == OPEN or trigger.state == ON,
        ir.getItem("gCore_Security_AssaultTrigger").members
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
@when("Member of gCore_Security_AssaultDisarmamer received update")
def disarmament(event):
    events.postUpdate(
        ir.getItem("Core_Security_OperationState"),
        OperationState.OFF
    )


@rule("Core - Core_Security System - Lock Closure-Management", description="Core_Security System - Lock Closure-Management", tags=['core', 'security'])
@when("Member of gCore_Security_LockClosureTrigger received update CLOSED")
@when("Member of gCore_Security_LockClosureTrigger received update OFF")
def lock_closure(event):
    triggerItem = ir.getItem(event.itemName)
    locks = get_items_of_any_tags(['Lock'])
    lock = next(
        (lock for lock in locks if has_same_location(triggerItem, lock)),
        None
    )

    if lock != None:
        events.sendCommand(lock, ON)
    else:
        broadcast("Lock not found for item {}.".format(triggerItem.name))


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
