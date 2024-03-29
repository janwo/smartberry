#!/bin/sh
set -eu

# Add settings on main page
TARGET_JSON=${OPENHAB_HOME}/userdata/jsondb/uicomponents_ui_page.json
REPLACEMENT_JSON=/etc/cont-init.d/40-post-adjustments/~mainui-quicksettings.json

if [ -f $TARGET_JSON ] && [ -f $REPLACEMENT_JSON ]; then
    TMP_JSON=${TARGET_JSON}.tmp
    echo "mainui-settings.sh: Adjust $TARGET_JSON with $REPLACEMENT_JSON..."

    jq --slurpfile REPLACEMENT ${REPLACEMENT_JSON} \
    '(del(.overview.value.slots.default[]|select(.config.id=="quicksettings")).overview.value.slots.default+$REPLACEMENT) as $array|.overview.value.slots.default=$array' \
    ${TARGET_JSON} > ${TMP_JSON} && chown -R openhab:openhab ${TMP_JSON} && mv ${TMP_JSON} ${TARGET_JSON}
    # Wanna try this in jqplay? See https://jqplay.org/s/HSLvRn81xq
else
    echo "mainui-settings.sh: \$TARGET_JSON=$TARGET_JSON or \$REPLACEMENT_JSON=$REPLACEMENT_JSON not found!"
fi