# <center>SmartBerry 🍓 - Smart Home 🏡</center>
*<center>SmartBerry is an openHAB environment providing multiple extensions to simplify the configuration of scenes, climate and security management.</center>*

## Documentation
Get started with SmartBerry and start to learn the fundamentals.

* [Getting Started](#getting-started)
* [Configuration](#configuration)
	* [Lights](#lights-) 💡
	* [Heating](#heating-) 🔥
	* [Presence](#presence-) 👋
	* [Scenes](#scenes-) 🎬
	* [Security](#security-) 🔒
	* [Timed Outlets](#timed-outlets-) ⏱️

### Getting Started
It is recommend to use SmartBerry in a docker container. The easiest way to do so, is a deployment of SmartBerry via [balenaCloud](https://www.balena.io/cloud/). Just add the project to your balena applications and select a supported device. You also like to change the hostname of your device to `smartberry` - to do so, study these [notes](https://www.balena.io/docs/learn/develop/runtime/#change-the-device-hostname).

[![balena deploy button](https://www.balena.io/deploy.svg)](https://dashboard.balena-cloud.com/deploy?repoUrl=https%3A//github.com/janwo/smartberry)

In order to adjust general settings of your SmartBerry instance, you may add the following environment variables.

Environment variable|Description
:---|:---
`SAMBA_PASSWORD` (mandatory)|Define the default password in order to access `smb://smartberry`
`OPENHAB_HOSTKEY` (optional)|Set the hostkey to keep the device in the *known* host on your computer.
`OPENHAB_UUID` (optional)|Set your openhab uuid for [`myopenhab.org`cloud service](https://myopenhab.org/).
`OPENHAB_SECRET` (optional)|Set your openhab secret for [`myopenhab.org`cloud service](https://myopenhab.org/).
`BLUETOOTH_BEACON_UUID` (optional)|For locks or smartphone apps it may be useful for you to work with [iBeacons](https://de.wikipedia.org/wiki/IBeacon). If supported by your hardware, you can define a constant bluetooth beacon uuid.

If you have any questions, just let them know in the *Issues*.

### Configuration
To make SmartBerry manage your home in its full potential, some configuration is needed. Please also refer to the documentation of [openHAB](https://www.openhab.org/docs/).

#### Lights 💡
Lights are triggered automatically in dependence to daylight and presence changes. The following equipments and points are used for a proper lights configuration.

Role|Needed equipment tags|Needed point tags|Needed custom tags
:---|:---|:---|:---
Light switchable|`Lightbulb` **or** `WallSwitch` **or** `PowerOutlet`|`Switch`|
Light measurement item||`Measurement` **and** `Light`|

Each location having "Light switchable" - items  will receive the following items in order to adjust light configuration. To adjust the light management configuration, you can adjust the items accordingly.

Item name|Group membership|Description
:---|:---|:---
Autogenerated|`gCore_Lights_DarkMode` *and corresponding location group*|Set the lighting mode in *dark* conditions. Current choices are `OFF`, `ON `, `AUTO_ON` , `UNCHANGED` or `SIMULATE`
Autogenerated|`gCore_Lights_ObscuredMode` *and corresponding location group*|Set the lighting mode in *obscured* conditions. Current choices are `OFF`, `ON `, `AUTO_ON` , `UNCHANGED` or `SIMULATE`
Autogenerated|`gCore_Lights_BrightMode` *and corresponding location group*|Set the lighting mode in *bright* conditions. Current choices are `OFF`, `ON `, `AUTO_ON` , `UNCHANGED` or `SIMULATE`

To adjust general configurations within the lights context, you can modify the following items.

Item name|Description
:---|:---
Core\_Lights\_AmbientLightCondition|Identified light conditions
Core\_Lights\_AmbientLightCondition\_LuminanceTreshold\_Obscured|Upper luminance level for obscured light conditions
Core\_Lights\_AmbientLightCondition\_LuminanceTreshold\_Dark|Upper luminance level for dark light conditions
Core\_Lights\_DefaultDuration|Minutes without presence events until lights are turned off in `AUTO_ON ` mode.
Core\_Lights\_WelcomeLight\_DarkMode|Turn this on to turn on all light switchables in `AUTO_ON` mode during *dark* light conditions when come back home
Core\_Lights\_WelcomeLight\_ObscuredMode|Turn this on to turn on all light switchables in `AUTO_ON` mode during *obscured* light conditions when come back home
Core\_Lights\_WelcomeLight\_BrightMode|Turn this on to turn on all light switchables in `AUTO_ON` mode during *bright* light conditions when come back home

#### Heating 🔥
Heating items are turned off automatically, if any Contact item is set to `ON` or `OPEN`. Additionally you can change all thermostats at once or via the default scene, see [default scene](#the-default-scene).

Role|Needed equipment tags|Needed point tags|Needed custom tags
:---|:---|:---|:---
Contact item to adjust heating state|`Door ` **or** `Window `|`OpenState`|
Thermostat mode item|`RadiatorControl `|`SetPoint`|
Temperature measurement item (for visualisation only)||`Measurement` **and** `Temperature`|

To adjust the heating management configuration, you can adjust the following items accordingly.

Item name|Description
:---|:---
Core\_Heating\_Thermostat\_ModeDefault|Set the heating mode. Current choices are `OFF`(0.0), `ON `(1.0), `ECO` (2.0) or `POWER` (3.0)

In order to use a different command mapping for your thermostat, add the following metadata via `core` namespace to the thermostat mode item:

````
heating:
	command-map:
		"0.0": "0" [Send "0" to the thermostat mode item, if heating mode is OFF (0.0)]
		"1.0": "1"
		"2.0": "11"
		"3.0": "15"
````

#### Presence 👋
The presence management will automatically adjust the presence state in dependence to the last presence detection events. The following items are scoped.

Role|Needed equipment tags|Needed point tags|Needed custom tags
:---|:---|:---|:---
Presence trigger item||`Presence`|

To adjust the presence management configuration, you can adjust the following presence items.

Item name|Description
:---|:---
Core_Presence|The actual presence state. Current choices are `HOME`, `AWAY_SHORT` or `AWAY_LONG`
Core\_Presence\_HoursUntilAwayShort|Set hours until presence management sets the presence state to `AWAY_SHORT`
Core\_Presence\_HoursUntilAwayLong|Set hours until presence management sets the presence state to `AWAY_LONG`

Presence items can also trigger absence events. To do so, add the desired state values via namespace `core` to the item with the `Presence` tag as shown below. If no metadata is provided, any `ON`-like state will trigger presence.

````
presence:
	absence-states: [optional, states that trigger absence]
		- "OFF"
	presence-states: [optional, states that trigger presence]
		- "ON"
````

#### Scenes 🎬
Scenes allow multiple devices to be controlled with a single command. For example, in the "Arrival at home" scene, it is possible to switch on all lights and unlock the front door. The following items are scoped.

Role|Needed equipment tags|Needed point tags|Needed custom tags|Description
:---|:---|:---|:---|:---
Scene item|||`CoreScene`|Add `options` to metadata via namespace `stateDescription` to add scene states, e.g. `options="0.0=Chillout,1.0=Party"`.
Scene trigger item|||`CoreSceneTrigger`|Manually changes the state of a given scene.

A scene saves all light switchable items within the same location (as defined in [lights](#lights)). You can change this behavior and use custom scene members by adding the list of items or groups to the metadata object of the scene item via namespace `core` and key `custom-members`. You can add `default:true` to include all default light switchable items.

To change the items states of the scene, each scene item has the following configuration items.

Item name|Group membership|Description
:---|:---|:---
Autogenerated|`gCore_Scenes_StoreTriggers` *and corresponding location group*|Save the current states of all custom scene members as a scene state.
Autogenerated|`gCore_Scenes_StateTriggers` *and corresponding location group*|Scene trigger item that triggers one of the scene states as defined in its metadata.

##### The default scene
In SmartBerry there is a preconfigured default scene named `Core_DefaultScene` with the states `PRESENT`, `AWAY_SHORT`, `AWAY_LONG` or `SLEEP` that applies to the following items and changes them accordingly:

Item name|Description
:---|:---
Core\_Security\_OperationState| See [security](#security) for details
Core\_Heating\_Thermostat\_ModeDefault|See [heating](#heating) for details
Core\_Lights\_DefaultDuration|See [lights](#lights) for details
Member of gCore\_Lights\_DarkMode|See [lights](#lights) for details
Member of gCore\_Lights\_BrightMode|See [lights](#lights) for details
Member of gCore\_Lights\_ObscuredMode|See [lights](#lights) for details

The default scene named `Core_DefaultScene` calls the context states `reset` and `sleep` upon activation of the `SLEEP` state.

##### Advanced scene features
Scenes can also react to context changes by changing its state value. To do so, add the desired state value to the context states via namespace `core`. The following examples adds the context state named `reset`. This way the scene state changes to `0.0` upon a call of `apply_context(>>sceneItem<<, 'reset')`.

````
scenes:
	context-states:
		reset: "0.0"
````

All needed scene trigger items are created by default. However, you can define custom scene trigger items. Just add the `CoreSceneTrigger` tag and define `trigger-state` in metadata namespace `core` as shown below.

````
scenes:
	trigger-state:
		target-scene: >>sceneItemName<<
		from: >>initialState<< [optional, only triggers if scene is in that state]
		to: >>newState<<
		states:  [optional]
			- "ON"
			- "OPEN"
````

#### Security 🔒
The security system protects your home and responds to any unauthorized activity. The following items are scoped.

Role|Needed equipment tags|Needed point tags|Needed custom tags|Description
:---|:---|:---|:---|:---
Assault trigger items|`Window` **or** `Door`|`OpenState` **or** `Switch`|`CoreAssaultTrigger`|Items that trigger the alarm, if assault detection is activated
Assault Disarmer items||`OpenState` **or** `Switch`|`CoreAssaultDisarmer `|Items that disarm the assault detection, if item state updated to `ON ` or `OPEN`
Lock closure items||`OpenState` **or** `Switch`|`CoreLockClosure`|Items that close a lock item within the same location, reacts to `OFF ` or `CLOSED`
Lock items|`Lock`|`OpenState` **or** `Switch`||Lock items that may be closed by a door or window contact
Sirene items||`Alarm`||Items that are triggered after an assault detection, if assault detection is activated

To adjust general configurations within the security context, you can modify the following items.

Item name|Description
:---|:---
Core\_Security\_OperationState |Set the current assault detection state. Current choices are `OFF`, `SILENTLY` or `ON`.
Core\_Security\_SireneAutoOff|Set minutes until the siren will turn off automatically. Set to zero to disable the auto-off functionality.

#### Timed Outlets ⏱️
Timed outlet items switch off after a defined interval. The interval can be set individually for each item. The following items are scoped.

Role|Needed equipment tags|Needed point tags|Needed custom tags
:---|:---|:---|:---
Timed outlet item||`Switch `|`CoreTimedOutlet` (Equipment layer)

To adjust the timed outlet configuration, you can adjust the following timed outlet related items.

Item name|Group membership|Description
:---|:---|:---
Autogenerated|`gCore_TimedOutlets_ActiveDuration` *and corresponding location group*|Set minutes until corresponding timed outlet will turn off again
