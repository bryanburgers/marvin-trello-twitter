"use strict";

var findAndTweet = require('./libs/find-and-tweet');
var schedule = require('./libs/schedule');
var moment = require('moment-timezone');
var http = require('http');

// Set up to tweet on schedule.
console.log("Starting.");
console.log("Now: " + moment.tz(process.env.TIMEZONE).format());
console.log("Schedule: " + process.env.SCHEDULE);
var s = schedule(process.env.SCHEDULE, process.env.TIMEZONE);
var notifier = s.getNotifier(moment.tz(process.env.TIMEZONE), 10000);
notifier.on('scheduled', function(scheduled, actual) {
	console.log("Tweeting. Scheduled: " + scheduled.format() + " Actual: " + actual.format());
	findAndTweet().catch(function(err) {
		console.log(err.stack);
	});
});

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
