/* 
 * Scraper to grab indane transparency portal data 
 */ 
var fs = require('fs');
var indanesite="http://indane.co.in/transparency/index.php";

/*
 * Command line parsing and creation of the state object...
 */ 
if (phantom.args.length < 2) {
    console.log('Usage: indane.js <state-num> <city-num> [max_distributors] [max_pages]');
    phantom.exit();
} 

/* 
 * Default value
 */ 
var target_state = parseInt(phantom.args[0]);
var target_city = parseInt(phantom.args[1]);
var target_max_distributors = 0;
var target_max_pages = 0;

if (phantom.args.length > 2){
    var max_distributors = parseInt(phantom.args[2]);
    if (max_distributors > 0){ 
	target_max_distributors = max_distributors; 
    }; 
};
if (phantom.args.length > 3){
    var max_pages = parseInt(phantom.args[3]);
    if (max_pages > 0){ 
	target_max_pages  = max_pages; 
    }; 
}

/* 
 * Check ever 30 seconds to see if there is activity. If none, then
 * exit.
 */
var connection_timeout = 12000;
var connection_magic = 0xdeadbeef; 
var connection_counter = connection_magic; 
function note_activity(){ connection_counter--; }
function is_active(){ return (connection_counter != connection_magic); }
function reset_activity(){ connection_counter = connection_magic; }
window.setInterval(function(){
    if (is_active()){
	reset_activity(); 
    } else { 
	scrape_log("No activity for 120 seconds. So exiting."); 
        scrape_status['status'] = "incomplete";
	store_state(); 
	complete_distributor(); 
    };
}, connection_timeout); 

/*
 * State ....
 */ 

var scrape_log_status = []; 
var scrape_status = {
    status: "ok", 
    target_state: target_state,
    target_city: target_city,
    max_cities: 0, 
    
    processing_distributor: 0,
    max_distributors: target_max_distributors,
    waiting_distributors: [], 
    completed_distributors: [],
    skip_distributors: ["--ALL DISTRIBUTORS--", "[ SELECT DISTRIBUTOR ]"],
    distributor_names: [],
    
    processing_page: 1, 
    max_pages: target_max_pages, 

    scraped_pages: 0, 
    scraped_records: 0, 
    
}; 

/*
 * Load/capture the state 
 */ 

function get_data_dir(){
    return "data" 
}
function get_prefix(){     
    var data_dir = get_data_dir();
    var prefix = data_dir + "/" + scrape_status['target_state'] + 
	             "-" + scrape_status['target_city']; 
    return prefix
}

function get_file(func){ 
    return get_prefix() + "." + func + ".txt";
};

function load_state(){
    from_file = JSON.parse(fs.read(get_file('state')));
    for(i in from_file){
	scrape_status[i]=from_file[i];
    };
    store_state() 

    scrape_log_status = JSON.parse(fs.read(get_file('log')));

    console.log("Scrape status = " + 
		JSON.stringify(scrape_status, "undefined", 4));
};

function validate_state(){
    if (scrape_status['status'] == 'completed'){
	console.log("This state and city combination has been captured"); 
	phantom.exit(); 
    };
    console.log("Validated state"); 
    
}

function scrape_log(msg){
    // log the change 
    if (typeof(msg) == "string"){ 
	var d = new Date(); 
	var log_entry = { ts: d.getTime(), msg: msg };
	console.log("Logging: " + JSON.stringify(log_entry)); 
	scrape_log_status.unshift(log_entry); 
    };
}; 

function store_state(msg){

    note_activity(); // Take care of timeout...

    scrape_log(msg);    
    fs.write(get_file('state'), 
	     JSON.stringify(scrape_status, "undefined", 4),
	     "w");
    fs.write(get_file('log'), 
	     JSON.stringify(scrape_log_status, "undefined", 4),
	     "w");    
    console.log("Saved state"); 
};

function distributor_list_initialized(){
    var result = ((scrape_status['waiting_distributors'].length > 0) || 
		  (scrape_status['completed_distributors'].length > 0));
    // console.log("distributor list initialized? " + result); 
    return result; 
}

function move_to_next_distributor() {
    if (scrape_status['waiting_distributors'].length > 0){ 
	scrape_status['processing_distributor'] = 
            scrape_status['waiting_distributors'].shift(); 
	scrape_log("Updated distributors list (new length = " +
		   scrape_status['waiting_distributors'].length +
		   " )");
	return scrape_status['processing_distributor'];
    } else { 
	scrape_log('No more distributors to process'); 
	return -1;
    }
};

