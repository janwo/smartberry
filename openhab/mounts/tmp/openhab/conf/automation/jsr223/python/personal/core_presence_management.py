from core.rules import rule
from core.triggers import when
from personal.core_helpers import enum

PresenceState = enum(HOME=1, AWAY_SHORT=0, AWAY_LONG=2)
