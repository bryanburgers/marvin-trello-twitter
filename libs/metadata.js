"use strict";

module.exports = metadata;

var cheerio = require('cheerio');
var Promise = require('bluebird');
var request = Promise.promisify(require('request'));

function metadata(url) {
	return request(url).then(function(result) {
		var response = result[0];
		var body = result[1];

		//console.log(response);

		var $ = cheerio.load(body);

		var title = $('title').text();
		var ogtitle = $('meta[property="og:title"]').attr('content');
		var uri = response.request.uri;

		if (ogtitle) {
			// If a title is defined in Open Graph, it's usually correct.
			title = ogtitle;
		}
		else {
			// Otherwise, a title defined in <title> usually also has the site
			// name. Let's see if we can remove it.
			title = title.replace(/( \| | - ).*/, '');
		}

		return {
			title: title,
			uri: uri
		}
	});
}
