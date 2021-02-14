from core.triggers import when
from core.rules import rule
from core.jsr223.scope import ir
from org.openhab.core.types import UnDefType
from personal.core_scenes import apply_context
from personal.core_helpers import enum

DefaultSceneState = enum(
    HOME=0,
    AWAY=1,
    AWAY_LONG=2,
    SLEEP=3
)


@rule("Core - Manage changes of default scene.", description="Manage changes of default scene.", tags=["core", "default-scene"])
@when("Item Core_DefaultScene received update")
def default_scene_updated(event):
    if not isinstance(event.itemState, UnDefType):
        if event.itemState.intValue() == DefaultSceneState.SLEEP:
            for scene in ir.getItem("gCore_Scenes").members:
                contexts = ['sleep', 'reset']
                for context in contexts:
                    if apply_context(scene, context):
                        break
