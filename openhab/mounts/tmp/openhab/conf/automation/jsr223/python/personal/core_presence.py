from __future__ import unicode_literals
from core.rules import rule
from core.triggers import when
from personal.core_presence import POINT_TAGS, PresenceState, trigger_presence, get_presence
from core.jsr223.scope import ir, events, OFF, ON
from org.openhab.core.types import UnDefType
from personal.core_helpers import sync_group_with_tags, intersection_count
from org.openhab.core.library.types import OnOffType


@rule("Core - Sync helper items", description="Core - Sync helper items", tags=['core', 'presence'])
@when("Item added")
@when("Item updated")
@when("Item removed")
def sync_presence_helpers(event):
    # Sync group gCore_Presence_PresenceTrigger with presence items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Presence_PresenceTrigger"),
        POINT_TAGS
    )


@rule("Core - Trigger presence on motion.", description="Trigger presence on motion.", tags=['core', 'presence'])
@when("Member of gCore_Presence_PresenceTrigger received update")
def trigger_presence_on_motion(event):
    item = ir.getItem(event.itemName)
    if item.getStateAs(OnOffType) == ON:
        trigger_presence(item)


@rule("Core - Check for an absence presence state and update Core_Presence", description="Check presence state and update Core_Presence", tags=['core', 'presence'])
@when("Time cron 0 0 * ? * * *")
def check_presence(event):
    presenceManagement = ir.getItem("Core_Presence")
    presence = get_presence()

    if isinstance(presenceManagement.state, UnDefType):
        events.postUpdate(presenceManagement, presence)

    # Do not update to HOME as we only want to update to absence presence states.
    if presence is PresenceState.HOME:
        return

    # Update presence state, if it changed.
    if presence is not presenceManagement.state.floatValue():
        events.postUpdate(presenceManagement, presence)
