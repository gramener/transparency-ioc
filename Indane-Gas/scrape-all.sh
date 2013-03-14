#!/bin/sh 

PHANTOMJS=/home/ubuntu/lib/phantomjs/bin/phantomjs
SCRIPT_BASE=/home/ubuntu/lpgdata/js
SCRIPT="$SCRIPT_BASE/indane.js"


for i in `grep -v cities indane.csv | cut -d"," -f1,3` 
do 
    STATE=`echo $i | cut -d"," -f1` 
    MAXCITY=`echo $i | cut -d"," -f2`  

#    if  [ $STATE -lt 5 ]
#    then
#	echo "Skipping < 5"; 
#	continue
#    fi 
      
    
    for CITY in ` seq $MAXCITY` 
    do 
	OUTPUT="$SCRIPT_BASE/data/$STATE-$CITY.output.txt"
	$PHANTOMJS $SCRIPT $STATE $CITY >> $OUTPUT
    done
done
