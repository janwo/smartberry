from __future__ import unicode_literals
from core.jsr223.scope import ir
from personal.core_helpers import enum
from org.openhab.core.types import UnDefType

OperationState = enum(
    OFF=0.0,
    ON=1.0,
    SILENTLY=2.0
)

ASSAULT_TRIGGER_EQUIPMENT_TAGS = [
    "Window",
    "Door",
    "CoreAssaultTrigger"
]

ASSAULT_TRIGGER_POINT_TAGS = [
    "OpenState",
    "Switch"
]

ASSAULT_DISARMER_EQUIPMENT_TAGS = [
    "CoreAssaultDisarmer"
]

ASSAULT_DISARMER_POINT_TAGS = [
    "OpenState",
    "Switch"
]

LOCK_CLOSURE_EQUIPMENT_TAGS = [
    "CoreLockClosure"
]

LOCK_CLOSURE_POINT_TAGS = [
    "OpenState",
    "Switch"
]

LOCK_EQUIPMENT_TAGS = [
    "Lock"
]

LOCK_POINT_TAGS = [
    "OpenState",
    "Switch"
]


def is_security_state(state=OperationState.OFF):
    actualState = ir.getItem("Core_Security_OperationState").state
    return not isinstance(actualState, UnDefType) and actualState.floatValue() is state
