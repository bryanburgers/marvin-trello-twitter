"use strict";

var moment = require('moment-timezone');
var schedule = require('../libs/schedule');
var should = require('should');

describe('should', function() {
	describe('next', function() {
		it('Coming up today', function() {
			var now = moment.tz('2015-01-20T09:30-06:00', 'America/Chicago');
			var s = schedule('mon@10:00;tue@10:00;wed@10:00;thu@10:00;fri@10:00');
			var next = s.next(now);
			next.format().should.eql('2015-01-20T10:00:00-06:00');
		});
		it('Multiple times today', function() {
			var now = moment.tz('2015-01-20T12:30-06:00', 'America/Chicago');
			var s = schedule('tue@10:00;tue@22:00');
			var next = s.next(now);
			next.format().should.eql('2015-01-20T22:00:00-06:00');
		});
		it('Picks up next day', function() {
			var now = moment.tz('2015-01-20T23:30-06:00', 'America/Chicago');
			var s = schedule('mon@10:00;tue@10:00;wed@10:00;thu@10:00;fri@10:00');
			var next = s.next(now);
			next.format().should.eql('2015-01-21T10:00:00-06:00');
		});
		it('Skips appropriate day', function() {
			var now = moment.tz('2015-01-20T23:30-06:00', 'America/Chicago');
			var s = schedule('mon@10:00;tue@10:00;thu@10:00;fri@10:00');
			var next = s.next(now);
			next.format().should.eql('2015-01-22T10:00:00-06:00');
		});
		it('Around the end of the week', function() {
			var now = moment.tz('2015-01-20T23:30-06:00', 'America/Chicago');
			var s = schedule('mon@10:00');
			var next = s.next(now);
			next.format().should.eql('2015-01-26T10:00:00-06:00');
		});
	});
});
