#!/bin/sh
set -eu

# Start addons.cfg transformations
ADDONS_FILE=${OPENHAB_HOME}/conf/services/addons.cfg

TRANSFORMATION_LINE="$(grep -E '^[^#]?\s?transformation' ${ADDONS_FILE} || echo '' )"
if [ "${TRANSFORMATION_LINE}" != '' ]; then
    if [[ "${TRANSFORMATION_LINE}" != *"map"* ]]; then
        sed -n -e 's/transformation\s\?=\s\?/transformation = map,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "transformation = map" >> ${ADDONS_FILE}
fi

MISC_LINE="$(grep -E '^[^#]?\s?misc' ${ADDONS_FILE} || echo '' )"
if [ "${MISC_LINE}" != '' ]; then
    if [[ "${MISC_LINE}" != *"openhabcloud"* ]]; then
        sed -n -e 's/misc\s\?=\s\?/misc = openhabcloud,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "misc = openhabcloud" >> ${ADDONS_FILE}
fi

AUTOMATION_LINE="$(grep -E '^[^#]?\s?automation' ${ADDONS_FILE} || echo '')"
if [ "${AUTOMATION_LINE}" != '' ]; then
    if [[ "${AUTOMATION_LINE}" != *"jythonscripting"* ]]; then
        sed -n -e 's/automation\s\?=\s\?/automation = jythonscripting,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "automation = jythonscripting" >> ${ADDONS_FILE}
fi

PERSISTENCE_LINE="$(grep -E '^[^#]?\s?persistence' ${ADDONS_FILE} || echo '' )"
if [ "${PERSISTENCE_LINE}" != '' ]; then
    if [[ "${PERSISTENCE_LINE}" != *"rrd4j"* ]]; then
        sed -n -e 's/persistence\s\?=\s\?/persistence = rrd4j,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "persistence = rrd4j" >> ${ADDONS_FILE}
fi
