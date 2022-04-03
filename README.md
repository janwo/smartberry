# <center>SmartBerry 🍓 - Smart Home 🏡</center>

_<center>SmartBerry is an openHAB environment providing multiple extensions to simplify the configuration of scenes, climate and security management.</center>_

### Getting Started

It is recommend to use SmartBerry in a docker container using `docker compose`. The easiest way to do so, is a deployment of SmartBerry via [balenaCloud](https://www.balena.io/cloud/). Just add the project to your balena applications and select a supported device. You also like to change the hostname of your device to `smartberry` - to do so, study these [notes](https://www.balena.io/docs/learn/develop/runtime/#change-the-device-hostname).

[![balena deploy button](https://www.balena.io/deploy.svg)](https://dashboard.balena-cloud.com/deploy?repoUrl=https%3A//github.com/janwo/smartberry)

In order to adjust general settings of your SmartBerry instance, you may add the following environment variables.

| Environment variable               | Description                                                                                                                                                                                           |
| :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SAMBA_PASSWORD` (mandatory)       | Define the default password in order to access `smb://smartberry`                                                                                                                                     |
| `OPENHAB_HOSTKEY` (recommended)    | Set the hostkey to keep the device in the _known_ host on your computer.                                                                                                                              |
| `OPENHAB_UUID` (recommended)       | Set your openhab uuid for [`myopenhab.org`cloud service](https://myopenhab.org/).                                                                                                                     |
| `OPENHAB_SECRET` (recommended)     | Set your openhab secret for [`myopenhab.org`cloud service](https://myopenhab.org/).                                                                                                                   |
| `JWT_SECRET` (recommended)         | Set a secret to salt your connection of openhab-helper.                                                                                                                                               |
| `BLUETOOTH_BEACON_UUID` (optional) | For locks or smartphone apps it may be useful for you to work with [iBeacons](https://de.wikipedia.org/wiki/IBeacon). If supported by your hardware, you can define a constant bluetooth beacon uuid. |

After starting up, SmartBerry is available on port `8080`. To make SmartBerry manage your home in its full potential, you can also access the helper application on port `8081`. Please also refer to the documentation of [openHAB](https://www.openhab.org/docs/).

If you have any questions, just let them know in the _Issues_.
