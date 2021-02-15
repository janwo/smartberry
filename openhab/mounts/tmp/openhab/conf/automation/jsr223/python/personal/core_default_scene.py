from core.triggers import when
from core.rules import rule
from core.jsr223.scope import ir
from org.openhab.core.types import UnDefType
from personal.core_scenes import apply_context
from personal.core_helpers import enum
from personal.core_helpers import METADATA_NAMESPACE
from core.metadata import set_key_value

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
        if event.itemState.floatValue() == DefaultSceneState.SLEEP:
            for scene in ir.getItem("gCore_Scenes").members:
                contexts = ['sleep', 'reset']
                for context in contexts:
                    if apply_context(scene, context):
                        break


@rule("Core - Add custom-members.", description="Core - Add custom-members.", tags=['core', 'default-scene'])
@when("System started")
def sync_helper_items(event):
    set_key_value(
        'Core_DefaultScene',
        METADATA_NAMESPACE,
        'scenes',
        'custom-members',
        [
            "Core_Security_OperationState",
            "Core_Heating_Thermostat_ModeDefault"
        ]
    )
