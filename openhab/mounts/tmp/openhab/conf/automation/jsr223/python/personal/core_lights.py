from __future__ import unicode_literals
from core.triggers import when
from core.rules import rule
from personal.core_presence import PresenceState
from personal.core_scenes import trigger_scene_items, get_scene_items
from personal.core_helpers import reload_rules, METADATA_NAMESPACE, get_location, get_childs_with_condition, has_same_location, get_item_of_helper_item, get_items_of_any_tags, sync_group_with_tags, create_helper_item, intersection_count, get_all_semantic_items
from personal.core_lights import LIGHT_MEASUREMENT_POINT_TAGS, LIGHTS_POINT_TAGS, LIGHTS_EQUIPMENT_TAGS, set_location_as_activated, is_elapsed, LightMode, AmbientLightCondition, get_light_mode_group, turn_on_switchable_point, turn_off_switchable_point
from core.jsr223.scope import ir, events, OFF, ON, OPEN
from org.openhab.core.types import UnDefType
from org.openhab.core.library.types import OnOffType, OpenClosedType
from core.metadata import set_key_value, get_key_value
from random import randint
from org.openhab.core.model.script.actions import Log


@rule("Core - Sync helper items of lights", description="Core - Sync helper items", tags=['core', 'core-lights'])
@when("Item added")
@when("Item updated")
@when("Item removed")
@when("System started")
def sync_lights_helpers(event):
    # Sync group gCore_Lights_Switchables with switchable items - it's needed to create triggers on it
    members = sync_group_with_tags(
        ir.getItem("gCore_Lights_Switchables"),
        LIGHTS_EQUIPMENT_TAGS
    )

    # Get locations
    locations = set(filter(lambda l: l, map(
        lambda l: get_location(l),
        members
    )))

    # Create helper items for each location
    items = [
        (
            'dark',
            "Lichtmodus (Dunkel) in {}",
            ['gCore_Lights_DarkMode'],
            'moon'
        ),
        (
            'bright',
            "Lichtmodus (Hell) in {}",
            ['gCore_Lights_BrightMode'],
            'sun'
        ),
        (
            'obscured',
            "Lichtmodus (Verdunkelt) in {}",
            ['gCore_Lights_ObscuredMode'],
            'blinds'
        )
    ]

    for location in locations:
        helperGroupItem = create_helper_item(
            of=location,
            namespace='lights',
            name="light-mode-group",
            item_type="Group",
            category='colorlight',
            label="Lichtmodus in {}".format(location.label),
            groups=[location.name],
            tags=["Equipment"]
        )

        for suffix, label, groups, icon in items:
            helperItem = create_helper_item(
                of=location,
                namespace='lights',
                name="light-mode-{}".format(suffix),
                item_type="Number",
                category=icon,
                label=label.format(location.label),
                groups=groups + [helperGroupItem.name],
                tags=["Point"]
            )

            if helperGroupItem.name not in helperItem.getGroupNames():
                helperItem.addGroupName(helperGroupItem.name)

            set_key_value(
                helperItem.name,
                'cellWidget',
                'label',
                '=items.{0}.title'.format(helperItem.name)
            )

            set_key_value(
                helperItem.name,
                'cellWidget',
                'icon',
                'oh:{}'.format(icon)
            )

            set_key_value(
                helperItem.name,
                'cellWidget',
                'action',
                'options'
            )

            set_key_value(
                helperItem.name,
                'cellWidget',
                'actionItem',
                helperItem.name
            )

            set_key_value(
                helperItem.name,
                'listWidget',
                'subtitle',
                '=items.{0}.displayState'.format(helperItem.name)
            )

            set_key_value(
                helperItem.name,
                'listWidget',
                'icon',
                'oh:{}'.format(icon)
            )

            set_key_value(
                helperItem.name,
                'listWidget',
                'action',
                'options'
            )

            set_key_value(
                helperItem.name,
                'listWidget',
                'actionItem',
                helperItem.name
            )

            set_key_value(
                helperItem.name,
                'stateDescription',
                'pattern',
                '%d'
            )

            set_key_value(
                helperItem.name,
                'stateDescription',
                'options',
                '0.0=Aus,1.0=An,2.0=Auto-An,3.0=Unveraendert,4.0=Simulierend'
            )

    # Reload rules
    reload_rules(
        set_last_light_activation_triggers,
        set_last_light_activation
    )
    reload_rules(
        manage_light_state_triggers,
        manage_light_state
    )
    reload_rules(
        manage_presence_triggers,
        manage_presence
    )


set_last_light_activation_triggers = [
    "Descendent of gCore_Lights_Switchables received update"
]


@rule("Core - Keep last light activation updated", description="Keep last light activation updated", tags=["core", 'core-lights', 'core-reload-set_last_light_activation'])
@when("Descendent of gCore_Lights_Switchables received update")
def set_last_light_activation(event):
    item = ir.getItem(event.itemName)
    if item.getStateAs(OnOffType) == ON and (
        # Is target item:
        'gCore_Lights_Switchables' in item.getGroupNames() or
        # Is Switch child of target item:
        intersection_count(item.getTags(), LIGHTS_POINT_TAGS) > 0
    ):
        set_location_as_activated(item)


