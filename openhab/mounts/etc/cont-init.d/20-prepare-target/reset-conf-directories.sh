#!/bin/sh
set -eu

# Remove old core files within conf-folder
find ${OPENHAB_HOME}/conf/sitemaps -type f -name 'core_*.sitemap' -delete
find ${OPENHAB_HOME}/conf/items -type f -name 'core_*.items' -delete
find ${OPENHAB_HOME}/conf/rules -type f -name 'core_*.rules' -delete
find ${OPENHAB_HOME}/conf/transform -type f -name 'core_*.map' -delete
