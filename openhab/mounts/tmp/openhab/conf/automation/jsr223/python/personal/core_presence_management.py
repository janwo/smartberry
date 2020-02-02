from core.rules import rule
from core.triggers import when
from core.date import hours_between, ZonedDateTime, format_date
from personal.core_helpers import get_room_name
from personal.core_presence_management import PresenceState, is_presence_state
import random


@rule("Set presence on motion.", description="Set presence on motion.", tags=[])
@when("Member of gPresenceManagement_PresenceTrigger received update ON")
def set_last_activation(event):
    events.postUpdate(ir.getItem(
        "PresenceManagement_LastPresence"), format_date(ZonedDateTime.now()))
    if not is_presence_state(PresenceState.HOME):
        events.postUpdate(ir.getItem("PresenceManagement"), PresenceState.HOME)

    room = get_room_name(event.itemName)
    presences = ir.getItem("gPresenceManagement_LastPresence").members
    presence = next(
        (presence for presence in presences if presence.name.startswith(room)), None)
    if presence != None:
        events.postUpdate(presence, format_date(ZonedDateTime.now()))
    else:
        set_last_activation.log.warn(
            "gPresenceManagement_LastPresence not found for room {}.".format(
                room)
        )


@rule("Set presence state to away in absence", description="Set presence state to away in absence", tags=[])
@when("Time cron 0 0 * ? * * *")
def check_abondance(event):
    if hours_between(ir.getItem("PresenceManagement_LastPresence").state, ZonedDateTime.now()) > ir.getItem("PresenceManagement_HoursUntilAwayLong").state:
        events.postUpdate(ir.getItem("PresenceManagement"),
                          PresenceState.AWAY_LONG)
    elif hours_between(ir.getItem("PresenceManagement_LastPresence").state, ZonedDateTime.now()) > ir.getItem("PresenceManagement_HoursUntilAwayShort").state:
        events.postUpdate(ir.getItem("PresenceManagement"),
                          PresenceState.AWAY_SHORT)


@rule("Simulate lights when away and simulation state is activated.", description="Simulate lights when away and simulation state is activated.", tags=[])
@when("Time cron 0 0/15 0 ? * * *")
def simulate_presence(event):
    if ir.getItem("PresenceManagement").state != ir.getItem("PresenceManagement_Simulation").state:
        return

    for item in ir.getItem("gPresenceManagement_SimulationItem").members:
        if random.randrange(10) <= 2:
            if item.state == ON:
                events.sendCommand(item, OFF)
            else:
                events.sendCommand(item, ON)
