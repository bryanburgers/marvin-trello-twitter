"use strict";

var Core = require('./libs/core');
var http = require('http');
var moment = require('moment-timezone');
var Promise = require('bluebird');
var schedule = require('./libs/schedule');
var Trello = require('node-trello');
Promise.promisifyAll(Trello.prototype);
var Twitter = require('twitter');
Promise.promisifyAll(Twitter.prototype);

// Set up the somethings that we need.
var trello = new Trello(
	process.env.TRELLO_KEY,
	process.env.TRELLO_TOKEN
);

var twitter = new Twitter({
	consumer_key: process.env.TWITTER_CONSUMER_KEY,
	consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
	access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
	access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

var board = process.env.TRELLO_BOARD;
var timezone = process.env.TIMEZONE;
var core = Core.withOptions(board, trello, twitter, timezone);

// Set up to tweet on schedule.
console.log("Starting.");
console.log("Now: " + moment.tz(process.env.TIMEZONE).format());
console.log("Schedule: " + process.env.SCHEDULE);
var s = schedule(process.env.SCHEDULE, process.env.TIMEZONE);
var notifier = s.getNotifier(moment.tz(process.env.TIMEZONE), 10000);
notifier.on('scheduled', function(scheduled, actual) {
	console.log("Tweeting. Scheduled: " + scheduled.format() + " Actual: " + actual.format());
	core.tweetFromQueue().catch(function(err) {
		console.log(err.stack);
	});
});

setInterval(function() {
	core.tweetScheduled().catch(function(err) {
		console.log(err.stack);
	});
}, 30000);

setInterval(function() {
	core.urlsToCards().catch(function(err) {
		console.log(err.stack);
	});
}, 30000);

// An HTTP server, so that Heroku lets us live on their environment.
var server = http.createServer(function(req, res) {
	if (req.url === '/') {
		var next = notifier.next();
		res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
		res.write('<h1>OK</h1>');
		res.write('<p>' + next.format() + '</p>');
		res.write('<p>' + next.fromNow() + '</p>');
		res.end();
	}
	else {
		res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
		res.end('<h1>404 Not Found</h1>');
	}
});
var port = process.env.PORT || 2222;
server.listen(port, function() {
	console.log("Listening on port " + port);
});
