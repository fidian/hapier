/**
 * JSON Schema Provider object
 *
 * This is responsible for retrieving a JSON Schema file (raw text),
 * converting it to a JSON object, then converting it into JSONSchema objects.
 *
 * Usage:
 *
 * var JSONSchemaProvider, provider;
 * JSONSChemaProvider = require('./jsonschemaprovider');
 * // Use jQuery's AJAX to fetch/parse JSON files
 * provider = new JSONSchemaProvider(JSONSchemaProvider.jQuery);
 */
/*global jQuery*/
'use strict';

var JSONSchema, URI;

JSONSchema = require('./jsonschema');
URI = require('./uri');

/**
 * Create a new Schema object
 *
 * Use something like this:
 *    var provider = new JSONSchemaProvider(JSONSchemaProvider.jQuery);
 *
 * @param Function method How we are to fetch schemas
 */
function JSONSchemaProvider(method) {
	// Allow people to omit the 'new' keyword
	if (!(this instanceof JSONSchemaProvider)) {
		return new JSONSchemaProvider(method);
	}

	this.providerMethod = method;
	this.rawCache = {};  // Raw JSON objects
	this.processedCache = {};
}


/**
 * Fetch a schema (not JSONSchema object) with jQuery
 *
 * @param String uri
 * @param Function callback (err, data)
 */
JSONSchemaProvider.jQuery = function jQuery(uri, callback) {
	jQuery.ajax(uri, {
		accepts: 'application/vnd.hapi+json, application/json;q=0.8',
		dataType: 'text json',
		error: function (jqXHR, textStatus, errorThrown) {
			callback(errorThrown);
		},
		success: function (data, textStatus, jqXHR) {
			callback(null, data);
		}
	});
};


/**
 * Fetch a schema (not JSONSchema object) and use a cache for speed.
 *
 * @param String uri May contain a hash, which this strips
 * @param Function callback (err, data)
 */
JSONSchemaProvider.prototype.fetch = function fetch(uri, callback) {
	var cleanUri = uri.split('#')[0],
		jsonPointer = uri.split('#')[1];

	if (this.rawCache[cleanUri]) {
		this.resolvePointer(this.rawCache[cleanUri], uri, jsonPointer, callback);
		return;
	}

	this.providerMethod(uri, function (err, data) {
		if (err) {
			callback(err);
		} else {
			this.rawCache[cleanUri] = data;
			this.resolvePointer(this.rawCache[cleanUri], uri, jsonPointer, callback);
		}
	});
};


/**
 * Load a schema.  This consists of:
 *  - fetching an unprocessed schema
 *  - iterating over the properties and filling in $ref links
 *  - convert the raw data to JSONSchema objects
 *
 * @param string|URI uri URI of schema
 * @param string|URI baseUri Base URI for relative links (optional)
 * @param Function callback (err, JSONSchema)
 */
JSONSchemaProvider.prototype.load = function load(uri, baseUri, callback) {
	var myself = this,
		parsedUri;

	if (callback === undefined) {
		callback = baseUri;
		parsedUri = URI(uri).toString();
	} else {
		parsedUri = URI(uri, baseUri).toString();
	}

	if (this.processedCache[parsedUri]) {
		callback(null, this.processedCache[parsedUri]);
		return;
	}

	// TODO:  Finish
	this.fetch(parsedUri, function (err, data) {
		var js;

		if (err) {
			callback(err);
		} else {
			js = new JSONSchema(data);
			myself.processedCache[parsedUri] = js;
			js.resolve(function fetcher(uri, callback) {
				// Change scope and then fetch the right URI
				myself.fetch.call(myself, uri, callback);
			}, callback);
		}
	});
};


/**
 * Walk down an object using a JSON Pointer.  Returns the ending object to
 * the callback.
 *
 * @param Object schema
 * @param string uri For error message purposes
 * @param string pointer
 * @param Function callback
 */
JSONSchemaProvider.prototype.resolvePointer = function resolvePointer(schema, uri, pointer, callback) {
	var pointers = pointer.explode('/');

	if (pointers[0] !== '') {
		callback(new Error('Invalid JSON Pointer (' + pointer + ') in uri (' + uri + ')'));
		return;
	}

	pointers.shift();

	if (!pointers.every(function (segment) {
			// Unescape
			segment = segment.replace(/~1/g, '/').replace(/~0/g, '~');

			if (Array.isArray(schema)) {
				segment = +segment;  // Force to be numeric
			}

			schema = schema[segment];

			// We should always land on an array or object.
			// Luckily, typeof [] === 'object'
			return (typeof schema === 'object');
		})) {
		callback(new Error('JSON pointer (' + pointer + ') resolves to invalid location in uri (' + uri + ')'));
		return;
	}

	callback(null, schema);
};


module.exports = JSONSchemaProvider;
