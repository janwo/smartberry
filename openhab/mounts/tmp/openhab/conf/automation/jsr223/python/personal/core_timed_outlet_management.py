from core.triggers import when
from core.rules import rule
from datetime import datetime, timedelta
from personal.core_helpers import get_room_name


@rule("Keep last timed outlet activation updated", description="Keep last timed outlet activation updated.", tags=[])
@when("  Member of gTimedOutletManagement_Switchable changed to ON")
def set_last_activation(event):
    activations = ir.getItem(
        "gTimedOutletManagement_LastActivation").members
    activation = next(
        (activation for activation in activations if activation.name.startsWith(event.triggeringItem.name)), None)
    if activation != None:
        events.sendCommand(activation, datetime.now())
    else:
        set_last_activation.log.warn(
            "timed-outlet-management.rules",
            "gTimedOutletManagement_LastActivation not found for outlet " +
            event.triggeringItem.name
        )


@rule("Manage elapsed outlets", description="Manage elapsed outlets", tags=[])
@when("Time cron 0 * * ? * * *")
@when("Member of gTimedOutletManagement_ActiveDuration received update")
def manage_elapsed(event):
    for switchable in ir.getItem("gTimedOutletManagement_Switchable").members:
        if switchable.state == ON:
            activations = ir.getItem(
                "gTimedOutletManagement_LastActivation").members
            activation = next((activation for activation in activations if activation.name.startsWith(
                switchable.name)), None)
            durations = ir.getItem(
                "gTimedOutletManagement_ActiveDuration").members
            duration = next((duration for duration in durations if duration.name.startsWith(
                switchable.name)), None)

            if activation == None or duration == None:
                manage_elapsed.log.warn(
                    "timed-outlet-management.rules",
                    "gTimedOutletManagement_LastActivation or gTimedOutletManagement_ActiveDuration not found for outlet " + s.name
                )
                return

            if datetime.now() - timedelta(minutes=duration.state.intValue()) > activation.state.intValue():
                events.sendCommand(switchable, OFF)
