'use strict';

const Homey = require('homey');
const dateformat = require('dateformat');
var FeedMe = require('feedme');
var http = require('http');
var https = require('https');
//var httpmin = require ('http.min');
//var data = []; //array with media-objects
var urllist = []; //array with {name,url,latestbroadcast,latesturl,token} feeds from settings
var pollingtime = 900000
		
class Vodcast extends Homey.App {
	
	onInit() {
		this.log('Vodcast starting');
		
		getsettings().then(function(results) {
			console.log("settings read");
			urllist=results;
			console.log(urllist);
			readfeeds().then(function(results) {
				console.log("feeds read from start");			
			})	
		});

		startPollingForUpdates();
		
		Homey.ManagerSettings.on('set', function(settings) {
			getsettings().then(function(urlsettings) {
				console.log("settings read");
				urllist=urlsettings;
				//console.log(urllist);
				readfeeds().then(function(results) {
					console.log("feeds read from changing settings");
				})		
			});
		});
		
	}
}

async function readfeeds() {
		var temparray = [];
		//console.log("items in urllist ", urllist.length);
		for(var i = 0; i < urllist.length; i++) {
				var obj = urllist[i];
				//console.log("readfeed ", obj.url);
				var item = await readfeed(obj.url, obj.name);
				temparray.push (item);
		};
		return temparray;
};
	
function readfeed(feedurl, feedname) {
	console.log(feedurl)	
	return new Promise(resolve => {
		if (feedurl.substring(0,5) == "https") {
		
			https.get(feedurl, function(res) {
				var parser = new FeedMe(true);
				var teller=0;
				parser.on('item', (item) => {
					if (teller === 0) { //only on first item
						var objIndex = urllist.findIndex((obj => obj.url == feedurl));
						//console.log(objIndex)
						if (urllist[objIndex].latestbroadcast != null) { //already a latest url in tag
							var oldtimestamp = urllist[objIndex].latestbroadcast;
							var oldurl=urllist[objIndex].latesturl;
							var newtimestamp = Date.parse(item.pubdate)/1000;
							if (newtimestamp > oldtimestamp) { //new item
								urllist[objIndex].latestbroadcast = newtimestamp
								urllist[objIndex].token.setValue(item.enclosure.url);
								urllist[objIndex].latesturl = item.enclosure.url;
								
								//here a trigger should be fired
								let tokens = {
									'item': item.enclosure.url,
									'tijd': item.pubdate,
									'vctitle': urllist[objIndex].name,
								}
								console.log(tokens);
								//console.log(urllist[objIndex].flowTriggers.newvodcast);
								urllist[objIndex].flowTriggers.newvodcast.trigger(tokens).catch( this.error );
								
								
							} else {
								//no new item
							}
						} else { //set first url in tag
							var itemurl = geturlfrom(item)							
							urllist[objIndex].token.setValue(itemurl);						
							urllist[objIndex].latesturl = itemurl;
							urllist[objIndex].latestbroadcast = Date.parse(item.pubdate)/1000;
						}
						teller=teller+1; //only first item
					};	
				});
								
				res.pipe(parser);			

				parser.on('end', function() {
					var pl = parser.done();
					//console.log(pl.items)
					var result = {
						type: 'playlist',
						id: pl.title,
						title: feedname,
						tracks: parseTracks(pl.items) || false,
					};

				resolve(result);
				});	
			});
		} else {
			http.get(feedurl, function(res) {
				var parser = new FeedMe(true);
				var teller=0;			
				parser.on('item', (item) => {
					if (teller === 0) { //only on first item
						var objIndex = urllist.findIndex((obj => obj.url == feedurl));
						console.log(objIndex);
						if (urllist[objIndex].latestbroadcast != null) { //already a latest url in tag
							var oldtimestamp = urllist[objIndex].latestbroadcast;
							var oldurl=urllist[objIndex].latesturl;
							var newtimestamp = Date.parse(item.pubdate)/1000;
							if (newtimestamp > oldtimestamp) { //new item
								urllist[objIndex].latestbroadcast = newtimestamp
								urllist[objIndex].token.setValue(item.enclosure.url);
								urllist[objIndex].latesturl = item.enclosure.url;
								
								//here a trigger should be fired
								let tokens = {
									'item': item.enclosure.url,
									'tijd': item.pubdate,
									'vctitle': urllist[objIndex].name,
								}
								console.log(tokens);
								//console.log(urllist[objIndex].flowTriggers.newvodcast);
								urllist[objIndex].flowTriggers.newvodcast.trigger(tokens).catch( this.error );
								
								
							} else {
								//no new item
							}
						} else { //set first url in tag
							var itemurl = geturlfrom(item)							
							urllist[objIndex].token.setValue(itemurl);						
							urllist[objIndex].latesturl = itemurl;
							urllist[objIndex].latestbroadcast = Date.parse(item.pubdate)/1000;
						}
						teller=teller+1; //only first item
					};	
				});
								
				res.pipe(parser);			

				parser.on('end', function() {
					var pl = parser.done();
					var result = {
						type: 'playlist',
						id: pl.title,
						title: feedname,
						tracks: parseTracks(pl.items) || false,
					};

				resolve(result);
				});	
			});
		}
	});
};

