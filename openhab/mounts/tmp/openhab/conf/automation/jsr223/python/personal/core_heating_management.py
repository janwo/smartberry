from core.rules import rule
from core.triggers import when
from personal.core_heating_management import SpecialState
from personal.core_presence_management import PresenceState
from personal.core_helpers import get_room_name


@rule("Update heater on presence changes", description="Update heater on presence changes", tags=[])
@when("Item PresenceManagement received update")
@when("Item SpecialStateManagement received update")
@when("Item HeatingManagement_Thermostat_ModeDefault changed")
@when("Item HeatingManagement_Thermostat_ModeSleep changed")
@when("Item HeatingManagement_Thermostat_ModeAwayShort changed")
@when("Item HeatingManagement_Thermostat_ModeAwayLong changed")
def update_heater_on_presence_change(event):
    state = ir.getItem("HeatingManagement_Thermostat_ModeDefault").state

    if ir.getItem("SpecialStateManagement").state == SpecialState.SLEEP:
        state = ir.getItem("HeatingManagement_Thermostat_ModeSleep").state
    elif ir.getItem("PresenceManagement").state == PresenceState.AWAY_LONG:
        state = ir.getItem("HeatingManagement_Thermostat_ModeAwayLong").state
    elif ir.getItem("PresenceManagement").state == PresenceState.AWAY_SHORT:
        state = ir.getItem("HeatingManagement_Thermostat_ModeAwayShort").state

    for item in ir.getItem("gHeatingManagement_Thermostat_Mode").members:
        item.sendCommand(state)


@rule("Update heater when windows open or close", description="Update heater when windows open or close", tags=[])
@when("Member of gHeatingManagement_ContactSwitchable changed")
def update_heater_on_window_event(event):
    room = get_room_name(event.triggeringItem.name)

    # Stop all thermostats if window is open.
    if event.triggeringItem.state == OPEN:
        for thermostat in ir.getItem("gHeatingManagement_Thermostat_Mode").members:
            if thermostat.name.startsWith(room):
                thermostat.sendCommand(0)

    # No remaining opened windows after closing event?
    elif not any(member.name.startsWith(room) and member.state == OPEN for member in ir.getItem("gSensor_Contact").members):
        # Change to normal temperature.
        # It does not respect any presence or special states for simplicity.
        for thermostat in ir.getItem("gHeatingManagement_Thermostat_Mode").members:
            if thermostat.name.startsWith(room):
                thermostat.sendCommand(1)
