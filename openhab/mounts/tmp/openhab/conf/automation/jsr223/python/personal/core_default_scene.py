from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from core.jsr223.scope import ir, events
from org.openhab.core.types import UnDefType
from personal.core_scenes import apply_context
from personal.core_presence import get_presence, PresenceState
from personal.core_helpers import enum, METADATA_NAMESPACE
from core.metadata import set_key_value

DefaultSceneState = enum(
    HOME=0,
    AWAY_SHORT=1,
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


@rule("Core - Adjust default scene on presence changes.", description="Adjust default scene on presence changes.", tags=["core", "default-scene"])
@when("Item Core_Presence received update")
def presence_updated(event):
    defaultSceneMapping = {
        PresenceState.HOME: DefaultSceneState.HOME,
        PresenceState.AWAY_SHORT: DefaultSceneState.AWAY_SHORT,
        PresenceState.AWAY_LONG: DefaultSceneState.AWAY_LONG
    }

    events.postUpdate(
        ir.getItem('Core_DefaultScene'),
        defaultSceneMapping.get(get_presence())
    )


@rule("Core - Add custom-members.", description="Core - Add custom-members.", tags=['core', 'default-scene'])
@when("Item added")
@when("Item updated")
@when("Item removed")
def sync_default_scene_helpers(event):
    set_key_value(
        'Core_DefaultScene',
        METADATA_NAMESPACE,
        'scenes',
        'custom-members',
        [
            "Core_Security_OperationState",
            "Core_Heating_Thermostat_ModeDefault",
            "gCore_Lights_DarkMode",
            "gCore_Lights_BrightMode",
            "gCore_Lights_ObscuredMode",
            "Core_Lights_DefaultDuration"
        ]
    )
