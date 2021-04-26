from __future__ import unicode_literals
from core.rules import rule
from core.triggers import when
from personal.core_presence import POINT_TAGS, PresenceState, trigger_presence, get_presence, trigger_absence
from core.jsr223.scope import ir, events, OFF, ON, OPEN
from org.openhab.core.types import UnDefType
from personal.core_helpers import reload_rules, sync_group_with_tags, intersection_count, METADATA_NAMESPACE
from org.openhab.core.library.types import OnOffType, OpenClosedType
from core.metadata import set_key_value, get_key_value
from org.openhab.core.model.script.actions import Log


@rule("Core - Sync helper items of presence", description="Core - Sync helper items", tags=['core', 'core-presence'])
@when("Item added")
@when("Item updated")
@when("Item removed")
@when("System started")
def sync_presence_helpers(event):
    # Sync group gCore_Presence_PresenceTrigger with presence items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Presence_PresenceTrigger"),
        POINT_TAGS
    )

    # Reload rules
    reload_rules(
        trigger_presence_on_motion_triggers,
        trigger_presence_on_motion
    )


trigger_presence_on_motion_triggers = [
    "Member of gCore_Presence_PresenceTrigger received update"
]


@rule("Core - Trigger presence on motion.", description="Trigger presence on motion.", tags=['core', 'core-presence', 'core-reload-trigger_presence_on_motion'])
@when("Member of gCore_Presence_PresenceTrigger received update")
def trigger_presence_on_motion(event):
    item = ir.getItem(event.itemName)
    presenceStates = get_key_value(
        item.name,
        METADATA_NAMESPACE,
        'presence',
        'presence-states'
    ) or ['ON', 'OPEN']

    absenceStates = get_key_value(
        item.name,
        METADATA_NAMESPACE,
        'presence',
        'absence-states'
    ) or []

    if item.state.toFullString() in presenceStates:
        trigger_presence(item)
    
    if item.state.toFullString() in absenceStates:
        trigger_absence(item)


@rule("Core - Check for an absence presence state and update Core_Presence", description="Check presence state and update Core_Presence", tags=['core', 'core-presence'])
@when("Time cron 0 0 * ? * * *")
def check_presence(event):
    presence = get_presence()
    presenceManagement = ir.getItem("Core_Presence")

    if isinstance(presenceManagement.state, UnDefType):
        events.postUpdate(presenceManagement, presence)

    # Do not update to HOME as we only want to update to absence presence states.
    if presence == PresenceState.HOME:
        return

    # Update presence state, if it changed.
    if presence != presenceManagement.state.floatValue():
        events.postUpdate(presenceManagement, presence)
