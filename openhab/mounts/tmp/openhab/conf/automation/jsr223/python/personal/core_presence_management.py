from core.rules import rule
from core.triggers import when
from core.date import hours_between, ZonedDateTime, format_date
from personal.core_presence_management import PresenceState, trigger_presence, get_presence
from personal.core_broadcast import BroadcastType, broadcast
from random import randint


@rule("Core - Trigger presence on motion.", description="Trigger presence on motion.", tags=[])
@when("Member of gPresenceManagement_PresenceTrigger received update ON")
def trigger_presence(event):
    item = ir.getItem(event.itemName)
    trigger_presence(item)


@rule("Core - Check presence state and update PresenceManagement", description="Check presence state and update PresenceManagement", tags=[])
@when("Time cron 0 0 * ? * * *")
def check_presence(event):
    presenceManagement = ir.getItem("PresenceManagement")
    state = get_presence(presenceManagement)
    if isinstance(presenceManagement.state, UnDefType) or state != presenceManagement.state.intValue():
        events.postUpdate(presenceManagement, state)


@rule("Core - Simulate lights when away and simulation state is activated.", description="Simulate lights when away and simulation state is activated.", tags=[])
@when("Time cron 0 0/5 0 ? * * *")
def simulate_presence(event):
    simulateOnPresenceState = ir.getItem("PresenceManagement_Simulation")
    if isinstance(simulateOnPresenceState.state, UnDefType):
        text = "No value set for {}.".format(simulateOnPresenceState.name)
        broadcast(text)
        return

    if get_presence() == simulateOnPresenceState.state.intValue():
        for item in ir.getItem("gPresenceManagement_SimulationItem").members:
            if randint(0, 10) <= 2:
                if item.state == ON:
                    events.sendCommand(item, OFF)
                else:
                    events.sendCommand(item, ON)
