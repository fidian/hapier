/**
 * URI parsing and altering.  Based heavily on URI.js from
 * http://medialize.github.com/URI.js/
 *
 * Does less work since I need far less from the module.  Basically, this
 * one only performs URI resolution against a base and then converting it
 * back to a string.  It also lets me grab the URI portions easier, such as
 * the fragment.
 *
 * Usage:
 *   uri = Uri('http://blah.blah.blah/something');  // Normal URI
 *   uri = Uri('../somePage.html', 'http://example.com/dir/');  // Relative URI
 *   str = uri.toString();
 */
// Wrapper code from umdjs - UMD (Universal Module Definition) patterns
// https://github.com/umdjs/umd/blob/master/returnExports.js
/*global define*/
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		module.exports = factory();
	} else if (typeof define === 'function' && define.amd) {
		define([], factory);
	} else {
		root.returnExports = factory(root.b);
	}
}(this, function () {
	'use strict';

	/**
	 * Create a new URI
	 *
	 * @param string|Uri uri
	 * @param string|Uri|null base Used to resolve 'uri'
	 */
	function Uri(uri, base) {
		if (!(this instanceof Uri)) {
			return new Uri(uri, base);
		}

		if (uri instanceof Uri) {
			if (base) {
				// Create a new one so the original isn't modified
				return new Uri(uri.toString(), base);
			}

			return uri;
		}

		this.parseUri(uri);

		if (base) {
			base = new Uri(base);
			this.resolveAgainst(base);
		}
	}


	/**
	 * Parses out just the authority information and the host from a Uri
	 *
	 * @param string uri Uri starting with a potential authority/host section
	 * @return string Remainder of Uri
	 */
	Uri.prototype.parseAuthorityHost = function parseAuthorityHost(uri) {
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
	 * Parse a Uri string into this object
	 *
	 * @param string uri
	 */
	Uri.prototype.parseUri = function parseUri(uri) {
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
	 * Resolve the current Uri against another
	 *
	 * @param Uri base
	 */
	Uri.prototype.resolveAgainst = function resolveAgainst(base) {
		var dirs, dirsResolved;

		if (!this.scheme) {
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

		// Keep our path if it starts with /
		if (this.path.length && this.path[0] !== '') {
			// Resolve the new path
			dirs = base.path.slice();

			if (dirs[0] === '') {
				// Remove the empty first element
				// This indicates that the base is an absolute path
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
		}

		// If the dirs didn't change, then we could maybe keep the query
		if (this.path.join('/') === base.path.join('/')) {
			if (!this.query) {
				this.query = base.query;

				if (!this.fragment) {
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
	Uri.prototype.schemeAndPortMatch = function schemeAndPortMatch() {
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
	 * Convert a Uri object into a string
	 *
	 * @return string
	 */
	Uri.prototype.toString = function toString() {
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

	return Uri;
}));
