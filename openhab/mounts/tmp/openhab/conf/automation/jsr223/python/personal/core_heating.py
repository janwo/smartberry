from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from personal.core_helpers import has_same_location, sync_group_with_tags, get_items_of_any_tags, get_all_equipment_points
from personal.core_heating import OPEN_CONTACT_EQUIPMENT_TAGS, OPEN_CONTACT_POINT_TAGS, HEATING_EQUIPMENT_TAGS, HEATING_POINT_TAGS, HeatingState
from core.jsr223.scope import ir, UnDefType, events, OPEN


@rule("Core - Sync helper items", description="Core - Sync helper items", tags=['core', 'heating'])
@when("Item added")
@when("Item updated")
@when("Item removed")
def sync_heating_helpers(event):
    # Sync group gCore_Heating_ContactSwitchable with contact items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Heating_ContactSwitchable"),
        OPEN_CONTACT_EQUIPMENT_TAGS
    )


@rule("Core - Check conditions to update heater values", description="Check conditions to update heater values", tags=['core', 'heating'])
@when("Time cron 0 0 * ? * * *")
@when("Member of gCore_Heating_ContactSwitchable received update")
@when("Item Core_Heating_Thermostat_ModeDefault received update")
def update_heater_on_contact_trigger(event):
    heaterState = ir.getItem("Core_Heating_Thermostat_ModeDefault").state
    for point in get_all_equipment_points(HEATING_EQUIPMENT_TAGS, HEATING_POINT_TAGS):
        if any((
            contact.state == OPEN and
            has_same_location(contact, point)
        ) for contact in get_all_equipment_points(OPEN_CONTACT_EQUIPMENT_TAGS, OPEN_CONTACT_POINT_TAGS)):
            events.sendCommand(
                point,
                int(HeatingState.OFF)
            )

        elif not isinstance(heaterState, UnDefType):
            events.sendCommand(
                point,
                heaterState.intValue()
            )
