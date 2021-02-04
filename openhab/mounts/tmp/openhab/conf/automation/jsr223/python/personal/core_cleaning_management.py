from core.rules import rule
from core.triggers import when
from core.jsr223.scope import ir, events
from org.openhab.core.types import UnDefType


@rule("Core - Start or stop house cleaning", description="Start or stop house cleaning", tags=[])
@when("Member of gCleaning_Vacuum_Clean received command")
def manage_house_cleaning(event):
    command = 'clean' if event.itemCommand is ON else 'dock'
    for item in ir.getItem("gCleaning_Vacuum_CommandItem").members:
        events.sendCommand(item, command)


@rule("Core - Manage state on manual house cleaning", description="Manage state on manual house cleaning", tags=[])
@when("Member of gCleaning_Vacuum_StateItem received update")
def manage_manual_house_cleaning_updates(event):
    members = ir.getItem("gCleaning_Vacuum_StateItem").members
    hasBusyMember = any(member.state == 'BUSY' for member in members)
    updatedState = ON if hasBusyMember else OFF
    for member in ir.getItem("gCleaning_Vacuum_Clean").members:
        if member.state != updatedState:
            events.postUpdate(member, updatedState)
