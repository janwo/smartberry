#!/bin/sh
set -eu

# Remove old core files within conf-folder
echo "reset-conf-directories.sh: Reset old core files in ${OPENHAB_HOME}/conf/items..."
find ${OPENHAB_HOME}/conf/items -type f -name 'core-*.items' -delete
find ${OPENHAB_HOME}/conf/items -type f -name 'core_*.items' -delete
