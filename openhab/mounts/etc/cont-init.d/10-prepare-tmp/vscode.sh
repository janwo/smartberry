#!/bin/sh
set -eu

# Make python linting possible
sed -n -e "s?AUTH_OPENHAB_PASSWORD?${AUTH_OPENHAB_PASSWORD}?g" /tmp/${OPENHAB_HOME}/conf/.vscode/settings.json