function get_current_distributor_name(){
    d = scrape_status['processing_distributor'];
    if (d == -1){
	return "x";
    } else if (d < scrape_status['distributor_names'].length){
	return scrape_status['distributor_names'][d];
    } else {
	return "UNKNOWN" 
    }
};

function update_max_cities(max_cities){
    if (scrape_status['max_cities'] == 0){
	scrape_status['max_cities'] = max_cities; 
	store_state('Updated max_cities'); 
    }
}

function update_distributor_list(max_distributors, distributor_names){
    console.log("Updating distributor list... " + max_distributors + 
	       " with names = " + distributor_names); 
    try { 
	if (scrape_status['waiting_distributors'].length == 0){
	    for (i = 1; i < max_distributors; i++){ 
		if (i != scrape_status['processing_distributor']){ 
		    scrape_status['waiting_distributors'].push(i);
		};
	    };
	    scrape_status['distributor_names'] = distributor_names;
	    store_state('updated distributors list'); // save this state...
	};
    } catch(err){
	console.log("Exception! error is " + err.message);
    }
    console.log("Returning from updating distributor list..."); 
};

function complete_distributor() {
    console.log("Completing distributor");
    d = scrape_status['processing_distributor']; 
    console.log("Complete distributor - " + get_current_distributor_name()); 

    // this is mostly a sanity check to ensure that there are no 
    // loops 
    if (scrape_status['completed_distributors'].indexOf(d) < 0){
	scrape_status['completed_distributors'].push(d);
    } else {
	scrape_log("Found a duplicate!!! " + d)
    }

    scrape_status['processing_distributor'] = -1; 
    scrape_status['max_pages'] = target_max_pages; 
    console.log("Updated scrape status in complete distributor"); 
    if (move_to_next_distributor() < 0){ 
	scrape_status['status'] = 'completed'; 
    };
    
    console.log("scrape status = " + 
		JSON.stringify(scrape_status, "undefined", 4));
    store_state(); 
    
    // Now restart the whole process or terminate 
    if (scrape_status['processing_distributor'] == -1){
	phantom.exit() 
    } else {
	// Restart the process...
	phantom.state = "start"; 
	evaluate(page, function(args){ 
            indanesite = args['indanesite'];
	    document.location.href = indanesite;
	}, {indanesite: indanesite});
    };
};

/* 
 * Dump the next page of scraped data 
 */ 
function store_dump(pagenum, status, data){
    console.log("Entering dump"); 
    try { 
	var distributor = scrape_status['processing_distributor'];
	var distributor_name = scrape_status['distributor_names'][distributor]
	var data_file = get_file('dump');
	var d = new Date();
	var ts = d.getTime();
	var final_data = 
	    "\n# BEGIN Page " + pagenum + " of " + distributor + 
	    "  " + status + " " + ts + "\n" + 
	    data + "\n" + 
	    "# END Page " + pagenum + "\n"; 
	fs.write(data_file, final_data, "a");
    } catch(err){
	console.log("Exception! error is " + err.message);
    };
    console.log("Finished dumping page"); 
}

/* Initialize it if necessary */ 
if (!fs.exists(get_data_dir())){ fs.makeDirectory(get_data_dir()); }
if (fs.exists(get_file('state'))){
    load_state(); 
} else {
    store_state()
}
validate_state();

/*
  Real Work starting now...
*/ 
var page = new WebPage();
page.settings.userAgent = "Friendly Research Bot"; 
phantom.state = "start"; 

/*
 * This function wraps WebPage.evaluate, and offers the possibility to pass
 * parameters into the webpage function. The PhantomJS issue is here:
 * 
 *   http://code.google.com/p/phantomjs/issues/detail?id=132
 * 
 * This is from comment #43.
 */
function evaluate(page, func) {
    var args = [].slice.call(arguments, 2);
    var fn = "function() { return (" + func.toString() + ").apply(this, " + JSON.stringify(args) + ");}";
    if ((page == null) || (typeof(page) == "undefined")){
	scrape_status['status'] = 'crashed'; 
	store_state("Exiting due to segfault page = null"); 
	console.log("FATAL: page = " + page); 
	phantom.exit();
    }
    return page.evaluate(fn);
}

