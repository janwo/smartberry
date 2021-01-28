#!/bin/sh

TARGET_JSON=${OPENHAB_HOME}/userdata/jsondb/uicomponents_ui_page.json
TMP_JSON=${TARGET_JSON}.tmp
REPLACEMENT_JSON=./30-pages.json

jq --slurpfile REPLACEMENT ${REPLACEMENT_JSON} \
'(del(.overview.value.slots.default[]|select(.config.title=="Einstellungen")).overview.value.slots.default+[$REPLACEMENT]) as $array|.overview.value.slots.default=$array' \
${TARGET_JSON} > ${TMP_JSON} && mv ${TMP_JSON} ${TARGET_JSON}
