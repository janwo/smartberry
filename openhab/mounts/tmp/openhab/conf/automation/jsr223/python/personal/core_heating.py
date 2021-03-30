from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from personal.core_helpers import METADATA_NAMESPACE, get_location, sync_group_with_tags, get_items_of_any_tags, get_all_semantic_items
from personal.core_heating import TEMPERATURE_MEASUREMENT_POINT_TAGS, OPEN_CONTACT_EQUIPMENT_TAGS, OPEN_CONTACT_POINT_TAGS, HEATING_EQUIPMENT_TAGS, HEATING_POINT_TAGS, HeatingState
from core.jsr223.scope import ir, UnDefType, events, OPEN
from core.metadata import set_key_value, get_key_value


@rule("Core - Sync helper items", description="Core - Sync helper items", tags=['core', 'heating'])
@when("Item added")
@when("Item updated")
@when("Item removed")
@when("System started")
def sync_heating_helpers(event):
    # Sync group gCore_Heating_ContactSwitchable with contact items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Heating_ContactSwitchable"),
        OPEN_CONTACT_EQUIPMENT_TAGS
    )

    # Sync group gCore_Heating_Temperature with temperature items.
    sync_group_with_tags(
        ir.getItem("gCore_Heating_Temperature"),
        TEMPERATURE_MEASUREMENT_POINT_TAGS
    )


@rule("Core - Check conditions to update heater values", description="Check conditions to update heater values", tags=['core', 'heating'])
@when("Time cron 0 0 * ? * * *")
@when("Descendent of gCore_Heating_ContactSwitchable received update")
@when("Item Core_Heating_Thermostat_ModeDefault received update")
def update_heater_on_contact_trigger(event):
    heaterMode = ir.getItem("Core_Heating_Thermostat_ModeDefault")
    if isinstance(heaterMode.state, UnDefType):
        return

    openContactLocations = map(
        lambda r: r.name,
        filter(
            lambda r: r,
            map(
                lambda contact: get_location(contact),
                filter(
                    lambda contact: contact.state == OPEN,
                    get_all_semantic_items(
                        OPEN_CONTACT_EQUIPMENT_TAGS,
                        OPEN_CONTACT_POINT_TAGS
                    )
                )
            )
        )
    )

    for point in get_all_semantic_items(HEATING_EQUIPMENT_TAGS, HEATING_POINT_TAGS):
        location = get_location(point)
        if location:
            state = heaterMode.state.toFullString()
            if location.name in openContactLocations:
                state = str(HeatingState.OFF)

            pointCommandMap = get_key_value(
                point.name,
                METADATA_NAMESPACE,
                'heating',
                'command-map'
            )
            if pointCommandMap and state in pointCommandMap:
                state = pointCommandMap[state]
            if isinstance(point.state, UnDefType) or point.state.toFullString() != state:
                events.sendCommand(
                    point,
                    state
                )