/*
 * Debug 
 */
page.onError = function (msg, trace) {
    console.log(msg);
    trace.forEach(function(item) {
        console.log('  ', item.file, ':', item.line);
    })
}

page.onAlert = function (msg) {
    console.log("+alert:" + msg);
};

page.onConsoleMessage = function (msg) {
    console.log("+eval:" + msg);
};

page.onResourceRequested = function (req) {
    // console.log("In resource requested - " + phantom.state);
    if (phantom.state != "start"){
	//console.log("Requested URL " + req.getAttribute('url'));
    }
};


/*
 * Main function to scrape the pages...
 */

function select_state() {
    var result = evaluate(page, function(args) {

	function simulate_change(obj){ 
	    var evt = document.createEvent("HTMLEvents");
	    evt.initEvent("change", false, true);
	    obj.dispatchEvent(evt);
	};
	
	window.target_state = args['target_state']
	console.log("Targeting state = " + window.target_state) 
	
	// Selecting the state 
	var stateobj = document.querySelector('#bgstate');
	if (stateobj == null){
	    return {
		status: "error",
		content: document.all[0].innerHTML
	    };
	};

	if ((target_state > stateobj.options.length) || 
	    (target_state < 1)){
	    return {
		status: "invalid",
	    };
	}
	
	stateobj.options[target_state].selected = true; 
	stateobj.options.selectedIndex = target_state; 
	stateobj.onchange();
	simulate_change(stateobj); 
	console.log("Fired on change on state object"); 
	return {
	    status: "successful",
	};
	
    }, {
	target_state: scrape_status['target_state'],
    });
    
    if (result['status'] == "error"){
	store_dump(0, "ERROR", result['content']);
	store_state("Error while getting the main page"); 
	console.log("Unable to access main page"); 
	phantom.exit() 
    } else if (result['status'] == "invalid"){
	scrape_status['status'] = "invalid"; 
	store_state("Invalid state id"); 
	phantom.exit() 
    } else {
	phantom.state = "stateselected";
    };
};



