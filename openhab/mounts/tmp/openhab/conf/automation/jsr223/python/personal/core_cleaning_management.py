from core.rules import rule
from core.triggers import when


@rule("Start or stop house cleaning", description="Start or stop house cleaning", tags=[])
@when("Item gCleaning_Vacuum_Clean received command")
def manage_house_cleaning(event):
    command = 'clean' if event.itemCommand is ON else 'dock'
    for item in ir.getItem("gCleaning_Vacuum_CommandItem").members:
        events.sendCommand(item.name, command)


@rule("Manage state on manual house cleaning", description="Manage state on manual house cleaning", tags=[])
@when("Member of gCleaning_Vacuum_StateItem received update")
def manage_manual_house_cleaning_updates(event):
    members = ir.getItem("gCleaning_Vacuum_StateItem").members
    hasBusyMember = any(member.state == 'BUSY' for member in members)
    updatedState = ON if hasBusyMember else OFF
    group = ir.getItem("gCleaning_Vacuum_Clean")
    if group.state != updatedState:
        events.postUpdate(group.name, updatedState)
