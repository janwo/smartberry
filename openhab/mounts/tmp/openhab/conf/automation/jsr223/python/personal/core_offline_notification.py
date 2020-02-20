import functools
from core.triggers import when
from core.rules import rule
from personal.core_misc import BroadcastType, broadcast
import functools


@rule("Core - Check things for offline state.", description="Check things for offline state.", tags=[])
@when("Time cron 0 0 12 * * ?")
def offline_check(event):
    offlineThingsNotifications = filter(lambda thing: (
        thing.getStatusInfo() != None and
        not thing.getStatusInfo().getStatus().toString().equals("ONLINE")
    ), things)

    offlineThingsNotifications = map(lambda thing: ("{0} is {1}".format(
        thing.getLabel(), thing.getStatusInfo().getStatus()
    )), offlineThingsNotifications)

    if len(offlineThingsNotifications) > 0:
        notification = "Es wurden Geräte als nicht ONLINE erkannt:\n{}".format(
            functools.reduce("\n", offlineThingsNotifications))
        broadcast(notification)
    else:
        offline_check.log.info("All things are ONLINE!")