function read_page(){
    
    console.log("read_page: page = " + page + " " + typeof(page)); 

    var pageinfo = evaluate(page, function(args){
	
	var max_pages = args['max_pages'];

	// Click on "Next". This should eventually go into a 
	// js file that we are going to inject into the html 
	function simulate_click(obj){ 
	    var evt = document.createEvent('MouseEvents');
	    evt.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null); 
	    obj.dispatchEvent(evt); 
	}

	console.log("Looking at new page");
	tableobj = document.querySelector('.mytable');
	if ((tableobj == null) || (typeof(tableobj) == "undefined")){
	    // Genuine error! 
	    content = document.all[0].innerHTML; 
	    console.log("Error! Seeing this..." + content);
	    return { 
		status: "error", 
		current_page: -1, 
		content: content, 
		max_pages: -1,
		records: -1, 
		following: false,
	    };	
	};

	content = tableobj.innerHTML 
	pagenumber_obj = document.querySelector('select[name="pagenumbers"]')
	console.log("page number obj = " + pagenumber_obj)
	
	// Check the page numbers...
	if ((typeof pagenumber_obj == "undefined") || 
	    (pagenumber_obj == null)){ 
	    if (document.all[0].innerHTML.match(/No records found/) != null){
		// No record found 
		console.log("No records found!");
		return { 
		    status: "successful", 
		    current_page: 1, 
		    content: content, 
		    max_pages: 1,
		    records: 0, 
		    following: false,
		};
	    } else { 
		// Genuine error! 
		console.log("Error! Seeing this..." + content);
		return { 
		    status: "error", 
		    current_page: -1, 
		    content: content, 
		    max_pages: -1,
		    records: -1, 
		    following: false,
		};
	    };
	};
	
	//console.log("page numbers = " + pagenumber_obj.innerHTML); 
	current_page = pagenumber_obj.selectedIndex;
	max_pages_available = pagenumber_obj.options.length;
	if (max_pages <= 0){
	    // If there is no target number of pages, then use the 
	    // max num available
	    max_pages = max_pages_available;
	}
	
	// records
	records = document.querySelectorAll(".row00").length + 
	    document.querySelectorAll(".row01").length;

	// Update the link ...
	aobj = $('a:contains("Next")');
	console.log("Next a obj = " + aobj)
	if (aobj.length > 0){
	    if ((max_pages > 0) && (current_page < max_pages)){ 
		console.log("Clicking on the Next button");
		simulate_click(aobj[0]); 
		following = true;
	    } else {
		console.log("Reached the maximum number of pages"); 
		following = false; 
	    }
	} else {
	    console.log("aobj is null!"); 
	    following = false; 
	}; 

	return { 
	    status: "successful", 
	    current_page: current_page, 
	    max_pages: max_pages_available,
	    following: following,
	    records: records,
	    content: content // this must be enabled eventually
	}
	   
    }, { 
	max_pages: scrape_status['max_pages']
    }); // evaluate...
    
    // for a given page, we have extracted the content and if Next 
    // exists, we have clicked it as well...
    console.log("read_page: Received pageinfo ");
    
    // If there is an error, then bail out...
    if ( pageinfo['status'] == "error"){
	store_state("Error while scraping page " + 
		    scrape_status['processing_page']);
	store_dump(0, "ERROR", pageinfo['content']);
	complete_distributor();
	return; 
    } 
    
    // Successful...
    // Update the max pages based on what we see, if necessary 
    current_page = pageinfo['current_page']; 
    max_pages    = scrape_status['max_pages'];
    max_pages_available = pageinfo['max_pages']
    records = pageinfo['records']
    
    console.log("read_page: Dumping the page content ( page " + 
		current_page + " )");
    
    // Update the counts 
    scrape_status['scraped_records'] += records; 
    scrape_status['scraped_pages'] += 1;
    store_state("Updated the records (" + records + 
		") and page count (1)"); 

    store_dump(current_page, "SUCCESS",  pageinfo['content']);    

    if ((max_pages <= 0) || (max_pages > max_pages_available)){
	if (max_pages_available != 0){ 
	    console.log("read_page: Updating the max_page to " + 
			   max_pages_available);
	    scrape_status['max_pages'] = max_pages_available;
	    max_pages = max_pages_available;
	    scrape_log("Updated max pages for distributor " + 
		       scrape_status['processing_distributor'] + " to " + 
		       pageinfo['max_pages']);
	}; 
    };
    
    // console.log("Checking if the max pages reached");
    // console.log("max_pages = " + max_pages + 
    //		" current_page = " + current_page + 
    //	       "following = " + pageinfo['following']); 
    
    // If we are able to extract the page number and it is more
    // than the max, then we have completed this
    // distributor...Alternatively if we dont have a Next link to
    // click on, then also bail out...
    if ((current_page >= max_pages) || (!pageinfo['following'])){
	scrape_log("Completed the max pages or no more pages");
	complete_distributor();
    } else { 
	// Move to the next page...
	scrape_status['processing_page'] = current_page + 1;
	store_state("Moving to next page (" + (current_page + 1) + ")"); 
    };
    
    console.log("Finished reading page");

}; // reading page



page.onLoadFinished = function (status) {

    console.log("**** Load Finished"); 
    if (status !== 'success') {
        console.log('Unable to access network');
	phantom.exit();
    } 

    console.log("**** Successfully loaded - " + phantom.state); 
    if (phantom.state == "start"){ 
	window.setTimeout(select_state, 1000); 
    } else if (phantom.state == "readingpage"){
        console.log("Delaying read_page");
	window.setTimeout(read_page, 2000); 
    };
}; // onLoadFinished


function watch_for_city(){
    console.log("started watching for city"); 
    var ticker = window.setInterval(function () {
	var result = evaluate(page, function(args){ 
	    var target_city = args['target_city'];
	    console.log("Target city = " + target_city); 
	    cityobj = document.querySelector('#city'); 
	    console.log("City obj = " + cityobj); 
	    if ((cityobj == null) || (typeof(cityobj) == "undefined")){
		console.log("[Keep Checking] city = null" ); 
		return "null";
	    } else {
		console.log("Received the city information");
		if ((target_city > cityobj.options.length) || 
		    (target_city < 1)){
		    return "invalid";
		};

		cityobj.options[target_city].selected = true; 
		cityobj.options.selectedIndex = target_city; 
		cityobj.onchange();
		console.log("Fired city selected event for " + 
			    cityobj.options[target_city].text); 
		//console.log(cityobj.innerHTML); 
		return "successful";
	    };
	}, {
	    target_city: scrape_status['target_city'], 
	});

	console.log("watch_for_city: result = " + result); 
	if (result == "successful"){ 
	    window.clearInterval(ticker);
	    phantom.state = "cityselected"; 
	} else if (result == "invalid"){
	    window.clearInterval(ticker);
	    scrape_status['status'] = "invalid"; 
	    store_state("Invalid city id"); 
	    phantom.exit();
	} else if (result == "unsuccessful"){
	    console.log("ERROR! cannot select city");
	    phantom.exit() 
	} else {
	    // null 
	    // do nothing 
	}

    }, 1000);
}

