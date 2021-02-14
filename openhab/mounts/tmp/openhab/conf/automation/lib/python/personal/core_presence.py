from personal.core_helpers import enum, METADATA_NAMESPACE, get_location
from core.metadata import get_key_value, set_key_value
from core.jsr223.scope import ir, events
from org.openhab.core.types import UnDefType
from core.date import hours_between, ZonedDateTime, format_date
from personal.core_broadcast import BroadcastType, broadcast

PresenceState = enum(
    AWAY_SHORT=0,
    HOME=1,
    AWAY_LONG=2
)


def get_presence(item=None):
    if item == None:
        presenceProvider = ir.getItem("Core_Presence")
    else:
        location = get_location(item)
        presenceProvider = ir.getItem(
            "Core_Presence") if location == None else location

    lastUpdate = get_key_value(
        presenceProvider.name,
        METADATA_NAMESPACE,
        'presence',
        "last-update"
    )
    if lastUpdate:
        return PresenceState.HOME if presenceProvider.name == "Core_Presence" else get_presence()

    hours_away_long = ir.getItem("Core_Presence_HoursUntilAwayLong")
    if isinstance(hours_away_long.state, UnDefType):
        broadcast("No value set for {}.".format(hours_away_long.name))
        return PresenceState.HOME

    hours_away_short = ir.getItem(
        "Core_Presence_HoursUntilAwayShort")
    if isinstance(hours_away_short.state, UnDefType):
        broadcast("No value set for {}.".format(hours_away_short.name))
        return PresenceState.HOME

    if hours_between(
        lastUpdate,
        ZonedDateTime.now()
    ) > hours_away_long.state.intValue():
        return PresenceState.AWAY_LONG

    elif hours_between(
        lastUpdate,
        ZonedDateTime.now()
    ) > hours_away_short.state.intValue():
        return PresenceState.AWAY_SHORT

    return PresenceState.HOME


def trigger_presence(item):
    location = get_location(item)

    if location != None:
        set_key_value(
            location.name,
            METADATA_NAMESPACE,
            "presence",
            "last-update",
            format_date(ZonedDateTime.now())
        )

    presenceManagement = ir.getItem("Core_Presence")
    events.postUpdate(presenceManagement, PresenceState.HOME)
    set_key_value(
        presenceManagement.name,
        METADATA_NAMESPACE,
        "presence",
        "last-update",
        format_date(ZonedDateTime.now())
    )