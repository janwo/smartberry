#!/bin/sh
AUTOMATION_LIB_PYTHON_PATH=${OPENHAB_HOME}/conf/automation/lib/python
AUTOMATION_JSR223_PYTHON_PATH=${OPENHAB_HOME}/conf/automation/jsr223/python
[ ! -d "$AUTOMATION_LIB_PYTHON_PATH" ] && mkdir -p "$AUTOMATION_LIB_PYTHON_PATH/personal"
find $AUTOMATION_LIB_PYTHON_PATH -type f -name '*\$py.class' -delete
find "$AUTOMATION_LIB_PYTHON_PATH/personal" -type f -name 'core_*.py' -delete
[ ! -d "$AUTOMATION_JSR223_PYTHON_PATH/personal" ] && mkdir -p "$AUTOMATION_JSR223_PYTHON_PATH/personal"
find $AUTOMATION_JSR223_PYTHON_PATH/personal -type f -name 'core_*.py' -delete
rsync -a /tmp/jython/automation ${OPENHAB_HOME}/conf
