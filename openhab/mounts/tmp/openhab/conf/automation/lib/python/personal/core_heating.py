from core.jsr223.scope import ir
from org.openhab.core.types import UnDefType
from personal.core_helpers import enum

HeatingState = enum(
    OFF=0,
    ECO=11,
    DEFAULT=1
)
