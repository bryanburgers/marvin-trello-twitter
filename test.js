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

core.tweetScheduled().then(function(result) {
	console.log(result);
}, function(err) {
	console.log(err.stack);
});
