
from core.jsr223.scope import ir
from personal.core_helpers import enum
from org.openhab.core.types import UnDefType

OperationState = enum(OFF=0, ON=1, SILENTLY=2)


def is_security_state(state=OperationState.OFF):
    actualState = ir.getItem("Core_Security_OperationState").state
    return not isinstance(actualState, UnDefType) and actualState.intValue() == state
