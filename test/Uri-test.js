"use strict";
var assert, batch, cloneInputs, Uri, vows, vtools;

assert = require('assert');
batch = {};
Uri = require('../lib/Uri');
vows = require('vows');
vtools = require('./vtools');

batch.constructor = {
	'without new': function () {
		/*jslint newcap:true*/
		var u = Uri('example.com');
		/*jslint newcap:false*/
		assert.instanceOf(u, Uri);
	},
	'with new': function () {
		var u = new Uri('example.com');
		assert.instanceOf(u, Uri);
	}
};

batch.parseAuthorityHost = vtools.dataProvider(function (uri) {
	var u = {}, result;
	u.parseAuthorityHost = Uri.prototype.parseAuthorityHost;
	result = u.parseAuthorityHost(uri);
	delete u.parseAuthorityHost;
	this.callback(null, [u, result]);
}, {
	nothing: {
		args: [ '' ],
		returns: [ {
			userInfo: '',
			host: '',
			port: ''
		}, '']
	},
	'tricky path': {
		args: [ '/page.html?email=user@example.com' ],
		returns: [ {
			userInfo: '',
			host: '',
			port: ''
		}, '/page.html?email=user@example.com' ]
	},
	'with userinfo and port': {
		args: [ 'user@example.com:1337/page.html' ],
		returns: [ {
			userInfo: 'user',
			host: 'example.com',
			port: '1337'
		}, '/page.html' ]
	},
	'with userinfo': {
		args: [ 'user@example.com/page.html' ],
		returns: [ {
			userInfo: 'user',
			host: 'example.com',
			port: ''
		}, '/page.html' ]
	},
	'just host': {
		args: [ 'example.com/page.html' ],
		returns: [ {
			userInfo: '',
			host: 'example.com',
			port: ''
		}, '/page.html' ]
	}
});

batch.parseUri = vtools.dataProvider(function (uri, path) {
	var u = {}, sentToAH;
	u.parseUri = Uri.prototype.parseUri;
	u.parseAuthorityHost = function (portion) {
		sentToAH = portion;
		return path;
	};
	u.parseUri(uri);
	delete u.parseUri;
	delete u.parseAuthorityHost;
	this.callback(null, [u, sentToAH]);
}, {
	nothing: {
		args: [ '', '' ],
		returns: [ {
			forceFragment: false,
			scheme: '',
			query: '',
			fragment: '',
			path: [ ]
		}, undefined ]
	},
	trimming: {
		args: [ '  http://example.com/page.html  ', '/page.html' ],
		returns: [ {
			forceFragment: false,
			scheme: 'http',
			query: '',
			fragment: '',
			path: [ '', 'page.html' ]
		}, 'example.com/page.html' ]
	},
	'relative scheme with fragment': {
		args: [ '//example.com/page.html#anchor', '/page.html' ],
		returns: [ {
			forceFragment: false,
			scheme: '',
			query: '',
			fragment: 'anchor',
			path: [ '', 'page.html' ]
		}, 'example.com/page.html' ]
	},
	'path with fragment': {
		args: [ '/page.html?q', undefined ],
		returns: [ {
			forceFragment: false,
			scheme: '',
			query: 'q',
			fragment: '',
			path: [ '', 'page.html' ]
		}, undefined ]
	},
	'relative path': {
		args: [ '../../index.php', undefined ],
		returns: [ {
			forceFragment: false,
			scheme: '',
			query: '',
			fragment: '',
			path: [ '..', '..', 'index.php' ]
		}, undefined ]
	}
});

batch.schemeAndPortMatch = vtools.dataProvider(function (scheme, port) {
	var u = {
		scheme: scheme,
		port: port,
		schemeAndPortMatch: Uri.prototype.schemeAndPortMatch
	};
	this.callback(null, u.schemeAndPortMatch());
}, {
	'no port': {
		args: [ 'http', undefined ],
		returns: true
	},
	'no scheme': {
		args: [ '', 443 ],
		returns: false
	},
	match: {
		args: [ 'https', 443 ],
		returns: true
	},
	'does not match': {
		args: [ 'https', 8443 ],
		returns: false
	}
});

// parseUri, resolveAgainst, toString
batch.functional = vtools.dataProvider(function (subject, forceFragment) {
	var uri;

	uri = new Uri(subject, 'http://user@example.com:1337/d/i/r/page.html?query#fragment');

	if (forceFragment) {
		uri.forceFragment = true;
	}

	this.callback(null, uri.toString());
}, {
	nothing: {
		args: '',
		returns: 'http://user@example.com:1337/d/i/r/page.html?query#fragment'
	},
	'no schema': {
		args: '//google.com',
		returns: 'http://google.com/'
	},
	'force fragment': {
		args: [ 'http://example.com', true ],
		returns: 'http://example.com/#'
	},
	'just fragment': {
		args: '#frag2',
		returns: 'http://user@example.com:1337/d/i/r/page.html?query#frag2'
	},
	'just query': {
		args: '?q2',
		returns: 'http://user@example.com:1337/d/i/r/page.html?q2'
	},
	'relative': {
		args: '../',
		returns: 'http://user@example.com:1337/d/i/'
	}
});

exports.batch = vows.describe('../lib/Uri.js').addBatch(batch);
