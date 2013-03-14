Contents
--------

This directory has two things: 

1. Pointer to already scraped data (~ 5M records). Feel to download
and analyze. 

2. PhantomJS code using which the data was scraped. 

About the Scraper 
-----------------

I havent looked at it in a while. It is readable but relatively
undocumented. It is not complicated though. We simulate the effect of
a headless browser clicking various buttons in a particular sequence
and extracting the html table data from each page. Had to use
PhantomJS and javascript-based scraper because of AJAX
variables/server hypersensitivity to them etc. If I were reimplement
this, I would probably use a chrome extension. I started working on it
but it not done. I am not working on it. Happy to share if it helps.

How to Run
----------

# for a single city within a single state: 
$ sh scrape-single.sh <state-code> <city-code>

# Capture entire site 
$ sh scrape-all.sh 

Acknowledgements 
---------------

Indane Gas - who have put up this site 
Viral - Concept 
Venkata Pingali - Implementation 

-Venkata Pingali
pingali@gmail.com
