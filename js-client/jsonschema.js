/**
 * JSON Schema object
 *
 * Create a schema object that can check validation, complete itself, etc.
 */
'use strict';

var SimpleWorkQueue;

SimpleWorkQueue = require('./simpleworkqueue');

/**
 * Create a new JSONSchema object
 *
 * @param string schemaUri Schema's ID as per how it was fetched (full URI)
 * @param Object schema Schema related information
 */
function JSONSchema(schemaId, schema) {
	// Allow people to omit the 'new' keyword
	if (!(this instanceof JSONSchema)) {
		return new JSONSchema(schemaId, schema);
	}

	this.schemaId = schemaId;
	this.schema = schema;
}


/**
 * Resolve an object, fetching additional resources as necessary
 *
 * @param Function fetcher (uri, callback)
 * @param Function whenDone (err)
 */
JSONSchema.prototype.resolve = function resolve(fetcher, whenDone) {
	var myself = this,
		q;

	q = new SimpleWorkQueue(function (err) {
		whenDone(err);
	});

	// Add async jobs to handle all of the properties.
	// Turn other schemas into JSONSchema objects or fetch them async
	// For all async jobs, use q.done();
};


module.exports = JSONSchema;
