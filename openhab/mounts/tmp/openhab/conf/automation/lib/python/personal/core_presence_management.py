from personal.core_helpers import enum
# from core.jsr223.scope import

PresenceState = enum(HOME=1, AWAY_SHORT=0, AWAY_LONG=2)


def is_presence_state(state=PresenceState.HOME):
    actualState = ir.getItem("PresenceManagement").state
    return not isinstance(actualState, UnDefType) and actualState.intValue() == state