function watch_for_distributors(){
    console.log("started watching for distributors data - " + phantom.state); 
    var ticker = window.setInterval(function () {
	var result = evaluate(page, function(args){ 
	    var target_distributor = args['target_distributor'];
	    var skip_distributors = args['skip_distributors'];
	    
	    distobj = document.querySelector('#txtDistributor'); 
	    console.log("distobj = " + distobj); 
	    if (distobj == null){
		console.log("[Keep Checking] distributor = null" ); 
		return {
		    status: "null"
		};
	    } else {
		//console.log("Received distributor information: " 
		//	    + distobj.innerHTML);
		console.log("Dist options length = " + distobj.options.length);
		var max_distributors = distobj.options.length; 
		
		// Check to make sure that the distributor is valid. 
		// This should eventually have a check for the value 
		// of the distributor...
		if ((target_distributor < 0) || 
		    (target_distributor >= max_distributors)){
		    return {
			status: "invalid_distributor"
		    };
		};
		
		// Gather the names to be returned...
		distributor_names = [] 
		for (i = 0; i < distobj.options.length; i++){
		    distributor_names.push(distobj.options[i].text)
		};
		
		// Check if the distributor should be skipped...
		distributor_name = distobj.options[target_distributor].text
		if ( skip_distributors.indexOf(distributor_name) >= 0){ 
		    console.log("Distributor name " + distributor_name + 
				" in skip list "); 
		    return {
			status: "skip",
			max_distributors: max_distributors,
			distributor_names: distributor_names
		    };
		} else {
		    console.log("Processing distributor " + distributor_name);
		}; 

		// Update the distributor 
		distobj.options[target_distributor].selected = true; 
		distobj.options.selectedIndex = target_distributor; 
		console.log("Fired distributor selected event"); 
		
		// Now click on proceed 
		submitobj = document.querySelector('#submit_btn'); 
		submitobj.click() 
		return {
		    status: "successful",
		    max_distributors: max_distributors,
		    distributor_names: distributor_names
		};
	    };
	}, { // Parameter for evaluating the distributor data availability
	    target_distributor: scrape_status['processing_distributor'],
	    skip_distributors: scrape_status['skip_distributors'] 
	}); 

	console.log("watch_for_distributor: result = " + 
		    JSON.stringify(result, "undefined", 4)); 
	if (result['status'] == "successful"){ 
	    if (! distributor_list_initialized()){ 
		update_distributor_list(result['max_distributors'],
				       result['distributor_names']); 
	    }; 
	    window.clearInterval(ticker);
	    phantom.state = "submitselected";
	} else if (result['status'] == "skip"){ 
	    if (! distributor_list_initialized()){ 
		update_distributor_list(result['max_distributors'],
				       result['distributor_names']);  
	    }; 
	    window.clearInterval(ticker);
	    complete_distributor(); 
	} else if (result == "unsuccessful"){
	    console.log("ERROR! cannot select distributor");
	    phantom.exit() 
	} else {
	    // null 
	    // do nothing 
	}

    }, 1000);
}


page.onResourceReceived = function (req) {
    // console.log("In resource received - " + phantom.state);
    if (phantom.state == "stateselected") {
	watch_for_city();
	phantom.state = "waitingforcity"; 
    } else if (phantom.state == "cityselected"){
	watch_for_distributors() 
	phantom.state = "waitingfordistributor" 
	console.log("cities selection complete");
	//phantom.exit() 
   } else if (phantom.state == "submitselected"){
      // console.log(JSON.stringify(req, "undefined", 4));
       //if ("stage" in req){ 
	//   console.log("State of request = " + req.getAttribute('stage')); 
       //}
       phantom.state = "readingpage"; 
   } else if (phantom.state == "readingpage"){
       console.log("Received new page information") 
       // console.log(JSON.stringify(req, "undefined", 4));
   };
};


page.open(indanesite);
