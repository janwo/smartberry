#!/bin/sh
set -eu

# Remove old jython files in jython directory
AUTOMATION_LIB_PYTHON_PATH=${OPENHAB_HOME}/conf/automation/lib/python
AUTOMATION_JSR223_PYTHON_PATH=${OPENHAB_HOME}/conf/automation/jsr223/python
if [ -d ${AUTOMATION_LIB_PYTHON_PATH} ]; then
    echo "reset-jython-directory.sh: Reset old core files in ${AUTOMATION_LIB_PYTHON_PATH}..."
    find $AUTOMATION_LIB_PYTHON_PATH/core/* -type f -exec rm -f {} +
    find $AUTOMATION_LIB_PYTHON_PATH/community/* -type f -exec rm -f {} +
    find $AUTOMATION_LIB_PYTHON_PATH -type f -name '$py.class' -exec rm -f {} +
    find $AUTOMATION_LIB_PYTHON_PATH -type f -name 'core_*.py' -exec rm -f {} +
else
    echo "reset-jython-directory.sh: \$AUTOMATION_LIB_PYTHON_PATH=$AUTOMATION_LIB_PYTHON_PATH not found!"
fi

if [ -d ${AUTOMATION_JSR223_PYTHON_PATH} ]; then
    echo "reset-jython-directory.sh: Reset old core files in ${AUTOMATION_JSR223_PYTHON_PATH}..."
    find $AUTOMATION_JSR223_PYTHON_PATH/core/* -type f -exec rm -f {} +
    find $AUTOMATION_JSR223_PYTHON_PATH/community/* -type f -exec rm -f {} +
    find $AUTOMATION_JSR223_PYTHON_PATH -type f -name '$py.class' -exec rm -f {} +
    find $AUTOMATION_JSR223_PYTHON_PATH -type f -name 'core_*.py' -exec rm -f {} +
else
    echo "reset-jython-directory.sh: \$AUTOMATION_JSR223_PYTHON_PATH=$AUTOMATION_JSR223_PYTHON_PATH not found!"
fi
