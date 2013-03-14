#!/bin/sh 

PHANTOMJS=/home/ubuntu/lib/phantomjs/bin/phantomjs
SCRIPT_BASE=/home/ubuntu/lpgdata/js
SCRIPT="$SCRIPT_BASE/indane.js"

STATE=$1
CITY=$2 
    
OUTPUT="$SCRIPT_BASE/data/$STATE-$CITY.output.txt"
$PHANTOMJS $SCRIPT $STATE $CITY >> $OUTPUT
