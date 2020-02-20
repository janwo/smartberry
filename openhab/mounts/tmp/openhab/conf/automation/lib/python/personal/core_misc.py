from core.log import logging
from personal.core_helpers import enum
from core.actions import NotificationAction
from core.jsr223.scope import ir, UnDefType

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
    state = ir.getItem("MiscManagement_BroadcastNotificationMode").state
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
        logging.info(
            "Sending following broadcast message to user: {}".format(text))
        NotificationAction.sendBroadcastNotification(text)