#!/bin/sh

echo "States" 
ls data/*state* | cut -d"-" -f1 | cut -d"/" -f2 | uniq | sort | tail -1

echo "Towns"
ls data/*stat* | wc -l 

echo "Total Records"
grep scraped_records data/*state* | cut -d: -f3 | awk -F: '{total+=$1} END{print total}'

LAST_FILE=`ls -t data/*state*| head -1`
echo $LAST_FILE 
echo ""
tail $LAST_FILE

echo "" 
echo "Raw data size "
du -h data

echo "No Activity" 
grep "No activity" data/*log* | wc -l 

echo "" 
echo "Incomplete" 
grep incomplete data/*state* | wc -l 
