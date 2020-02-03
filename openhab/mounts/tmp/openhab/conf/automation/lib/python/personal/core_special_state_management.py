from core.jsr223.scope import ir, UnDefType
from personal.core_helpers import enum


SpecialState = enum(DEFAULT=0, SLEEP=1)


def is_special_state(state=SpecialState.DEFAULT):
    actualState = ir.getItem("SpecialStateManagement").state
    return not isinstance(actualState, UnDefType) and actualState.intValue() == state
