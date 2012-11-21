'use strict';

var loadCache, fetchCache, proto, util;

util = require('./util');
require('./es5-shim.js');  // Get ES5 methods

function URI(uri, base) {
	if (!(this instanceof URI)) {
		return new URI(uri, base);
	}

	this.parseUri(uri);

	if (base !== undefined) {
		base = new URI(base);
		this.resolveAgainst(base);
	}
}


/**
 * Parses out just the authority information and the host from a URI
 *
 * @param string uri URI starting with a potential authority/host section
 * @return string Remainder of URI
 */
URI.prototype.parseAuthorityHost = function parseAuthorityHost(uri) {
	var hostport, lastIndex;

	this.userInfo = '';
	this.host = '';
	this.port = '';
	uri = uri.split('@');

	if (uri.length > 1) {
		if (uri[0].indexOf('/') >= 0) {
			uri = uri.join('@');
		} else {
			this.userInfo = uri[0];
			uri = uri[1];
		}
	} else {
		uri = uri[0];
	}

	uri = uri.split('/');

	if (uri.length > 0 && uri[0].length) {
		hostport = uri[0];
		uri[0] = '';
		hostport = hostport.split(':');
		lastIndex = hostport.length - 1;

		if (lastIndex > 0 && hostport[lastIndex].match(/^[0-9]*$/)) {
			this.port = hostport[lastIndex];
			hostport.pop();
		}

		this.host = hostport.join(':');
	}

	uri = uri.join('/');
	return uri;
};


/**
 * Parse a URI string into this object
 *
 * @param string uri
 */
URI.prototype.parseUri = function parseUri(uri) {
	this.scheme = '';
	this.path = [];
	this.query = null;
	this.fragment = null;

	uri = uri.trim();
	uri = uri.split('#');

	if (uri.length > 1) {
		this.fragment = uri[1];
	}

	uri = uri[0];
	uri = uri.split('?');

	if (uri.length > 1) {
		this.query = uri[1];
	}

	uri = uri[0];

	if (uri.substr(0, 2) === '//') {
		// Relative schema
		uri = uri.substr(2);
		uri = this.parseAuthorityHost(uri);
	} else {
		uri = uri.split('://');

		if (uri.length > 1 && uri[0].match(/^[a-z][\-+a-z0-9]*$/i)) {
			this.scheme = uri[0];
			uri = this.parseAuthorityHost(uri[1]);
		} else {
			uri = uri.join('://');
		}
	}

	if (uri.length > 0) {
		this.path = uri.split('/');
	}
};


/**
 * Resolve the current URI against another
 *
 * @param URI base
 */
URI.prototype.resolveAgainst = function resolveAgainst(base) {
	var dirs, dirsResolved;

	if (this.scheme === '') {
		this.scheme = base.scheme;
	}

	// Quickly detect absolute URLs - they all need a host
	if (this.host) {
		return;
	}

	// If we have no host, we don't have any of these
	this.userInfo = base.userInfo;
	this.host = base.host;
	this.port = base.port;

	// Resolve the new path
	if (this.path.length && this.path[0] !== '') {
		dirs = util.clone(base.path);

		if (dirs[0] === '') {
			// Remove the empty first bit indicating base is an absolute path
			dirs.shift();
		}

		// Remove the last thing from the previous path (filename or empty)
		dirs.pop();

		// Now add our new path
		this.path.forEach(function (item) {
			dirs.push(item);
		});
		dirsResolved = [];
		dirs.forEach(function (dir) {
			if (dir === '..') {
				dirsResolved.pop();
			} else if (dir !== '.') {
				dirsResolved.push(dir);
			}
		});

		// Add the empty portion indicating this is an absolute path
		dirsResolved.unshift('');
		this.path = dirsResolved;
	} else {
		this.path = util.clone(base.path);
	}

	// If the dirs didn't change, then we could maybe keep the query
	if (this.path.join('/') === base.path.join('/')) {
		if (this.query === null) {
			this.query = base.query;

			if (this.fragment === null) {
				this.fragment = base.fragment;
			}
		}
	}
};


/**
 * Return true if the scheme and the port match
 *
 * @return boolean
 */
URI.prototype.schemeAndPortMatch = function schemeAndPortMatch() {
	if (!this.port) {
		return true;
	}

	if (!this.scheme) {
		return false;
	}

	switch (this.scheme.toLowerCase()) {
	case 'http':
		return +this.port === 80;
	case 'https':
		return +this.port === 443;
	}

	return false;
};


/**
 * Convert a URI object into a string
 *
 * @return string
 */
URI.prototype.toString = function toString() {
	var str = '';

	if (this.scheme) {
		str += this.scheme + ':';
	}

	if (str || this.host) {
		str += '//';
	}

	if (this.userInfo) {
		str += this.userInfo + '@';
	}

	if (this.host) {
		str += this.host;
	}

	if (!this.schemeAndPortMatch()) {
		str += ':' + this.port;
	}

	if (this.path || this.host) {
		str += '/';
	}

	if (this.path) {
		str += this.path.join('/').substr(1);
	}

	if (this.query) {
		str += '?' + this.query;
	}

	if (this.fragment) {
		str += '#' + this.fragment;
	}

	return str;
};

module.exports = URI;
