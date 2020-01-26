export EXTRA_JAVA_OPTS="${EXTRA_JAVA_OPTS} ${JYTHON_JAVA_OPTS}"
AUTOMATION_LIB_PYTHON_PATH=${OPENHAB_HOME}/conf/automation/lib/python
AUTOMATION_JSR223_PYTHON_PATH=${OPENHAB_HOME}/conf/automation/jsr223/python
[ ! -d "$AUTOMATION_LIB_PYTHON_PATH" ] && mkdir -p "$AUTOMATION_LIB_PYTHON_PATH"
find $AUTOMATION_LIB_PYTHON_PATH -name '*\$py.class' -delete
[ ! -d "$AUTOMATION_JSR223_PYTHON_PATH/personal" ] && mkdir -p "$AUTOMATION_JSR223_PYTHON_PATH/personal"
find $AUTOMATION_JSR223_PYTHON_PATH/personal -type f -name 'core-*.py' -delete
mv /tmp/jython/automation/lib/python/configuration.py.example /tmp/jython/automation/lib/python/configuration.py
mv /tmp/jython/automation/lib/python/personal/__init__.py.example /tmp/jython/automation/lib/python/personal/__init__.py
rsync -a /tmp/jython/automation ${OPENHAB_HOME}/conf
