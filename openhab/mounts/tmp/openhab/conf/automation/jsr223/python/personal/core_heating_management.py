from core.triggers import when
from core.rules import rule
from personal.core_presence_management import PresenceState, is_presence_state
from personal.core_special_state_management import SpecialState, is_special_state
from personal.core_helpers import get_room_name


@rule("Core - Update heater on presence changes", description="Update heater on presence changes", tags=[])
@when("Item PresenceManagement received update")
@when("Item SpecialStateManagement received update")
@when("Item HeatingManagement_Thermostat_ModeDefault changed")
@when("Item HeatingManagement_Thermostat_ModeSleep changed")
@when("Item HeatingManagement_Thermostat_ModeAwayShort changed")
@when("Item HeatingManagement_Thermostat_ModeAwayLong changed")
def update_heater_on_presence_change(event):
    state = ir.getItem("HeatingManagement_Thermostat_ModeDefault").state

    if is_special_state(SpecialState.SLEEP):
        state = ir.getItem("HeatingManagement_Thermostat_ModeSleep").state
    elif is_presence_state(PresenceState.AWAY_LONG):
        state = ir.getItem("HeatingManagement_Thermostat_ModeAwayLong").state
    elif is_presence_state(PresenceState.AWAY_SHORT):
        state = ir.getItem("HeatingManagement_Thermostat_ModeAwayShort").state

    for item in ir.getItem("gHeatingManagement_Thermostat_Mode").members:
        events.sendCommand(item, state)


@rule("Core - Update heater when windows open or close", description="Update heater when windows open or close", tags=[])
@when("Member of gHeatingManagement_ContactSwitchable changed")
def update_heater_on_window_event(event):
    room = get_room_name(event.itemName)

    # Stop all thermostats if window is open.
    if event.itemState == OPEN:
        for thermostat in ir.getItem("gHeatingManagement_Thermostat_Mode").members:
            if thermostat.name.startswith(room):
                events.sendCommand(thermostat, 0)

    # No remaining opened windows after closing event?
    elif not any((member.name.startswith(room) and member.state == OPEN) for member in ir.getItem("gSensor_Contact").members):
        # Change to normal temperature.
        # It does not respect any presence or special states for simplicity.
        for thermostat in ir.getItem("gHeatingManagement_Thermostat_Mode").members:
            if thermostat.name.startswith(room):
                events.sendCommand(thermostat, 1)