@rule("Core - Manage daylight status changes.", description="Manage daylight status changes.", tags=["core", 'core-lights'])
@when("Time cron 0 0/5 * ? * * *")
@when("Item Core_Lights_AmbientLightCondition_LuminanceTreshold_Dark changed")
@when("Item Core_Lights_AmbientLightCondition_LuminanceTreshold_Obscured changed")
def check_daylight(event):
    activeSwitchables = filter(
        lambda switchable: switchable.getStateAs(OnOffType) == ON,
        get_all_semantic_items(LIGHTS_EQUIPMENT_TAGS, LIGHTS_POINT_TAGS)
    )

    activeRoomNames = map(
        lambda r: r.name,
        filter(
            lambda r: r,
            map(
                lambda switchable: get_location(switchable),
                activeSwitchables
            )
        )
    )

    def isNotActiveRoom(location):
        return location and location.name not in activeRoomNames

    sensorsOfInactiveRooms = sorted(
        filter(
            lambda sensor: not isinstance(
                sensor.state,
                UnDefType
            ) and isNotActiveRoom(get_location(sensor)),
            get_items_of_any_tags(LIGHT_MEASUREMENT_POINT_TAGS)
        ),
        key=lambda sensor: sensor.state
    )

    darkTresholdItem = ir.getItem(
        "Core_Lights_AmbientLightCondition_LuminanceTreshold_Dark")
    obscuredTresholdItem = ir.getItem(
        "Core_Lights_AmbientLightCondition_LuminanceTreshold_Obscured")

    if len(sensorsOfInactiveRooms) == 0:
        return

    medianSensorItem = sensorsOfInactiveRooms[len(sensorsOfInactiveRooms) / 2]

    if isinstance(medianSensorItem.state, UnDefType):
        return

    conditionItemName = "Core_Lights_AmbientLightCondition"
    set_key_value(
        conditionItemName,
        METADATA_NAMESPACE,
        'lights',
        'luminance',
        medianSensorItem.state
    )

    condition = AmbientLightCondition.BRIGHT
    if medianSensorItem.state < darkTresholdItem.state:
        condition = AmbientLightCondition.DARK
    elif medianSensorItem.state < obscuredTresholdItem.state:
        condition = AmbientLightCondition.OBSCURED

    conditionItem = ir.getItem(conditionItemName)
    if conditionItem.state != condition:
        events.postUpdate(conditionItem, condition)


manage_light_state_triggers = [
    "Member of gCore_Lights_DarkMode received update",
    "Member of gCore_Lights_BrightMode received update",
    "Member of gCore_Lights_ObscuredMode received update",
    "Item Core_Lights_AmbientLightCondition received update",
    "Item Core_Presence received update"
]


@rule("Core - Manage lights according to light conditions.", description="Manage lights according to light conditions.", tags=['core', 'core-lights', 'core-reload-manage_light_state'])
@when("Member of gCore_Lights_DarkMode received update")
@when("Member of gCore_Lights_BrightMode received update")
@when("Member of gCore_Lights_ObscuredMode received update")
@when("Item Core_Lights_AmbientLightCondition received update")
@when("Item Core_Presence received update")
def manage_light_state(event):
    lightModeGroup = get_light_mode_group()
    switchOnRoomNames = map(
        lambda r: r.name,
        filter(
            lambda r: r,
            map(
                lambda groupMember: get_location(groupMember),
                filter(
                    lambda groupMember: (
                        not isinstance(groupMember.state, UnDefType) and
                        groupMember.state.floatValue() in [
                            LightMode.ON
                        ]
                    ),
                    lightModeGroup.members
                )
            )
        )
    )

    switchOffRoomNames = map(
        lambda r: r.name,
        filter(
            lambda r: r,
            map(
                lambda groupMember: get_location(groupMember),
                filter(
                    lambda groupMember: (
                        not isinstance(groupMember.state, UnDefType) and
                        groupMember.state.floatValue() in [
                            LightMode.OFF
                        ]
                    ),
                    lightModeGroup.members
                )
            )
        )
    )

    for point in get_all_semantic_items(LIGHTS_EQUIPMENT_TAGS, LIGHTS_POINT_TAGS):
        location = get_location(point)
        if location and location.name in switchOnRoomNames:
            turn_on_switchable_point(point)
        if location and location.name in switchOffRoomNames:
            turn_off_switchable_point(point)


manage_presence_triggers = [
    "Member of gCore_Presence_PresenceTrigger received update"
]


