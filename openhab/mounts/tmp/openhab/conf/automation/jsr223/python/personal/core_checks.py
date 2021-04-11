from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from personal.core_broadcast import BroadcastType, broadcast
from core.jsr223.scope import ir, events, things
from core.date import days_between, ZonedDateTime
from personal.core_helpers import get_date

ELAPSED_DAYS = 5


@rule("Core - Check things for offline state.", description="Check things for offline state.", tags=['core', 'core-checks'])
@when("Time cron 0 0 12 * * ?")
def offline_check(event):
    allThings = things.getAll()
    offlineThingMessages = map(
        lambda t: (
            t.getUID(),
            "{} is {}!".format(
                t.getLabel(),
                t.getStatusInfo().getStatus()
            )
        ),
        filter(
            lambda t: (
                t.getStatusInfo() and
                t.getStatusInfo().getStatus().toString() != "ONLINE"
            ),
            allThings
        )
    )

    elapsedThingsMessages = map(
        lambda t: (
            t.getUID(),
            "{} is elapsed for {} day(s)!".format(
                t.getLabel(),
                days_between(
                    get_date(
                        t.getProperties().get("zwave_lastheal"),
                        "yyyy-MM-dd'T'HH:mm:ssX"),
                    ZonedDateTime.now()
                )
            )
        ),
        filter(
            lambda t: (
                t.getProperties() and
                t.getProperties().get("zwave_lastheal") and
                days_between(
                    get_date(
                        t.getProperties().get("zwave_lastheal"),
                        "yyyy-MM-dd'T'HH:mm:ssX"
                    ),
                    ZonedDateTime.now()
                ) > ELAPSED_DAYS
            ),
            allThings
        )
    )

    thingUids = set()
    notifications = []
    for thingUid, message in offlineThingMessages + elapsedThingsMessages:
        if not thingUid in thingUids:
            thingUids.add(thingUid)
            notifications.append(message)

    if notifications:
        broadcast("Some things are not ONLINE or elapsed:\n{}".format(
            reduce(
                lambda a, b: a + "\n" + b,
                notifications
            )
        ))
