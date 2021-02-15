#!/bin/sh
set -eu

# Start log4j2.xml transformations
LOG_CONFIG_FILE=${OPENHAB_HOME}/userdata/etc/log4j2.xml

if [ -f $LOG_CONFIG_FILE ]; then
    echo "logging.sh: Adjust $LOG_CONFIG_FILE..."
   # TODO sed -n -e 's:<!-- Root logger configuration -->.*<\/Root>:<!-- Root logger configuration -->
   # <Root level="INFO">
   #     <AppenderRef ref="LOGFILE"/>
   #     <AppenderRef ref="OSGI"/>
   #     <AppenderRef ref="STDOUT"/>
    #</Root>:' ${LOG_CONFIG_FILE}
else
    echo "logging.sh: \$LOG_CONFIG_FILE=$LOG_CONFIG_FILE not found!"
fi
