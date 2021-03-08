from __future__ import unicode_literals
from personal.core_helpers import get_date, enum, METADATA_NAMESPACE, get_location, get_date_string
from core.metadata import get_key_value, set_key_value
from core.jsr223.scope import ir, events
from org.openhab.core.types import UnDefType
from core.date import hours_between, ZonedDateTime
from personal.core_broadcast import BroadcastType, broadcast

PresenceState = enum(
    AWAY_SHORT=0.0,
    HOME=1.0,
    AWAY_LONG=2.0
)

POINT_TAGS = [
    "Presence"
]


def get_presence_provider_item(item=None):
    if item is None:
        return ir.getItem("Core_Presence")

    location = get_location(item)
    if location is None:
        return ir.getItem("Core_Presence")

    return location


def get_presence(item=None):
    presenceProvider = get_presence_provider_item(item)
    lastUpdate = get_key_value(
        presenceProvider.name,
        METADATA_NAMESPACE,
        'presence',
        "last-update"
    )
    if lastUpdate:
        skipExpireCheck = True
        hours_away_long = ir.getItem("Core_Presence_HoursUntilAwayLong")
        if (
            not isinstance(hours_away_long.state, UnDefType) and
            hours_away_long.state.floatValue() > 0
        ):
            skipExpireCheck = False
            if hours_between(
                get_date(lastUpdate),
                ZonedDateTime.now()
            ) > hours_away_long.state.floatValue():
                return PresenceState.AWAY_LONG

        hours_away_short = ir.getItem("Core_Presence_HoursUntilAwayShort")
        if (
            not isinstance(hours_away_short.state, UnDefType) and
            hours_away_short.state.floatValue() > 0
        ):
            skipExpireCheck = False
            if hours_between(
                get_date(lastUpdate),
                ZonedDateTime.now()
            ) > hours_away_short.state.floatValue():
                return PresenceState.AWAY_SHORT

        if not skipExpireCheck:
            return PresenceState.HOME

    if presenceProvider.name is "Core_Presence":
        if isinstance(presenceProvider.state, UnDefType):
            return PresenceState.HOME
        else:
            return presenceProvider.state.floatValue()
    else:
        # Try again with root presence item.
        return get_presence()


def trigger_presence(item):
    presenceProvider = get_presence_provider_item(item)
    set_key_value(
        presenceProvider.name,
        METADATA_NAMESPACE,
        "presence",
        "last-update",
        get_date_string(ZonedDateTime.now())
    )

    if presenceProvider.name is not 'Core_Presence':
        presenceProvider = ir.getItem("Core_Presence")
        set_key_value(
            presenceProvider.name,
            METADATA_NAMESPACE,
            "presence",
            "last-update",
            get_date_string(ZonedDateTime.now())
        )

    events.postUpdate(presenceProvider, PresenceState.HOME)


def trigger_absence(item):
    if get_presence() is PresenceState.HOME:
        presenceProvider = ir.getItem("Core_Presence")
        events.postUpdate(presenceProvider, PresenceState.AWAY_SHORT)
