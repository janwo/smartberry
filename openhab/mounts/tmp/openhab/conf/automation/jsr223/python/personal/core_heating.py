from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from personal.core_helpers import get_date, get_date_string, reload_rules, METADATA_NAMESPACE, get_location, sync_group_with_tags, get_items_of_any_tags, get_all_semantic_items
from personal.core_heating import TEMPERATURE_MEASUREMENT_POINT_TAGS, OPEN_CONTACT_EQUIPMENT_TAGS, OPEN_CONTACT_POINT_TAGS, HEATING_EQUIPMENT_TAGS, HEATING_POINT_TAGS, HeatingState
from core.jsr223.scope import ir, UnDefType, events, OPEN
from core.metadata import set_key_value, get_key_value, remove_key_value
from core.date import minutes_between, ZonedDateTime


@rule("Core - Sync helper items of heating", description="Core - Sync helper items", tags=['core', 'core-heating'])
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

    # Reload rules
    reload_rules(
        update_heater_on_contact_trigger_triggers,
        update_heater_on_contact_trigger
    )


update_heater_on_contact_trigger_triggers = [
    "Time cron 0 0/5 * ? * * *",
    "Descendent of gCore_Heating_ContactSwitchable received update",
    "Item Core_Heating_Thermostat_ModeDefault received update"
]


@rule("Core - Check conditions to update heater values", description="Check conditions to update heater values", tags=['core', 'core-heating', 'core-reload-update_heater_on_contact_trigger'])
@when("Time cron 0 0/5 * ? * * *")
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

    shutdownHeating = False
    if len(openContactLocations):
        contactSince = get_key_value(
            heaterMode.name,
            METADATA_NAMESPACE,
            'heating',
            'open-contact-since'
        )

        if not contactSince:
            contactSince = get_date_string(ZonedDateTime.now())
            set_key_value(
                heaterMode.name,
                METADATA_NAMESPACE,
                'heating',
                'open-contact-since',
                contactSince
            )

        heatingShutdownMinutesItem = ir.getItem(
            "Core_Heating_Thermostat_OpenContactShutdownMinutes")
        shutdownHeating = (
            not isinstance(heatingShutdownMinutesItem.state, UnDefType) and
            heatingShutdownMinutesItem.state.floatValue() != 0 and
            minutes_between(
                get_date(contactSince),
                ZonedDateTime.now()
            ) > heatingShutdownMinutesItem.state.floatValue()
        )
    else:
        remove_key_value(
            heaterMode.name,
            METADATA_NAMESPACE,
            'heating',
            'open-contact-since'
        )

    for point in get_all_semantic_items(HEATING_EQUIPMENT_TAGS, HEATING_POINT_TAGS):
        location = get_location(point)
        if location:
            state = heaterMode.state.toFullString()
            if shutdownHeating or location.name in openContactLocations:
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
                events.sendCommand(point, state)
