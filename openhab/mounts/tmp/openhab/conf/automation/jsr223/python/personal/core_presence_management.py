from core.rules import rule
from core.triggers import when
from personal.core_helpers import enum, get_room_name
from datetime import datetime, timedelta
import random

PresenceState = enum(HOME=1, AWAY_SHORT=0, AWAY_LONG=2)


@rule("Set presence on motion.", description="Set presence on motion.", tags=[])
@when("Member of gPresenceManagement_PresenceTrigger received update ON")
def set_last_activation(event):
    events.postUpdate(ir.getItem(
        "PresenceManagement_LastPresence"), datetime.now())
    if ir.getItem("PresenceManagement").state != PresenceState.HOME:
        events.postUpdate(ir.getItem("PresenceManagement"), PresenceState.HOME)

    room = get_room_name(event.triggeringItem.name)
    presences = ir.getItem("gPresenceManagement_LastPresence").members
    presence = next(
        (presence for presence in presences if presences.name.startsWith(room)), None)
    if presence != None:
        events.postUpdate(presence, datetime.now())
    else:
        set_last_activation.log.warn(
            "gPresenceManagement_LastPresence not found for room {}.".format(
                room)
        )


@rule("Set presence state to away in absence", description="Set presence state to away in absence", tags=[])
@when("Time cron 0 0 * ? * * *")
def check_abondance(event):
    if datetime.now() - timedelta(minutes=ir.getItem("PresenceManagement_HoursUntilAwayLong").state.intValue() > ir.getItem("PresenceManagement_LastPresence").state.intValue()):
        events.postUpdate(ir.getItem("PresenceManagement"),
                          PresenceState.AWAY_LONG)
    elif datetime.now() - timedelta(minutes=ir.getItem("PresenceManagement_HoursUntilAwayShort").state.intValue() > ir.getItem("PresenceManagement_LastPresence").state.intValue()):
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
