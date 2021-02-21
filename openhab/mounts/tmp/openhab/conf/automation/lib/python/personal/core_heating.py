from __future__ import unicode_literals
from core.jsr223.scope import ir
from org.openhab.core.types import UnDefType
from personal.core_helpers import enum

HeatingState = enum(
    OFF=0.0,
    ECO=11.0,
    DEFAULT=1.0
)
