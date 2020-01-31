from core.triggers import when
from core.rules import rule
from personal.core_helpers import get_room_name
from core.date import minutes_between, ZonedDateTime


@rule("Keep last timed outlet activation updated", description="Keep last timed outlet activation updated.", tags=[])
@when("  Member of gTimedOutletManagement_Switchable changed to ON")
def set_last_activation(event):
    activations = ir.getItem(
        "gTimedOutletManagement_LastActivation").members
    activation = next(
        (activation for activation in activations if activation.name.startsWith(event.itemName)), None)
    if activation != None:
        events.sendCommand(activation, ZonedDateTime.now())
    else:
        set_last_activation.log.warn(
            "gTimedOutletManagement_LastActivation not found for outlet {}.".format(
                event.itemName)
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
                    "gTimedOutletManagement_LastActivation or gTimedOutletManagement_ActiveDuration not found for outlet {}.".format(
                        switchable.name)
                )
                return

            if minutes_between(activation.state, ZonedDateTime.now()) > duration.state.intValue():
                events.sendCommand(switchable, OFF)
