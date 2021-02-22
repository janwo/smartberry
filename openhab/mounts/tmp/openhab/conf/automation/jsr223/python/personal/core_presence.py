from __future__ import unicode_literals
from core.rules import rule
from core.triggers import when
from personal.core_presence import POINT_TAGS, EQUIPMENT_TAGS, PresenceState, trigger_presence, get_presence
from personal.core_broadcast import BroadcastType, broadcast
from core.jsr223.scope import ir, events, OFF, ON
from org.openhab.core.types import UnDefType
from personal.core_helpers import sync_group_with_tags, intersection_count


@rule("Core - Sync helper items", description="Core - Sync helper items", tags=['core', 'presence'])
@when("Item added")
@when("Item updated")
@when("Item removed")
def sync_presence_helpers(event):
    # Sync group gCore_Presence_PresenceTrigger with presence items - it's needed to create triggers on it
    sync_group_with_tags(
        ir.getItem("gCore_Presence_PresenceTrigger"),
        EQUIPMENT_TAGS
    )


@rule("Core - Trigger presence on motion.", description="Trigger presence on motion.", tags=['core', 'presence'])
@when("Descendent of gCore_Presence_PresenceTrigger received update ON")
def trigger_presence_on_motion(event):
    item = ir.getItem(event.itemName)
    if (
        # Is target item:
        'gCore_Presence_PresenceTrigger' in item.getGroupNames() or
        # Is Switch child of target item:
        intersection_count(item.getTags(), POINT_TAGS) > 0
    ):
        trigger_presence(item)


@rule("Core - Check presence state and update Core_Presence", description="Check presence state and update Core_Presence", tags=['core', 'presence'])
@when("Time cron 0 0 * ? * * *")
def check_presence(event):
    presenceManagement = ir.getItem("Core_Presence")
    state = get_presence(presenceManagement)
    if isinstance(presenceManagement.state, UnDefType) or state != presenceManagement.state.floatValue():
        events.postUpdate(presenceManagement, state)
