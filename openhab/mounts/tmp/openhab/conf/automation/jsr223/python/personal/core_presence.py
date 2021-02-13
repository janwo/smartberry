from core.rules import rule
from core.triggers import when
from personal.core_presence import PresenceState, trigger_presence, get_presence
from personal.core_broadcast import BroadcastType, broadcast
from core.jsr223.scope import ir, events, OFF, ON
from org.openhab.core.types import UnDefType


@rule("Core - Trigger presence on motion.", description="Trigger presence on motion.", tags=['core', 'presence'])
@when("Member of gCore_Presence_PresenceTrigger received update ON")
def trigger_presence_on_motion(event):
    item = ir.getItem(event.itemName)
    trigger_presence(item)


@rule("Core - Check presence state and update Core_Presence", description="Check presence state and update Core_Presence", tags=['core', 'presence'])
@when("Time cron 0 0 * ? * * *")
def check_presence(event):
    presenceManagement = ir.getItem("Core_Presence")
    state = get_presence(presenceManagement)
    if isinstance(presenceManagement.state, UnDefType) or state != presenceManagement.state.intValue():
        events.postUpdate(presenceManagement, state)
