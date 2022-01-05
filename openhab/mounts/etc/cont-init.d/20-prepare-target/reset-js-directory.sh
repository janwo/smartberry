#!/bin/sh
set -eu

# Remove old js files in js directory
AUTOMATION_LIB_JS_PATH=${OPENHAB_HOME}/conf/automation/js
if [ -d ${AUTOMATION_LIB_JS_PATH} ]; then
    echo "reset-js-directory.sh: Reset old core files in ${AUTOMATION_LIB_JS_PATH}..."
    find $AUTOMATION_LIB_JS_PATH -type f -name 'core-*.js' -exec rm -f {} +
else
    echo "reset-js-directory.sh: \$AUTOMATION_LIB_JS_PATH=$AUTOMATION_LIB_JS_PATH not found!"
fi