#!/bin/sh
#export USER_2="influxdb;test"
#export USER_1="openhab;test;9001;openhab;9001"
#export USER_3="grafana;test;472;grafana;472"
exec /usr/bin/samba.sh "$@ -u \"test1;test\" \
            -u \"test2;test;9001;openhab1;9001\" \
            -u \"test3;test;472;grafana1;472\" \
            -s \"smartberry;/mount/openhab;yes;no;no;openhab\" \
            -s \"smartberry;/mount/grafana;yes;no;no;grafana\" \
            -s \"smartberry;/mount/influxdb;yes;no;no;influxdb\""