function geturlfrom(item) {
	var itemurl = ""
	if (typeof item.enclosure != 'undefined' && typeof item.enclosure.url != 'undefined') {
		itemurl = item.enclosure.url
		console.log(itemurl)
	} else if (typeof item['yt:videoid'] != 'undefined') {
		var itemurl = "https://www.youtube.com/watch?v=" + item['yt:videoid']
		console.log(itemurl)
	} else if (typeof item['media:group'] != 'undefined' && typeof item['media:group']['media:content'] != 'undefined' && typeof item['media:group']['media:content'].url != 'undefined') {
		itemurl = item['media:group']['media:content'].url
		console.log(itemurl)
	}
	return (itemurl)
}

function getpubdatefrom(item) {
	var pubdate=""
	if (typeof item.pubdate != 'undefined') {
		pubdate = item.pubdate
	} else if (typeof item.published != 'undefined') {
		pubdate = item.published
	}
	return (pubdate)
}

function startPollingForUpdates() {
	var pollingInterval = setInterval(() => {
		console.log('start polling');
			readfeeds().then(function(results) {
				console.log("feeds read from polling");
				//data=results;
				//console.log(results);
				//Homey.ManagerMedia.requestPlaylistsUpdate();
			})	
	}, pollingtime);
};

//get name and url list from settings and create array
function getsettings() {
	return new Promise(function(resolve,reject){
		var replText = Homey.ManagerSettings.get('vodcasts');
		var list = [];
		if (replText != null && typeof replText === 'object') {
			Object.keys(replText).forEach(function (key) {
				var url = replText[key];
				list.push( {"name":key,"url":url})
				return list;
			});
		
		list.forEach(function(listobject) {
			var objIndex = urllist.findIndex(obj => obj.url == listobject.url);
			console.log ("objIndex ", objIndex, "in urllist voor ",listobject.url);
			if (objIndex > -1) {
				console.log("gegevens overnemen");
				listobject.latestbroadcast = urllist[objIndex].latestbroadcast;
				listobject.latesturl = urllist[objIndex].latesturl;
				listobject.token = urllist[objIndex].token;
				listobject.flowTriggers = urllist[objIndex].flowTriggers
			} else {
				listobject.latestbroadcast = null;
				listobject.latesturl = "";
				listobject.token = new Homey.FlowToken( listobject.name, {
						type: 'string',
						title: listobject.name
					});
				listobject.token.register()
					.then(() => {
						return listobject.token.setValue( null );
					})
				listobject.flowTriggers = {newvodcast: new Homey.FlowCardTrigger('new_vodcast_item')};
				listobject.flowTriggers.newvodcast.register();
			}
		});
		
		if (urllist.length > 0) {
		urllist.forEach(function(listobject) {
			var objIndex = list.findIndex(obj => obj.url == listobject.url);
			console.log("listobject in lijst ", objIndex);
			if (objIndex < 0) {
				//not found so delete
				//console.log("url niet gevonden dus verwijderen");
				listobject.token.unregister()
					.then(() => {
						console.log("token unregistered");
					})
			} else {
				//console.log("url gevonden dus niets doen");
				//wel gevonden dus niets doen
			}
		});
		}
		
		resolve(list);	
		}
	})
}	


	
	
function parseTracks(tracks) {
	const result = [];
	if (!tracks) {
		return result;
	}
	tracks.forEach((track) => {
		const parsedTrack = parseTrack(track);
		if (parsedTrack !== null) {
			parsedTrack.confidence = 0.5;
			result.push(parsedTrack);
		}
	});
	return result;
}

function parseTrack(track) {

	var itemurl = geturlfrom(track)
	var pubdate = getpubdatefrom(track)
	
	if(typeof track['itunes:author'] !== 'undefined'){
		var artist = track['itunes:author'];
	} else {var artist = ""}
	
	if(typeof track['itunes:duration'] !== 'undefined'){
		var itemduration = hmsToSecondsOnly(track['itunes:duration']);
	}	
	
	return {
		type: 'track',
		id: itemurl,
		title: track.title,
		artist: [
			{
				name: artist,
				type: 'artist',
			},
		],
		duration:  itemduration || null,		
		artwork: '',
		genre: track.genre || 'unknown',
		release_date: dateformat(pubdate, "yyyy-mm-dd"),
		codecs: ['homey:codec:mp4'],
		bpm: track.pbm || 0,
		options :  
			{
			url : itemurl
			}
		
	}
}

function hmsToSecondsOnly(str) {
	if (str != null) {
		//console.log(str);
    var p = str.split(':'),
        s = 0, m = 1;
    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }
	s=s*1000
	//console.log(s);
	} else {s=null}
    return s;
}

module.exports = Vodcast;