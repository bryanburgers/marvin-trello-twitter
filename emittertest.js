"use strict";

var schedule = require('./libs/schedule');
var moment = require('moment-timezone');

var s = schedule('wed@0:32;wed@0:33;wed@0:34;wed@0:35;wed@0:36', 'America/Chicago');

//console.log(s.next(moment()).format());

s.getNotifier(null, 10000).on('scheduled', function(scheduled, now) {
	console.log("HOORAY!");
	console.log(scheduled.format());
	console.log(now.format());
	console.log();
});
