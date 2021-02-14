from org.openhab.core.model.script.actions import Log
from personal.core_helpers import enum
from core.actions import NotificationAction
from core.jsr223.scope import ir
from org.openhab.core.types import UnDefType

BroadcastType = enum(
    ATTENTION=1,
    INFO=0
)

BroadcastNotificationMode = enum(
    ATTENTION_ONLY=2,
    NONE=0,
    DEFAULT=1
)


def broadcast(text, broadcast_type=BroadcastType.INFO):
    state = ir.getItem("Core_Broadcast_NotificationMode").state
    notificationMode = state.intValue() if not isinstance(
        state, UnDefType) else BroadcastNotificationMode.DEFAULT

    if (
        broadcast_type == BroadcastType.INFO and
        notificationMode == BroadcastNotificationMode.DEFAULT
    ) or (
        broadcast_type == BroadcastType.ATTENTION and (
            notificationMode == BroadcastNotificationMode.DEFAULT or
            notificationMode == BroadcastNotificationMode.ATTENTION_ONLY
        )
    ):
        NotificationAction.sendBroadcastNotification(text)
        Log.logInfo(
            "Broadcast message",
            "Following message was broadcasted to all users: {}".format(text)
        )
    else:
        Log.logInfo(
            "Broadcast message",
            "Following message was muted: {}".format(text)
        )
