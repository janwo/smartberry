from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from personal.core_broadcast import broadcast
from core.jsr223.scope import ir, events, things
from core.date import days_between, ZonedDateTime
from personal.core_helpers import get_date
from core import osgi

ITEM_CHANNEL_LINK_REGISTRY = osgi.get_service("org.openhab.core.thing.link.ItemChannelLinkRegistry")
ELAPSED_DAYS = 5

@rule("Core - Check things for offline state.", description="Check things for offline state.", tags=['core', 'core-checks'])
@when("Time cron 0 0/5 * * * ?")
def offline_check(event):
    group = ir.getItem("gCore_Checks_OfflineThings")
    for member in group.allMembers:   
        group.removeMember(member)

    allThings = things.getAll()
    for thing in allThings:
        if (
            thing.getStatusInfo() and 
            thing.getStatusInfo().getStatus().toString() != "ONLINE"
            ) or ( 
            thing.getProperties() and 
            thing.getProperties().get("zwave_lastheal") and
            days_between(get_date(thing.getProperties().get("zwave_lastheal"), "yyyy-MM-dd'T'HH:mm:ssX"), ZonedDateTime.now()) > ELAPSED_DAYS
        ):
            for channel in thing.getChannels():
                for item in ITEM_CHANNEL_LINK_REGISTRY.getLinkedItems(channel.getUID()):
                    if not item.getGroupNames() or str(group.name) not in item.getGroupNames():
                        group.addMember(item)