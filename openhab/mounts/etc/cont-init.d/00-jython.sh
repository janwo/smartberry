export EXTRA_JAVA_OPTS="${EXTRA_JAVA_OPTS} ${JYTHON_JAVA_OPTS}"
rsync -a /tmp/jython/automation ${OPENHAB_HOME}/conf
cp ${OPENHAB_HOME}/conf/automation/lib/python/configuration.py.example ${OPENHAB_HOME}/conf/automation/lib/python/configuration.py
find ${OPENHAB_HOME}/conf/automation/lib/python -name '*\$py.class' -delete

## Ensure we are running new rule engine addon - is there a better way?
MISC_LINE=$(grep '^[[:space:]]\?misc' ${OPENHAB_HOME}/conf/services/addons.cfg)
if [ $? -eq 0 ]; then
  ## ensure we have ruleengine enabled
  if [[ ${MISC_LINE} == *"ruleengine"* ]]; then
    echo "New rule engine is already included in the addons.cfg"
  else
    sed -i 's/misc\s\?=\s\?/misc = ruleengine,/' ${OPENHAB_HOME}/conf/services/addons.cfg
  fi
else
  ## Just append last line
  echo "misc = ruleengine" >> ${OPENHAB_HOME}/conf/services/addons.cfg
fi
