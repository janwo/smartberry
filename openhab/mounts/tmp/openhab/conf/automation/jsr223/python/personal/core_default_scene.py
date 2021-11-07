from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from core.jsr223.scope import ir, events
from org.openhab.core.types import UnDefType
from personal.core_scenes import apply_context
from personal.core_presence import PresenceState
from personal.core_helpers import enum, METADATA_NAMESPACE
from core.metadata import set_key_value
from org.openhab.core.model.script.actions import Log

DefaultSceneState = enum(
    HOME=0.0,
    AWAY_SHORT=1.0,
    AWAY_LONG=2.0,
    SLEEP=3.0
)


@rule("Core - Manage changes of default scene.", description="Manage changes of default scene.", tags=["core", "core-default-scene"])
@when("Item Core_DefaultScene received update")
def default_scene_updated(event):
    if not isinstance(event.itemState, UnDefType):
        if event.itemState.floatValue() == DefaultSceneState.SLEEP:
            for scene in ir.getItem("gCore_Scenes").members:
                contexts = ['sleep', 'reset']
                for context in contexts:
                    if apply_context(scene, context):
                        break


@rule("Core - Adjust default scene on presence changes.", description="Adjust default scene on presence changes.", tags=["core", "core-default-scene"])
@when("Item Core_Presence changed")
def presence_updated(event):
    scene = ir.getItem('Core_DefaultScene')
    if (
        isinstance(scene.state, UnDefType) or
        scene.state.floatValue() == DefaultSceneState.SLEEP
    ):
        return

    defaultSceneMapping = {
        PresenceState.HOME: DefaultSceneState.HOME,
        PresenceState.AWAY_SHORT: DefaultSceneState.AWAY_SHORT,
        PresenceState.AWAY_LONG: DefaultSceneState.AWAY_LONG
    }

    events.postUpdate(
        ir.getItem('Core_DefaultScene'),
        defaultSceneMapping.get(event.itemState.floatValue())
    )


@rule("Core - Add custom-members.", description="Core - Add custom-members.", tags=['core', 'core-default-scene'])
@when("Time cron 30 0/5 * ? * * *")
@when("System started")
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
