"use strict";

module.exports = parseSchedule;

var moment = require('moment-timezone');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

function parseSchedule(dates, tz) {
	var s = new Schedule(tz);
	s.parse(dates);
	return s;
}

function Schedule(tz) {
	this.tz = tz;
}

Schedule.prototype.parse = function(dates) {
	var self = this;

	self.dates = {};

	var parts = dates.split(';');
	parts.forEach(function(part) {
		var partParts = part.split('@');
		var day = partParts[0];
		var time = partParts[1];

		if (!self.dates[day]) {
			self.dates[day] = [];
		}

		self.dates[day].push(time);
	});
};

Schedule.prototype.next = function(now) {
	if (!now) {
		throw new Error('now must be specified');
	}
	var self = this;
	var day, test, times;

	var options = [];

	for (var i = 0; i < 8; i++) {
		test = now.clone().startOf('day').add(i, 'days');
		day = test.format('ddd').toLowerCase();
		times = self.dates[day];
		if (times) {
			times.forEach(function(time) {
				var pieces = time.split(':');
				var hours = pieces[0];
				var minutes = pieces[1];
				var t = test.clone().hours(hours).minutes(minutes);
				options.push(t);
			});
		}
	}

	options = options.filter(function(option) {
		return option.format() > now.format();
	});

	if (options.length) {
		return options[0];
	}
};

Schedule.prototype.getNotifier = function(start, timeout) {
	return new ScheduleNotifier(this, start || moment.tz(this.tz), timeout);
};

function ScheduleNotifier(schedule, start, timeout) {
	EventEmitter.call(this);

	this.schedule = schedule;
	this.timeout = timeout;
	this.setIntervalId = null;
	this.startTime = start.clone();
	this.startTime.tz(schedule.tz);

	this.setIntervalId = setInterval(this._handleInterval.bind(this), timeout);
};

util.inherits(ScheduleNotifier, EventEmitter);

ScheduleNotifier.prototype._handleInterval = function() {
	var self = this;
	var now = moment.tz(self.schedule.tz);
	var formattedNow = now.format();
	var next = this.schedule.next(this.startTime);
	if (next) {
		next.tz(self.schedule.tz);
	}
	else {
		this.stop();
		console.log('No next scheduled item for ' + this.startTime.format());
		this.emit('error', 'No next scheduled item for ' + this.startTime.format());
	}
	var formattedNext = next.format();

	if (formattedNext < formattedNow) {
		this.emit('scheduled', next, now);
		this.startTime = now;
	}
}

ScheduleNotifier.prototype.stop = function() {
	clearInterval(this.setIntervalId);
}

ScheduleNotifier.prototype.next = function() {
	var next = this.schedule.next(this.startTime);
	if (next) {
		next.tz(this.schedule.tz);
		return next;
	}
	else {
		return null;
	}
}

