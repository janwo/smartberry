#!/bin/sh

if grep -q -F /`basename $SWAPFILE` /proc/swaps; then
   echo "swap file already present"
   exit
fi

mkdir -p `dirname $SWAPFILE` && dd if=/dev/zero of=$SWAPFILE bs=1024k count=$SWAPSIZE && mkswap $SWAPFILE && chmod 0600 $SWAPFILE && swapon $SWAPFILE && echo "$SWAPFILE none swap sw 0 0" >> /etc/fstab && echo "created swap file"
