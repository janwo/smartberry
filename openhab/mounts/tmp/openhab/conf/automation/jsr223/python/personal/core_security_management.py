from personal.core_helpers import enum, get_room_name
from core.actions import NotificationAction
from core.triggers import when
from core.rules import rule
from personal.core_presence_management import PresenceState
from personal.core_security_management import OperationState
from core.date import minutes_between, ZonedDateTime, format_date


@rule("Security System - Trigger-Management", description="Security System - Trigger-Management", tags=[])
@when("Member of gSecurity_AssaultTrigger received update OPEN")
@when("Member of gSecurity_AssaultTrigger received update ON")
def assault_trigger(event):
    if ir.getItem("Security_OperationState").state == OperationState.OFF or ir.getItem("SpecialStateManagement").state != OperationState.NONE:
        return

    events.postUpdate(ir.getItem("Security_AlarmTime"),
                      format_date(ZonedDateTime.now()))
    assault_trigger.log.info(
        "Detected Assault Attack - Alarm was triggered!"
    )

    message = "Lautloser Alarm wurde von {} ausgelöst!".format(
        ir.getItem(event.itemName).label)

    if ir.getItem("Security_OperationState").state == OperationState.ON:
        events.sendCommand(ir.getItem("Security_Sirene"), ON)
        message = "Lauter Alarm wurde von {} ausgelöst!".format(
            ir.getItem(event.itemName).label)

    NotificationAction.sendBroadcastNotification(message)


@rule("Security System - Armament-Management", description="Security System - Armament-Management", tags=[])
@when("Item PresenceManagement received update {}".format(PresenceState.AWAY_SHORT))
@when("Item PresenceManagement received update {}".format(PresenceState.AWAY_LONG))
@when("Item Security_OperationState_AwayShort received update")
@when("Item Security_OperationState_AwayLong received update")
def armament(event):
    operationMapping = {
        OperationState.OFF: ir.getItem("Security_OperationState_AwayShort").state,
        OperationState.SILENTLY: ir.getItem("Security_OperationState_AwayLong").state
    }

    operationState = operationMapping.get(ir.getItem(
        "PresenceManagement").state.intValue(), None)
    if operationState == None:
        return

    triggers = ir.getItem("gSecurity_AssaultTrigger").members
    trigger = next(
        (trigger for trigger in triggers if trigger.state == OPEN or trigger.state == ON), None)

    if trigger == None:
        events.postUpdate(ir.getItem(
            "Security_OperationState"), operationState)
    else:
        NotificationAction.sendBroadcastNotification(
            "{} ist auf / an! Angrifferkennung bleibt aus.".format(
                trigger.label)
        )


@rule("Security System - Disarmament-Management", description="Security System - Disarmament-Management", tags=[])
@when("Member of gSecurity_AssaultDisarmamer received update")
def disarmament(event):
    events.postUpdate(ir.getItem("Security_OperationState"),
                      OperationState.OFF)


@rule("Security System - Lock Closure-Management", description="Security System - Lock Closure-Management", tags=[])
@when("Member of gSecurity_LockClosureTrigger received update CLOSED")
@when("Member of gSecurity_LockClosureTrigger received update OFF")
def lock_closure(event):
    ir.getItem("Security_OperationState").postUpdate(OperationState.OFF)
    room = get_room_name(event.itemName)
    locks = ir.getItem("gLock").members
    lock = next(
        (lock for lock in locks if lock.name.startswith(room)), None)

    if lock != None:
        events.sendCommand(lock, ON)
    else:
        lock_closure.log.warn(
            "gLock not found for room {}.".format(room)
        )


@rule("Security System - Turn off siren after X minutes", description="Security System - Turn off siren after X minutes", tags=[])
@when("Time cron 0 * * ? * * *")
def siren_autooff(event):
    autoOffTime = ir.getItem("Security_SireneAutoOff").state
    if (autoOffTime == 0 or
            ir.getItem("Security_Sirene").state != ON or
            isinstance(ir.getItem("Security_AlarmTime").state, UnDefType) or
            minutes_between(ir.getItem("Security_AlarmTime").state, ZonedDateTime.now(
            )) > autoOffTime.intValue()
        ):
        return

    events.sendCommand(ir.getItem("Security_Sirene"), OFF)
    NotificationAction.sendBroadcastNotification(
        "Alarm wurde nach {} Minuten automatisch deaktiviert.".format(
            autoOffTime)
    )
    siren_autooff.log.info(
        "Alarm was turned off automatically after {} minutes.".format(
            autoOffTime)
    )
