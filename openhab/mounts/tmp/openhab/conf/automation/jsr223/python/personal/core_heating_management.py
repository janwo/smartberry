from core.triggers import when
from core.rules import rule
from personal.core_presence_management import PresenceState, get_presence
from personal.core_special_state_management import SpecialState, is_special_state
from personal.core_helpers import get_location, has_same_location
from core.jsr223.scope import ir, UnDefType, events


@rule("Core - Check conditions to update heater values", description="Check conditions to update heater values", tags=[])
@when("Time cron 0 0 * ? * * *")
@when("Member of gHeatingManagement_ContactSwitchable received update")
def update_heater_on_presence_change(event):
    for member in ir.getItem("gHeatingManagement_Thermostat_Mode").members:
        if any((contact.state == OPEN and has_same_location(contact, member)) for contact in ir.getItem("gHeatingManagement_ContactSwitchable").members):
            events.sendCommand(member, 0)
        else:
            state = ir.getItem(
                "HeatingManagement_Thermostat_ModeDefault").state
            if is_special_state(SpecialState.SLEEP):
                state = ir.getItem(
                    "HeatingManagement_Thermostat_ModeSleep").state
            else:
                presence = get_presence(member)
                if presence == PresenceState.AWAY_LONG:
                    state = ir.getItem(
                        "HeatingManagement_Thermostat_ModeAwayLong").state
                elif presence == PresenceState.AWAY_SHORT:
                    state = ir.getItem(
                        "HeatingManagement_Thermostat_ModeAwayShort").state

            events.sendCommand(member, state)
