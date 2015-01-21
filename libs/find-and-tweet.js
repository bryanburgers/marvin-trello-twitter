"use strict";

module.exports = findAndTweet;

var Trello = require('node-trello');
var moment = require('moment-timezone');
var Promise = require('bluebird');
var Twitter = require('twitter');

Promise.promisifyAll(Trello.prototype);
Promise.promisifyAll(Twitter.prototype);

var t = new Trello(
	process.env.TRELLO_KEY,
	process.env.TRELLO_TOKEN
);

var tw = new Twitter({
	consumer_key: process.env.TWITTER_CONSUMER_KEY,
	consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
	access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
	access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

var board = process.env.TRELLO_BOARD;

function getListByName(boardId, listName) {
	return t.getAsync('/1/boards/' + boardId + '/lists').then(function(lists) {
		var wantedList = null;

		lists.forEach(function(list) {
			if (list.name === listName) {
				wantedList = list;
			}
		});

		if (wantedList) {
			return wantedList;
		}
		else {
			return null;
		}
	});
}

function createList(boardId, listName, listPos) {
	return t.postAsync('/1/boards/' + boardId + '/lists', {
		name: listName,
		pos: listPos
	});
}

function moveCardToList(card, list) {
	return t.putAsync('/1/cards/' + card.id + '/idList', { value: list.id });
}

function addCommentToCard(card, comment) {
	return t.postAsync('/1/cards/' + card.id + '/actions/comments', { text: comment });
}

function markCardAsError(card, error) {
	var errorText = "```\n";
	if (error.stack) {
		errorText += error.stack;
	}
	else {
		errorText += JSON.stringify(error, null, '  ');
	}
	errorText += "\n```\n";
	errorText += moment().tz(process.env.TIMEZONE).format();

	return t.postAsync('/1/cards/' + card.id + '/labels', { color: 'red', name: 'Twitter Error' })
		.then(function() {
			return addCommentToCard(card, errorText);
		});
}

function getQueueList() {
	return getListByName(process.env.TRELLO_BOARD, 'Queue');
}

function createPostedList(m) {
	if (!m) {
		m = moment();
	}

	m.tz(process.env.TIMEZONE);

	var name = 'Posted ' + m.format('YYYY-MM');

	return getListByName(process.env.TRELLO_BOARD, name).then(function(postedList) {
		if (postedList) {
			return postedList;
		}
		else {
			return createList(process.env.TRELLO_BOARD, name, 'bottom');
		}
	});
}

function getCards(list) {
	return t.getAsync('/1/lists/' + list.id + '/cards');
}

function findFirstActiveCard(cards) {
	var filtered = cards.filter(function(card) {
		var labels = card.labels;
		var hasInactiveCard = false;
		labels.forEach(function(label) {
			if (label.name === 'Twitter Error') {
				hasInactiveCard = true;
			}
			if (label.name === 'Hold') {
				hasInactiveCard = true;
			}
		});
		if (hasInactiveCard) {
			return false;
		}
		return true;
	});

	if (filtered.length) {
		return filtered[0];
	}
	else {
		return null;
	}
}

function findAndTweet() {

return getQueueList().then(function(queueList) {
	var postedList = createPostedList();
	var activeCard = getCards(queueList).then(findFirstActiveCard);

	return Promise.join(postedList, activeCard, function(postedList, activeCard) {
		//console.log(postedList);
		//console.log(activeCard);

		if (!activeCard) {
			console.log("Nothing to post.");
			// Nothing to post.
			return;
		}

		return tw.postAsync('statuses/update', {
			status: activeCard.desc
		}).then(function(result) {
			console.log(result);
			var successText = 'https://twitter.com/bryanburgers/status/' + result[0].id_str;
			successText += "\n";
			successText += moment().tz(process.env.TIMEZONE).format();

			return addCommentToCard(activeCard, successText)
				.then(function() {
					return moveCardToList(activeCard, postedList);
				});
		}, function(err) {
			return markCardAsError(activeCard, err);
		});
	});
});

}
