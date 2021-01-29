#!/bin/sh
set -eu

# Make python linting possible
if [ ! -z ${AUTH_OPENHAB_PASSWORD+x} ]; then
    FILE=/tmp/${OPENHAB_HOME}/conf/.vscode/settings.json
    echo "vscode.sh: Adjust $FILE with \$AUTH_OPENHAB_PASSWORD..."
    sed -n -e "s?AUTH_OPENHAB_PASSWORD?${AUTH_OPENHAB_PASSWORD}?g" $FILE
else
    echo 'vscode.sh: $AUTH_OPENHAB_PASSWORD not set!'
fi
