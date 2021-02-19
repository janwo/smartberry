from core.triggers import when
from core.rules import rule
from personal.core_helpers import get_equipment_points, get_parent_with_group, intersection_count, get_date, METADATA_NAMESPACE, create_helper_item, get_helper_item, remove_unlinked_helper_items
from core.date import minutes_between, format_date, ZonedDateTime
from personal.core_broadcast import broadcast
from core.metadata import set_key_value, get_key_value
from core.jsr223.scope import ir, events, ON, OFF
from org.openhab.core.types import UnDefType
from org.openhab.core.model.script.actions import Log
from org.openhab.core.library.types import OnOffType

POINT_TAGS = [
    "Switch"
]


@rule("Core - Keep last timed outlet activation updated", description="Keep last timed outlet activation updated.", tags=['core', 'timed-outlets'])
@when("Descendent of gCore_TimedOutlets_Switchable changed to ON")
def set_last_activation(event):
    item = ir.getItem(event.itemName)
    if (
        # Is target item:
        'gCore_TimedOutlets_Switchable' in item.getGroupNames() or
        # Is Switch child of target item:
        intersection_count(item.getTags(), POINT_TAGS) > 0
    ):
        set_key_value(
            get_parent_with_group(
                item,
                'gCore_TimedOutlets_Switchable'
            ).name,
            METADATA_NAMESPACE,
            'timed-outlet',
            "last-update",
            format_date(ZonedDateTime.now())
        )


@rule("Core - Manage elapsed outlets", description="Manage elapsed outlets", tags=['core', 'timed-outlets'])
@when("Time cron 0 * * ? * * *")
@when("Member of gCore_TimedOutlets_ActiveDuration received update")
def manage_elapsed(event):
    for switchableGroup in ir.getItem("gCore_TimedOutlets_Switchable").members:
        switchedOnSwitchables = filter(
            lambda s: s.getStateAs(OnOffType) == ON,
            get_equipment_points(switchableGroup, None, POINT_TAGS)
        )
        if switchedOnSwitchables:
            lastUpdate = get_key_value(
                switchableGroup.name,
                METADATA_NAMESPACE,
                'timed-outlet',
                'last-update'
            )
            durationItem = get_helper_item(
                switchableGroup,
                'timed-outlet',
                'duration-item'
            )

            if not lastUpdate or not durationItem or isinstance(durationItem.state, UnDefType):
                broadcast("gCore_TimedOutlets_ActiveDuration not found for outlet {}.".format(
                    switchableGroup.name))
                return

            if minutes_between(get_date(lastUpdate), ZonedDateTime.now()) > durationItem.state.floatValue():
                for switchable in switchedOnSwitchables:
                    events.sendCommand(switchable, OFF)


@rule("Core - Create timed outlet helper items", description="Create helper items", tags=['core', 'timed-outlets'])
@when("Item added")
@when("Item removed")
@when("Item updated")
def sync_timed_outlets_helpers(event):
    for outlet in ir.getItem("gCore_TimedOutlets_Switchable").members:
        create_helper_item(
            outlet,
            'timed-outlet',
            "duration-item",
            "Number",
            "time",
            "Einschaltdauer von {0}".format(outlet.label.encode('utf-8')),
            ["gCore_TimedOutlets_ActiveDuration"],
            ["Point"]
        )

    remove_unlinked_helper_items()
