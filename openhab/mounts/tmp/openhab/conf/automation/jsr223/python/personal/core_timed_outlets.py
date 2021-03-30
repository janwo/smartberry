from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from personal.core_helpers import sync_group_with_tags, get_date_string, get_semantic_items, get_parents_with_condition, intersection_count, get_date, METADATA_NAMESPACE, create_helper_item, get_helper_item
from core.date import minutes_between, ZonedDateTime
from personal.core_broadcast import broadcast
from core.metadata import set_key_value, get_key_value, set_value
from core.jsr223.scope import ir, events, ON, OFF
from org.openhab.core.types import UnDefType
from org.openhab.core.model.script.actions import Log
from org.openhab.core.library.types import OnOffType


EQUIPMENT_TAGS = [
    "CoreTimedOutlet"
]

POINT_TAGS = [
    "Switch"
]


@rule("Core - Create timed outlet helper items", description="Create helper items", tags=['core', 'timed-outlets'])
@when("Item added")
@when("Item removed")
@when("Item updated")
@when("System started")
def sync_timed_outlets_helpers(event):
    # Sync group gCore_TimedOutlets_Switchable with outlet items
    outletMembers = sync_group_with_tags(
        ir.getItem("gCore_TimedOutlets_Switchable"),
        EQUIPMENT_TAGS
    )

    for outlet in outletMembers:
        helperItem = create_helper_item(
            of=outlet,
            namespace='timed-outlet',
            name="duration-item",
            item_type="Number",
            category="time",
            label="Einschaltdauer von {0}".format(outlet.label),
            groups=["gCore_TimedOutlets_ActiveDuration"],
            tags=["Point"]
        )

        set_value(
            helperItem.name,
            'cellWidget',
            'oh-knob-cell'
        )

        set_key_value(
            helperItem.name,
            'cellWidget',
            'label',
            '=items.{0}.title'.format(helperItem.name)
        )

        set_key_value(
            helperItem.name,
            'cellWidget',
            'icon',
            'oh:time'
        )

        set_key_value(
            helperItem.name,
            'cellWidget',
            'max',
            10080
        )

        set_value(
            helperItem.name,
            'listWidget',
            'oh-stepper-item'
        )

        set_key_value(
            helperItem.name,
            'listWidget',
            'subtitle',
            '=items.{0}.displayState'.format(helperItem.name)
        )

        set_key_value(
            helperItem.name,
            'listWidget',
            'icon',
            'oh:time'
        )

        set_key_value(
            helperItem.name,
            'listWidget',
            'max',
            10080
        )

        set_key_value(
            helperItem.name,
            'stateDescription',
            'pattern',
            '%dmin'
        )

        set_key_value(
            helperItem.name,
            'stateDescription',
            'min',
            0
        )

        set_key_value(
            helperItem.name,
            'stateDescription',
            'max',
            10080
        )

        set_key_value(
            helperItem.name,
            'stateDescription',
            'step',
            15
        )


@rule("Core - Keep last timed outlet activation updated", description="Keep last timed outlet activation updated.", tags=['core', 'timed-outlets'])
@when("Descendent of gCore_TimedOutlets_Switchable received update")
def set_last_outlet_activation(event):
    item = ir.getItem(event.itemName)
    if item.getStateAs(OnOffType) == ON and (
        # Is target item:
        'gCore_TimedOutlets_Switchable' in item.getGroupNames() or
        # Is Switch child of target item:
        intersection_count(item.getTags(), POINT_TAGS) > 0
    ):
        for parentOutlet in get_parents_with_condition(
            item,
            lambda item: 'gCore_TimedOutlets_Switchable' in item.getGroupNames()
        ):
            set_key_value(
                parentOutlet.name,
                METADATA_NAMESPACE,
                'timed-outlet',
                "last-update",
                get_date_string(ZonedDateTime.now())
            )


@rule("Core - Manage elapsed outlets", description="Manage elapsed outlets", tags=['core', 'timed-outlets'])
@when("Time cron 0 * * ? * * *")
@when("Member of gCore_TimedOutlets_ActiveDuration received update")
def manage_elapsed(event):
    for timedOutletGroup in ir.getItem("gCore_TimedOutlets_Switchable").members:
        activatedTimedOutletPoints = filter(
            lambda s: s.getStateAs(OnOffType) == ON,
            get_semantic_items(timedOutletGroup, None, POINT_TAGS)
        )
        if activatedTimedOutletPoints:
            lastUpdate = get_key_value(
                timedOutletGroup.name,
                METADATA_NAMESPACE,
                'timed-outlet',
                'last-update'
            )
            durationItem = get_helper_item(
                timedOutletGroup,
                'timed-outlet',
                'duration-item'
            )

            if (
                lastUpdate and
                durationItem and
                minutes_between(
                    get_date(lastUpdate),
                    ZonedDateTime.now()
                ) > durationItem.state.floatValue()
            ):
                for activatedTimedOutletPoint in activatedTimedOutletPoints:
                    events.sendCommand(activatedTimedOutletPoint, OFF)
