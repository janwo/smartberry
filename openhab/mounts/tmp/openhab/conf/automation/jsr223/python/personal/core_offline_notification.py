import functools
from core.triggers import when
from core.rules import rule
from personal.core_broadcast import BroadcastType, broadcast
from core.jsr223.scope import ir, events
from org.openhab.core.types import UnDefType


@rule("Core - Check things for offline state.", description="Check things for offline state.", tags=[])
@when("Time cron 0 0 12 * * ?")
def offline_check(event):
    offlineThingsNotifications = filter(lambda thing: (
        thing.getStatusInfo() != None and
        thing.getStatusInfo().getStatus().toString() != "ONLINE"
    ), things.getAll())
    offlineThingsNotifications = map(lambda thing: ("{0} is {1}".format(
        thing.getLabel(), thing.getStatusInfo().getStatus()
    )), offlineThingsNotifications)

    if len(offlineThingsNotifications) > 0:
        notification = "Some things are not ONLINE:\n{}".format(functools.reduce(
            lambda a, b: a + "\n" + b,
            offlineThingsNotifications
        ))
        broadcast(notification)
    else:
        offline_check.log.info("All things are ONLINE!")
