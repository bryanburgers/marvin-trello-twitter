"use strict";

var express = require('express');
var bodyParser = require('body-parser');
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

core.ensureWebhook(process.env.ORIGIN + '/trello-postback');

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

var port = process.env.PORT || 2222;
var app = express();
app.use(bodyParser.json());
app.get('/', function(req, res) {
	let next = notifier.next();
	let result = `<h1>OK</h1><p>${next.format()}</p><p>${next.fromNow()}</p>`;
	res.send(result);
});
app.get('/trello-postback', function(req, res) {
	res.send({
		status: 'ok'
	});
});
app.post('/trello-postback', function(req, res) {
	let action = req.body.action;

	if (!action) {
		res.status(400).send({ status: 'error', message: 'Missing action' });
		return;
	}

	if (action.type == "createCard" || action.type == "updateCard") {
		core.maybeUpdateCard(action.data.card)
			.then(function() {
				res.send({ status: 'ok', message: 'Success' });
			})
			.catch(function(err) {
				console.log(err.stack);
				res.status(500).send({ status: 'error', message: err });
			});
	}
	else {
		res.send({ status: 'ok', message: `Ignoring action of type ${action.type}` });
	}
});
app.listen(port, function() {
	console.log("Listening on port " + port);
});
