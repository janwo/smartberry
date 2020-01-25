export EXTRA_JAVA_OPTS="${EXTRA_JAVA_OPTS} ${JYTHON_JAVA_OPTS}"
rsync -a /tmp/jython/automation ${OPENHAB_HOME}/conf
mv ${OPENHAB_HOME}/conf/automation/lib/python/configuration.py.example ${OPENHAB_HOME}/conf/automation/lib/python/configuration.py
mv ${OPENHAB_HOME}/conf/automation/lib/python/personal/__init.py.example ${OPENHAB_HOME}/conf/automation/lib/python/personal/__init.py
find ${OPENHAB_HOME}/conf/automation/lib/python -name '*\$py.class' -delete