@ rule("Core - Manage lights on presence.", description="Manage lights on presence.", tags=['core', 'core-lights', 'core-presence', 'core-reload-manage_presence'])
@ when("Member of gCore_Presence_PresenceTrigger received update")
def manage_presence(event):
    item = ir.getItem(event.itemName)
    if (
        item.getStateAs(OnOffType) == ON or
        item.getStateAs(OpenClosedType) == OPEN
    ):
        location = get_location(item)
        lightModeGroup = get_light_mode_group()
        switchOnSwitchableNames = map(
            lambda s: s.name,
            filter(
                lambda item: not isinstance(item.state, UnDefType) and
                item.getStateAs(OnOffType) == ON,
                get_all_semantic_items(
                    LIGHTS_EQUIPMENT_TAGS,
                    LIGHTS_POINT_TAGS
                )
            )
        )

        for member in lightModeGroup.members:
            if (
                not isinstance(member.state, UnDefType) and
                member.state.floatValue() in [
                    LightMode.AUTO_ON
                ] and
                has_same_location(member, location)
            ):
                scene = next((scene for scene in ir.getItem(
                    'gCore_Scenes').members if has_same_location(scene, location)), None)
                if scene:
                    trigger_scene_items(
                        scene,
                        poke_only=len(filter(
                            lambda item: item.name in switchOnSwitchableNames,
                            get_scene_items(scene)
                        )) > 0
                    )
                elif len(get_childs_with_condition(
                    location,
                    lambda point: point.name in switchOnSwitchableNames
                )) == 0:
                    for point in get_all_semantic_items(LIGHTS_EQUIPMENT_TAGS, LIGHTS_POINT_TAGS):
                        if has_same_location(point, location):
                            turn_on_switchable_point(point)
                break


@rule("Core - Manage lights when come back home.", description="Manage lights when come back home.", tags=['core', 'core-lights'])
@when("Item Core_Presence changed to {}".format(PresenceState.HOME))
def welcome_light(event):
    condition = ir.getItem("Core_Lights_AmbientLightCondition")
    welcomeLightModeMapping = {
        AmbientLightCondition.DARK: ir.getItem("Core_Lights_WelcomeLight_DarkMode"),
        AmbientLightCondition.OBSCURED: ir.getItem("Core_Lights_WelcomeLight_ObscuredMode"),
        AmbientLightCondition.BRIGHT: ir.getItem(
            "Core_Lights_WelcomeLight_BrightMode"
        )
    }
    welcomeLightMode = welcomeLightModeMapping.get(
        AmbientLightCondition.BRIGHT if isinstance(
            condition.state, UnDefType) else condition.state.floatValue()
    )

    if welcomeLightMode.state == ON:
        lightModeGroup = get_light_mode_group()
        switchOnRoomNames = map(
            lambda r: r.name,
            filter(
                lambda r: r,
                map(
                    lambda mode: get_location(mode),
                    filter(
                        lambda mode: not isinstance(
                            mode.state,
                            UnDefType
                        ) and mode.state.floatValue() in [
                            LightMode.AUTO_ON
                        ],
                        lightModeGroup.members
                    )
                )
            )
        )

        for point in get_all_semantic_items(LIGHTS_EQUIPMENT_TAGS, LIGHTS_POINT_TAGS):
            location = get_location(point)
            if location and location.name in switchOnRoomNames:
                turn_on_switchable_point(point)


@rule("Core - Manage elapsed lights.", description="Manage elapsed lights.", tags=['core', 'core-lights'])
@when("Time cron 0 * * ? * * *")
@when("Item Core_Lights_DefaultDuration received update")
def elapsed_lights(event):
    lightModeGroup = get_light_mode_group()
    switchOffRoomNames = map(
        lambda r: r.name,
        filter(
            lambda r: r and is_elapsed(r),
            set(map(
                lambda mode: get_location(mode),
                filter(
                    lambda mode: not isinstance(
                        mode.state,
                        UnDefType
                    ) and mode.state.floatValue() in [
                        LightMode.AUTO_ON,
                        LightMode.OFF
                    ],
                    lightModeGroup.members
                )
            ))
        ))

    for point in get_all_semantic_items(LIGHTS_EQUIPMENT_TAGS, LIGHTS_POINT_TAGS):
        location = get_location(point)
        if location and location.name in switchOffRoomNames:
            turn_off_switchable_point(point)


@rule("Core - Simulate lights.", description="Simulate lights.", tags=['core', 'core-lights'])
@when("Time cron 0 0/5 0 ? * * *")
def simulate_presence(event):
    lightModeGroup = get_light_mode_group()
    simulateLocations = set(map(
        lambda mode: get_location(mode),
        filter(
            lambda mode: not isinstance(
                mode.state,
                UnDefType
            ) and mode.state.floatValue() == LightMode.SIMULATE,
            lightModeGroup.members
        )
    ))

    for point in get_all_semantic_items(LIGHTS_EQUIPMENT_TAGS, LIGHTS_POINT_TAGS):
        location = get_location(point)
        if location and location.name in simulateLocations and randint(0, 10) <= 2:
            if point.getStateAs(OnOffType) != ON:
                turn_on_switchable_point(point)
            else:
                turn_off_switchable_point(point)
