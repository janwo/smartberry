#!/bin/sh
AUTOMATION_LIB_PYTHON_PATH=${OPENHAB_HOME}/conf/automation/lib/python
AUTOMATION_JSR223_PYTHON_PATH=${OPENHAB_HOME}/conf/automation/jsr223/python
find $AUTOMATION_LIB_PYTHON_PATH -type f -name '*\$py.class' -delete
find "$AUTOMATION_LIB_PYTHON_PATH/personal" -type f -name 'core_*.py' -delete
find $AUTOMATION_JSR223_PYTHON_PATH/personal -type f -name 'core_*.py' -delete
