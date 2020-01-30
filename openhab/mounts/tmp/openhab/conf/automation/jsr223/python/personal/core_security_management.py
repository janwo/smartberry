from datetime import datetime, timedelta
from personal.core_helpers import enum, get_room_name
from core.actions import NotificationAction
from core.triggers import when
from core.rules import rule
from personal.core_presence_management import PresenceState

OperationState = enum(OFF=0, ON=1, SILENTLY=2)


@rule("Security System - Trigger-Management", description="Security System - Trigger-Management", tags=[])
@when("Member of gSecurity_AssaultTrigger received update OPEN")
@when("Member of gSecurity_AssaultTrigger received update ON")
def assault_trigger(event):
    if ir.getItem("Security_OperationState").state == OperationState.OFF or ir.getItem("SpecialStateManagement").state != OperationState.NONE:
        return

    ir.getItem("Security_AlarmTime").postUpdate(Datetime.now())
    assault_trigger.log.info(
        "security-management.rules",
        "Detected Assault Attack - Alarm was triggered!"
    )

    message = "Lautloser Alarm wurde von " + \
        event.triggeringItem.label + " ausgelöst!"

    if Security_OperationState.state == OperationState.ON:
        ir.getItem("Security_Sirene").sendCommand(ON)
        message = "Lauter Alarm wurde von " + event.triggeringItem.label + " ausgelöst!"

    NotificationAction.sendBroadcastNotification(message)


@rule("Security System - Armament-Management", description="Security System - Armament-Management", tags=[])
@when("Item PresenceManagement received update " + PresenceState.AWAY_SHORT)
@when("Item PresenceManagement received update " + PresenceState.AWAY_LONG)
@when("Item Security_OperationState_AwayShort received update")
@when("Item Security_OperationState_AwayLong received update")
def armament(event):
    operationMapping = {
        0: Security_OperationState_AwayShort.state,
        2: Security_OperationState_AwayLong.state
    }

    operationState = operationMapping.get(ir.getItem(
        "PresenceManagement").state.intValue(), None)
    if operationState == None:
        return

    triggers = ir.getItem("gSecurity_AssaultTrigger").members
    trigger = next(
        (trigger for trigger in triggers if trigger.state == OPEN or trigger.state == ON), None)

    if trigger == None:
        Security_OperationState.postUpdate(operationState)
    else:
        NotificationAction.sendBroadcastNotification(
            trigger.label + " ist auf / an! Angrifferkennung bleibt aus."
        )


@rule("Security System - Disarmament-Management", description="Security System - Disarmament-Management", tags=[])
@when("Member of gSecurity_AssaultDisarmamer received update")
def disarmament(event):
    ir.getItem("Security_OperationState").postUpdate(OperationState.OFF)


@rule("Security System - Lock Closure-Management", description="Security System - Lock Closure-Management", tags=[])
@when("Member of gSecurity_LockClosureTrigger received update CLOSED")
@when("Member of gSecurity_LockClosureTrigger received update OFF")
def lock_closure(event):
    ir.getItem("Security_OperationState").postUpdate(OperationState.OFF)
    room = get_room_name(event.triggeringItem.name)
    locks = ir.getItem("gLock").members
    lock = next(
        (lock for lock in locks if lock.name.startsWith(room)), None)

    if lock != None:
        lock.sendCommand(ON)
    else:
        lock_closure.log.warn(
            "security-management.rules",
            "gLock not found for room " + room
        )


@rule("Security System - Turn off siren after X minutes", description="Security System - Turn off siren after X minutes", tags=[])
@when("Time cron 0 * * ? * * *")
def siren_autooff(event):
    autoOffTime = ir.getItem("Security_SireneAutoOff").state
    if (autoOffTime == 0 or
            ir.getItem("Security_Sirene").state != ON or
            ir.getItem("Security_AlarmTime").state == None or
            ir.getItem("Security_AlarmTime").intValue() > datetime.now(
            ) - timedelta(minutes=autoOffTime.intValue())
        ):
        return

    ir.getItem("Security_Sirene").sendCommand(OFF)
    NotificationAction.sendBroadcastNotification(
        "Alarm wurde nach " + autoOffTime + " Minuten automatisch deaktiviert."
    )
    siren_autooff.log.info(
        "security-management.rules", "Alarm was turned off automatically after " +
        autoOffTime + " minutes."
    )
