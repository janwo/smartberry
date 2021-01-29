#!/bin/sh
set -eu

# Add settings to main page
TARGET_JSON=${OPENHAB_HOME}/userdata/jsondb/uicomponents_ui_page.json
REPLACEMENT_JSON=/etc/cont-init.d/40-post-adjustments/~mainui-settings.json

if [ -f $TARGET_JSON && -f $REPLACEMENT_JSON ]; then
    TMP_JSON=${TARGET_JSON}.tmp

    jq --slurpfile REPLACEMENT ${REPLACEMENT_JSON} \
    '(del(.overview.value.slots.default[]|select(.config.title=="Einstellungen")).overview.value.slots.default+[$REPLACEMENT]) as $array|.overview.value.slots.default=$array' \
    ${TARGET_JSON} > ${TMP_JSON} && mv ${TMP_JSON} ${TARGET_JSON}
fi
