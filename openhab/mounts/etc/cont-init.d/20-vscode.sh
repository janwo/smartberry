#!/bin/sh
sed -i "s?AUTH_OPENHAB_PASSWORD?${AUTH_OPENHAB_PASSWORD}?g" /tmp/openhab/conf/.vscode/settings.json
