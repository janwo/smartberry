#!/bin/sh
set -eu

# Start addons.cfg transformations
ADDONS_FILE=${OPENHAB_HOME}/conf/services/addons.cfg

if [ -f $ADDONS_FILE ]; then
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

    AUTOMATION_LINE="$(grep -E '^[^#]?\s?automation' ${ADDONS_FILE} || echo '')"
    if [ "${AUTOMATION_LINE}" != '' ]; then
        if [[ "${AUTOMATION_LINE}" != *"jsscripting"* ]]; then
            sed -n -e 's/automation\s\?=\s\?/automation = jsscripting,/' ${ADDONS_FILE}
        fi
    else
        ## Just append last line
        echo "automation = jsscripting" >> ${ADDONS_FILE}
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
else
    echo "addons.sh: \$ADDONS_FILE=$ADDONS_FILE not found!"
fi
