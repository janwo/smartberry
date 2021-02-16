from core.triggers import when
from core.rules import rule
from personal.core_helpers import has_same_location
from personal.core_heating import HeatingState
from core.jsr223.scope import ir, UnDefType, events, OPEN


@rule("Core - Check conditions to update heater values", description="Check conditions to update heater values", tags=['core', 'heating'])
@when("Time cron 0 0 * ? * * *")
@when("Member of gCore_Heating_ContactSwitchable received update")
@when("Item Core_Heating_Thermostat_ModeDefault received update")
def update_heater_on_contact_trigger(event):
    for member in ir.getItem("gCore_Heating_Thermostat_Mode").members:
        if any((contact.state == OPEN and has_same_location(contact, member)) for contact in ir.getItem("gCore_Heating_ContactSwitchable").members):
            events.sendCommand(member, HeatingState.OFF)
        else:
            state = ir.getItem("Core_Heating_Thermostat_ModeDefault").state
            events.sendCommand(member, state.intValue())
