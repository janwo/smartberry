from personal.core_helpers import get_room_name
from core.triggers import when
from core.rules import rule
from personal.core_presence_management import PresenceState, is_presence_state
from personal.core_security_management import OperationState, is_security_state
from personal.core_special_state_management import SpecialState, is_special_state
from core.date import minutes_between, ZonedDateTime, format_date
from personal.core_misc import BroadcastType, broadcast


@rule("Core - Security System - Trigger-Management", description="Security System - Trigger-Management", tags=[])
@when("Member of gSecurity_AssaultTrigger received update OPEN")
@when("Member of gSecurity_AssaultTrigger received update ON")
def assault_trigger(event):
    if (
        is_security_state(OperationState.OFF) or
        not is_special_state(SpecialState.DEFAULT)
    ):
        return

    events.postUpdate(
        ir.getItem("Security_AlarmTime"),
        format_date(ZonedDateTime.now())
    )

    label = ir.getItem(event.itemName).label
    message = "Silent alarm was triggered by {}!".format(label)
    if is_security_state(OperationState.ON):
        message = "Striking alarm was triggered by {}!".format(label)
        events.sendCommand(ir.getItem("Security_Sirene"), ON)

    broadcast(message,  BroadcastType.ATTENTION)


@rule("Core - Security System - Armament-Management", description="Security System - Armament-Management", tags=[])
@when("Item PresenceManagement received update {}".format(PresenceState.AWAY_SHORT))
@when("Item PresenceManagement received update {}".format(PresenceState.AWAY_LONG))
@when("Item Security_OperationState_AwayShort received update")
@when("Item Security_OperationState_AwayLong received update")
def armament(event):
    operationMapping = {
        PresenceState.AWAY_SHORT: ir.getItem("Security_OperationState_AwayShort").state,
        PresenceState.AWAY_LONG: ir.getItem(
            "Security_OperationState_AwayLong").state
    }

    presenceState = ir.getItem(
        "PresenceManagement").state
    operationState = operationMapping.get(PresenceState.HOME if isinstance(
        presenceState, UnDefType) else presenceState.intValue(), None)
    if operationState == None:
        return

    triggers = ir.getItem("gSecurity_AssaultTrigger").members
    trigger = next(
        (trigger for trigger in triggers if trigger.state == OPEN or trigger.state == ON), None)

    if trigger == None:
        events.postUpdate(ir.getItem(
            "Security_OperationState"), operationState)
    else:
        broadcast("{} is in an opened state. No initiation into assault detection.".format(
            trigger.label
        ))


@rule("Core - Security System - Disarmament-Management", description="Security System - Disarmament-Management", tags=[])
@when("Member of gSecurity_AssaultDisarmamer received update")
def disarmament(event):
    events.postUpdate(
        ir.getItem("Security_OperationState"),
        OperationState.OFF
    )


@rule("Core - Security System - Lock Closure-Management", description="Security System - Lock Closure-Management", tags=[])
@when("Member of gSecurity_LockClosureTrigger received update CLOSED")
@when("Member of gSecurity_LockClosureTrigger received update OFF")
def lock_closure(event):
    room = get_room_name(event.itemName)
    locks = ir.getItem("gLock").members
    lock = next(
        (lock for lock in locks if lock.name.startswith(room)), None)

    if lock != None:
        events.sendCommand(lock, ON)
    else:
        text = "gLock not found for room {}.".format(room)
        broadcast(text)


@rule("Core - Security System - Turn off siren after X minutes", description="Security System - Turn off siren after X minutes", tags=[])
@when("Time cron 0 * * ? * * *")
def siren_autooff(event):
    autoOffTime = ir.getItem("Security_SireneAutoOff")
    if isinstance(autoOffTime.state, UnDefType):
        text = "No value was set for {}.".format(autoOffTime.name)
        broadcast(text)
        return

    if (autoOffTime.state.intValue() == 0 or
            ir.getItem("Security_Sirene").state != ON or
            isinstance(ir.getItem("Security_AlarmTime").state, UnDefType) or
            minutes_between(ir.getItem("Security_AlarmTime").state, ZonedDateTime.now(
                )) > autoOffTime.state.intValue()
            ):
        return

    events.sendCommand(ir.getItem("Security_Sirene"), OFF)
    message = "Alarm was automatically disabled after {} minutes.".format(
        autoOffTime.state)
    broadcast(
        message,
        BroadcastType.ATTENTION
    )
