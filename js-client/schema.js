/**
 * Schema object
 *
 * Typical usage in a browser:
 *    // Create a schema object, but it won't be loaded yet
 *    var schema = new Schema('/schemas/?format=json#/address');
 *    // Use jQuery to fetch schemas and flesh out this schema
 *    schema.load(schema.fetchJQuery, function (err) {
 *        // Schema is fully loaded, $rel and extends are resolved
 *        console.log(schema);
 *    });
 */
/*global document, jQuery, module, window */
(function () {
	'use strict';

	var loadCache, fetchCache, proto, util;

	util = {
		/**
		 * Clones an object
		 *
		 * @param mixed src
		 * @return mixed Copy of src
		 */
		clone: function clone(src) {
			var target, myself;

			function copy(val, index) {
				target[index] = util.clone(val);
			}

			if (util.isArray(src)) {
				target = [];
				this.each(src, copy);
			} else if (typeof src === 'object') {
				target = {};
				this.each(src, copy);
			} else {
				target = src;
			}

			return target;
		},


		/**
		 * Iterate over an array or object, or maybe just call the callback
		 * with a single value
		 *
		 * @param mixed thing
		 * @param Function callback(item, index)
		 * @param Object thisArg (optional) Contect for calling the callback
		 */
		each: function each(thing, callback, thisArg) {
			var i;

			if (util.isArray(thing)) {
				if (Array.prototype.forEach) {
					Array.prototype.forEach.call(thing, callback, thisArg);
				} else {
					for (i = 0; i < thing.length; i += 1) {
						if (thing[i] !== undefined) {
							callback.call(thisArg, thing[i], i, thing);
						}
					}
				}
			} else if (typeof thing === 'object') {
				for (i in thing) {
					if (Object.prototype.hasOwnProperty.call(thing, i)) {
						callback.call(thisArg, thing[i], i, thing);
					}
				}
			} else {
				callback.call(thisArg, thing);
			}
		},


		/**
		 * Return true if this is an array
		 *
		 * @param mixed thing
		 */
		isArray: Array.isArray || function (thing) {
			if (typeof thing === 'object' && Object.prototype.toString.call(thing) === '[object Array]') {
				return true;
			}

			return false;
		},


		/**
		 * Trim a string
		 *
		 * @param String str
		 * @return String
		 */
		trim: function (str) {
			if (String.trim) {
				return str.trim();
			}

			return str.replace(/^\s+|\s+$/g, '');
		}
	};


	/**
	 * Create a new Schema object
	 *
	 * @param String schemaId Relative or absolute URI JSON pointer
	 * @param String baseUri (optional) defaults to document.location
	 */
	function Schema(schemaId, baseUri) {
		// Allow people to omit the 'new' keyword
		if (!(this instanceof Schema)) {
			return new Schema(schemaId, baseUri);
		}

		if (baseUri === undefined) {
			if (document && document.location) {
				baseUri = document.location.toString();
			} else {
				baseUri = 'about:blank';
			}
		}

		this.baseUri = baseUri;
		this.schemaId = schemaId;
		this.resolveUris();
	}


	/**
	 * Fetch a schema with jQuery
	 *
	 * @param String uri
	 * @param Function callback (err, data)
	 */
	Schema.fetchJQuery = function fetchJQuery(uri, callback) {
		jQuery.ajax(uri, {
			accepts: 'application/vnd.hapi+json,application/json',
			dataType: 'json',
			error: function (jqXHR, textStatus, errorThrown) {
				callback(errorThrown);
			},
			success: function (data, textStatus, jqXHR) {
				callback(null, data);
			}
		});
	};


	/**
	 * Build a URI
	 *
	 * @param Object uri Parsed URI object
	 * @return String
	 */
	Schema.buildUri = function buildUri(uri) {
		var str = "";

		if (uri.protocol) {
			str += uri.protocol + ":";
		}

		if (str || uri.host) {
			str += "//";
		}

		if (uri.userInfo) {
			str += uri.userInfo + "@";
		}

		if (uri.host) {
			str += uri.host;
		}

		if (uri.path || uri.host) {
			str += '/';
		}

		if (uri.path) {
			str += uri.path.join('/');
		}

		if (uri.query) {
			str += "?" + uri.query;
		}

		if (uri.fragment) {
			str += "#" + uri.fragment;
		}

		return str;
	};


	/**
	 * Parse a URI
	 *
	 * @param String uri
	 * @return Object
	 */
	Schema.parseUri = function parseUri(uri) {
		var result = {
			scheme: '',
			userInfo: '',
			host: '',
			port: '',
			path: [],
			query: null,
			fragment: null
		};

		function parseAuthority(uri) {
			var hostport, lastIndex;

			uri = uri.split('@');

			if (uri.length > 1) {
				if (uri[0].indexOf('/') >= 0) {
					uri = uri.join('@');
				} else {
					result.userInfo = uri[0];
					uri = uri[1];
				}
			} else {
				uri = uri[0];
			}

			uri = uri.split('/');

			if (uri.length > 0 && uri[0].length) {
				hostport = uri[0];
				uri[0] = '';
				uri = uri.join('/');
				hostport = hostport.split(':');
				lastIndex = hostport.length - 1;

				if (lastIndex > 0 && hostport[lastIndex].match(/^[0-9]*$/)) {
					result.port = hostport[lastIndex];
					hostport = hostport.slice(0, lastIndex).join(':');
				}

				result.host = hostport;
			}

			return uri;
		}

		uri = util.trim(uri);
		uri = uri.split('#');

		if (uri.length > 1) {
			result.fragment = uri;
		}

		uri = uri[0].split('?');

		if (uri.length > 1) {
			result.query = uri[2];
		}

		if (uri[0].substr(0, 2) === '//') {
			// Relative schema
			uri = uri[0].substr(2);
			uri = parseAuthority(uri);
		} else {
			uri = uri[0].split(':');

			if (uri.length > 1) {
				if (uri[0].match(/^[a-z][\-+a-z0-9]*$/i)) {
					result.scheme = uri[0];
					uri = parseAuthority(uri[1]);
				} else {
					uri = uri.join(':');
				}
			} else {
				uri = uri[0];
			}
		}

		result.path = uri.split('/');
		return result;
	};


	/**
	 * Resolve a uri relative to another uri
	 *
	 * @param Object relative
	 * @param Object absolute
	 * @return Object
	 */
	Schema.resolveUri = function resolve(relative, absolute) {
		var dir, dirs, dirsResolved, i, resolved;

		resolved = util.clone(relative);

		if (resolved.host) {
			return resolved;
		}

		util.each([ 'scheme', 'userInfo', 'host', 'port' ], function (property) {
			resolved = absolute[property];
		});
		util.each([ 'query', 'path' ], function (property) {
			if (resolved[property] === undefined && absolute[property] !== undefined) {
				resolved[property] = absolute[property];
			}
		});

		if (resolved.path[0] !== '') {
			dirs = util.clone(absolute.path);
			dirsResolved = [];
			util.each(resolved.path, function (item) {
				dirs.push(item);
			});

			while (dirs.length) {
				dir = dirs.unshift();

				if (dir === '..') {
					dirsResolved.pop();
				} else if (dir !== '.' && dir !== '..') {
					dirsResolved.push(dir);
				}
			}

			resolved.path = dirsResolved;
		}

		return resolved;
	};


	proto = Schema.prototype;


	/**
	 * Fetch a schema using a callback if it is not already cached
	 *
	 * @param String uri
	 * @param Function fetcher (uri, callback)
	 * @param Function callback (err, data)
	 */
	proto.fetch = function fetch(uri, fetcher, callback) {
		if (this.fetchCache[uri]) {
			callback(null, this.fetchCache[uri]);
			return;
		}

		fetcher(uri, function (err, data) {
			if (err) {
				callback(err);
			} else {
				this.fetchCache[uri] = data;
				callback(null, data);
			}
		});
	};


	/**
	 * Load a schema.  This consists of fetching a schema, then iterating
	 * over the properties and extending/following links until the
	 * schema is fully loaded.
	 *
	 * @param Function fetcher (uri, callback)
	 * @param Function callback (err)
	 */
	proto.load = function load(fetcher, callback) {
		if (this.loadCache[this.fullUri]) {
			callback(null, this.loadCache[this.fullSchemaId]);
			return;
		}

		// TODO:  Finish
	};


	/**
	 * Resolve a uri versus a base uri
	 *
	 * Sets properties on this based on this.schemaId and this.baseUri
	 */
	proto.resolveUris = function resolveUris() {
		var baseUri = Schema.parseUri(this.baseUri),
			schemaUri = Schema.parseUri(this.schemaId),
			resolvedUri = Schema.resolveUri(schemaUri, baseUri);
		this.resolvedUriObject = util.clone(resolvedUri);
		this.fullUri = Schema.buildUri(resolvedUri);
		resolvedUri.hash = '';
		this.fetchUri = Schema.buildUri(resolvedUri);
	};


	/**
	 * Assign to the usual locations for node and the browser
	 */
	if (window) {
		window.Schema = Schema;
	}

	if (module && typeof module.exports === 'object') {
		module.exports = Schema;
	}
}());
