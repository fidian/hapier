/**
 * Schema object
 *
 * Typical usage in a browser:
 *    // Make the base object
 *    var Schema = require('./schema');  // Pulled from browserified code
 *    // Create a schema object, but it won't be loaded yet
 *    var schema = new Schema('/schemas/?format=json#/address');
 *    // Use jQuery to fetch schemas and flesh out this schema
 *    schema.load(schema.fetchJQuery, function (err) {
 *        // Schema is fully loaded, $rel and extends are resolved
 *        console.log(schema);
 *    });
 */
/*global document, jQuery, module, window */
'use strict';


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
 * A central place to cache schemas
 */
Schema.fetchCache = {};
Schema.loadCache = {};


/**
 * Fetch a schema using a callback if it is not already cached
 *
 * @param String uri
 * @param Function fetcher (uri, callback)
 * @param Function callback (err, data)
 */
Schema.prototype.fetch = function fetch(uri, fetcher, callback) {
	if (Schema.fetchCache[uri]) {
		callback(null, Schema.fetchCache[uri]);
		return;
	}

	fetcher(uri, function (err, data) {
		if (err) {
			callback(err);
		} else {
			Schema.fetchCache[uri] = data;
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
Schema.prototype.load = function load(fetcher, callback) {
	if (Schema.loadCache[this.fullUri]) {
		callback(null, Schema.loadCache[this.fullSchemaId]);
		return;
	}

	// TODO:  Finish
};


module.exports = Schema;
