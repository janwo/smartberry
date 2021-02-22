from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from personal.core_helpers import has_same_location, sync_group_with_tags, get_items_of_any_tags
from personal.core_heating import HeatingState
from core.jsr223.scope import ir, UnDefType, events, OPEN

TAGS = {
    "contactSwitchable": ["Core-Heating-Window"],
    "thermostatMode": ["Core-Heating-Mode"]
}


@rule("Core - Sync helper items", description="Core - Sync helper items", tags=['core', 'heating'])
@when("Item added")
@when("Item updated")
@when("Item removed")
def sync_heating_helpers(event):
    # Sync group gCore_Heating_ContactSwitchable with contact items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Heating_ContactSwitchable"),
        TAGS["contactSwitchable"]
    )


@rule("Core - Check conditions to update heater values", description="Check conditions to update heater values", tags=['core', 'heating'])
@when("Time cron 0 0 * ? * * *")
@when("Member of gCore_Heating_ContactSwitchable received update")
@when("Item Core_Heating_Thermostat_ModeDefault received update")
def update_heater_on_contact_trigger(event):
    for item in get_items_of_any_tags(TAGS["thermostatMode"]):
        if any((contact.state == OPEN and has_same_location(contact, item)) for contact in ir.getItem("gCore_Heating_ContactSwitchable").members):
            events.sendCommand(item, int(HeatingState.OFF))
        else:
            state = ir.getItem("Core_Heating_Thermostat_ModeDefault").state
            events.sendCommand(item, state.intValue())
