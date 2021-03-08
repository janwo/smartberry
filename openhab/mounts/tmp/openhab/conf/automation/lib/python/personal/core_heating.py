from __future__ import unicode_literals
from core.jsr223.scope import ir
from org.openhab.core.types import UnDefType
from personal.core_helpers import enum

HeatingState = enum(
    OFF=0.0,
    ECO=11.0,
    DEFAULT=1.0
)

OPEN_CONTACT_EQUIPMENT_TAGS = [
    "Door",
    "Window"
]

OPEN_CONTACT_POINT_TAGS = [
    "OpenState"
]

HEATING_EQUIPMENT_TAGS = [
    "RadiatorControl"
]

HEATING_POINT_TAGS = [
    "Setpoint"
]

TEMPERATURE_MEASUREMENT_POINT_TAGS = [
    ["Measurement", "Temperature"]
]
