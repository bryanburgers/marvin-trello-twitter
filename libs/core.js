"use strict";

exports.withOptions = withOptions;

var moment = require('moment-timezone');
var Promise = require('bluebird');
var metadata = require('./metadata');

function withOptions(boardId, t, tw, timezone) {

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

	function getAllCards(boardId) {
		return t.getAsync('/1/boards/' + boardId + '/cards');
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
		errorText += moment().tz(timezone).format();

		return t.postAsync('/1/cards/' + card.id + '/labels', { color: 'red', name: 'Twitter Error' })
			.then(function() {
				return addCommentToCard(card, errorText);
			});
	}

	function getQueueList() {
		return getListByName(boardId, 'Queue');
	}

	function getScheduledList() {
		return getListByName(boardId, 'Scheduled');
	}

	function createPostedList(m) {
		if (!m) {
			m = moment();
		}

		m.tz(timezone);

		var name = 'Posted ' + m.format('YYYY-MM');

		return getListByName(boardId, name).then(function(postedList) {
			if (postedList) {
				return postedList;
			}
			else {
				return createList(boardId, name, 'bottom');
			}
		});
	}

	function getCards(list) {
		return t.getAsync('/1/lists/' + list.id + '/cards');
	}

	function filterActiveCards(cards) {
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

		return filtered;
	}

	function findFirstActiveCard(cards) {
		var filtered = filterActiveCards(cards);

		if (filtered.length) {
			return filtered[0];
		}
		else {
			return null;
		}
	}

	function filterScheduledCards(cards) {
		var now = moment.tz(timezone).format();
		var filtered = cards.filter(function(card) {
			if (!card.due) return false;

			var dueDate = moment.tz(card.due, timezone).format();
			if (dueDate < now) {
				return true;
			}

			return false;
		});

		return filtered;
	}

	function tweetCard(card, destinationList) {
		return tw.postAsync('statuses/update', {
			status: card.desc
		}).then(function(result) {
			console.log(result);
			var successText = 'https://twitter.com/bryanburgers/status/' + result[0].id_str;
			successText += "\n";
			successText += moment().tz(timezone).format();

			return addCommentToCard(card, successText)
				.then(function() {
					return moveCardToList(card, destinationList);
				});
		}, function(err) {
			return markCardAsError(card, err);
		});
	}

	function tweetFromQueue() {
		var activeCard = getQueueList()
			.then(getCards)
			.then(findFirstActiveCard);
		var postedList = createPostedList();

		return Promise.join(activeCard, postedList, function(activeCard, postedList) {
			if (!activeCard) {
				console.log("Nothing to post.");
				// Nothing to post.
				return;
			}

			return tweetCard(activeCard, postedList);
		});
	}

	function tweetScheduled() {
		var scheduledCards = getScheduledList()
			.then(getCards)
			.then(filterActiveCards)
			.then(filterScheduledCards);

		var postedList = createPostedList();

		return Promise.join(scheduledCards, postedList, function(scheduledCards, postedList) {
			return Promise.map(scheduledCards, function(scheduledCard) {
				return tweetCard(scheduledCard, postedList);
			});
		});
	}

	function urlsToCards() {
		function cardNeedsUpdating(card) {
			return /^https?:\/\/[^ ]+$/.test(card.name);
		}

		function updateCard(card) {
			var originalUrl = card.name;

			return metadata(originalUrl).then(function(metadata) {
				var cardTitle = metadata.title + ' | ' + metadata.uri.hostname;
				var cardBody = '\u00ab' + metadata.title + '\u00bb\n\n' + originalUrl;

				var update = {
					name: cardTitle
				};

				if (!card.desc || card.desc === '') {
					update.desc = cardBody;
				}

				return t.putAsync('/1/cards/' + card.id, update);
			});
		}

		return getAllCards(boardId).then(function(cards) {
			return cards.filter(cardNeedsUpdating);
		}).then(function(cards) {
			return Promise.map(cards, updateCard);
		});
	}

	return {
		tweetFromQueue: tweetFromQueue,
		tweetScheduled: tweetScheduled,
		urlsToCards: urlsToCards
	};
}
