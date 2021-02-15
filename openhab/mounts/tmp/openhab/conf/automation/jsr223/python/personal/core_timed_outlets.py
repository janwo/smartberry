from core.triggers import when
from core.rules import rule
from personal.core_helpers import get_date, METADATA_NAMESPACE, create_helper_item, get_helper_item, remove_unlinked_helper_items
from core.date import minutes_between, format_date, ZonedDateTime
from personal.core_broadcast import broadcast
from core.metadata import set_key_value, get_key_value
from core.jsr223.scope import ir, events, ON, OFF
from org.openhab.core.types import UnDefType
from org.openhab.core.model.script.actions import Log


@rule("Core - Keep last timed outlet activation updated", description="Keep last timed outlet activation updated.", tags=['core', 'timed-outlets'])
@when("Member of gCore_TimedOutlets_Switchable changed to ON")
def set_last_activation(event):
    set_key_value(
        event.itemName,
        METADATA_NAMESPACE,
        'timed-outlet',
        "last-update",
        format_date(ZonedDateTime.now())
    )


@rule("Core - Manage elapsed outlets", description="Manage elapsed outlets", tags=['core', 'timed-outlets'])
@when("Time cron 0 * * ? * * *")
@when("Member of gCore_TimedOutlets_ActiveDuration received update")
def manage_elapsed(event):
    for switchable in ir.getItem("gCore_TimedOutlets_Switchable").members:
        if switchable.state == ON:
            lastUpdate = get_key_value(
                switchable.name,
                METADATA_NAMESPACE,
                'timed-outlet',
                'last-update'
            )
            durationItem = get_helper_item(
                switchable,
                'timed-outlet',
                'duration-item'
            )

            Log.logInfo(
                "manage_elapsed timed outlet",
                "durationItem {} lastUpdate {}".format(
                    durationItem, lastUpdate)
            )

            if not lastUpdate or not durationItem or isinstance(durationItem.state, UnDefType):
                broadcast("gCore_TimedOutlets_ActiveDuration not found for outlet {}.".format(
                    switchable.name))
                return

            if minutes_between(get_date(lastUpdate), ZonedDateTime.now()) > durationItem.state.floatValue():
                events.sendCommand(switchable, OFF)


@rule("Core - Create timed outlet helper items", description="Create helper items", tags=['core', 'timed-outlets'])
@when("Item added")
@when("Item removed")
@when("Item updated")
def sync_helper_items(event):
    for outlet in ir.getItem("gCore_TimedOutlets_Switchable").members:
        create_helper_item(
            outlet,
            'timed-outlet',
            "duration-item",
            "Number",
            "time",
            "Einschaltdauer von {0} [ % d min]".format(outlet.label),
            ["gCore_TimedOutlets_ActiveDuration"],
            ["Point"]
        )

    remove_unlinked_helper_items()
