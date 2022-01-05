#!/bin/sh
set -eu

# Remove old core files within conf-folder
echo "reset-conf-directories.sh: Reset old core files in ${OPENHAB_HOME}/conf/sitemaps..."
find ${OPENHAB_HOME}/conf/sitemaps -type f -name 'core-*.sitemap' -delete

echo "reset-conf-directories.sh: Reset old core files in ${OPENHAB_HOME}/conf/items..."
find ${OPENHAB_HOME}/conf/items -type f -name 'core-*.items' -delete
find ${OPENHAB_HOME}/conf/items -type f -name 'core_*.items' -delete

echo "reset-conf-directories.sh: Reset old core files in ${OPENHAB_HOME}/conf/rules..."
find ${OPENHAB_HOME}/conf/rules -type f -name 'core-*.rules' -delete

echo "reset-conf-directories.sh: Reset old core files in ${OPENHAB_HOME}/conf/transform..."
find ${OPENHAB_HOME}/conf/transform -type f -name 'core-*.map' -delete
