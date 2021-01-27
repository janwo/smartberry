#!/bin/sh

AUTOMATION_LIB_PYTHON_PATH=${OPENHAB_HOME}/conf/automation/lib/python
AUTOMATION_JSR223_PYTHON_PATH=${OPENHAB_HOME}/conf/automation/jsr223/python
if [ -d ${AUTOMATION_LIB_PYTHON_PATH} ]; then
    find $AUTOMATION_LIB_PYTHON_PATH/core/* -type f -exec rm -f {} +
    find $AUTOMATION_LIB_PYTHON_PATH -type f -name '$py.class' -exec rm -f {} +
    find $AUTOMATION_LIB_PYTHON_PATH -type f -name 'core_*.py' -exec rm -f {} +
fi

if [ -d ${AUTOMATION_JSR223_PYTHON_PATH} ]; then
    find $AUTOMATION_JSR223_PYTHON_PATH/core/* -type f -exec rm -f {} +
    find $AUTOMATION_JSR223_PYTHON_PATH -type f -name '$py.class' -exec rm -f {} +
    find $AUTOMATION_JSR223_PYTHON_PATH -type f -name 'core_*.py' -exec rm -f {} +
fi
