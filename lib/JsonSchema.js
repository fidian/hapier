/**
 * JSON Schema object
 *
 * Inline dereferencing is not to be used in new schemas.  Only canonical
 * dereferencing should be used.
 */
/*global define, YUI*/
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		if (typeof module === 'object' && module.exports) {
			module.exports = factory(require('./hapierUtil'), require('./Uri'));
		} else {
			exports.JsonSchema = factory(require('./hapierUtil'), require('./Uri'));
		}
	} else if (typeof define === 'function' && define.amd) {
		define(['hapierUtil', 'Uri'], factory);
	} else if (typeof YUI === 'function') {
		YUI.add('JsonSchema', function (Y) {
			Y.JsonSchema = factory(Y.hapierUtil, Y.Uri);
		}, '', {
			requires: ['hapierUtil', 'Uri']
		});
	} else if (typeof root === 'object') {
		root.JsonSchema = factory(root.hapierUtil, root.Uri);
	} else {
		throw "Unable to export JsonSchema";
	}
}(this, function (util, Uri) {
	'use strict';


	/**
	 * Create a new JsonSchema
	 *
	 * Make sure the URI to this schema is relative to the parent's URI
	 * when you create it.
	 *
	 * @param object rawSchema Original schema, unmodified
	 * @param string uri URI to this schema
	 * @param object parentSchema Parent (optional)
	 */
	function JsonSchema(rawSchema, uri, parentSchema) {
		if (!(this instanceof JsonSchema)) {
			return new JsonSchema(rawSchema, uri, parentSchema);
		}

		// Load the data, linking up parents and splitting off subschemas
		// into their own objects
		this.rawSchema = rawSchema;  // Keep this untouched
		this.uri = uri;
		this.parentSchema = parentSchema;
		this.validityCheck();
		this.remembered = {};  // Cache of looked up data - see recall()
	}


	/**
	 * Returns the ID of the schema
	 *
	 * This will be the Uri in a string form if there is no 'id' property
	 * on the schema.  Otherwise, it will resolve the value of the 'id'
	 * property against the parent's ID.  When there is no parent, it will
	 * resolve the ID against the URI.
	 *
	 * JSON Schema: core 7.2
	 *
	 * @return string
	 */
	JsonSchema.prototype.getId = function getId() {
		var myself;

		function determineId() {
			var uri;

			if (myself.rawSchema.id === undefined) {
				return myself.uri;
			}

			uri = new Uri(myself.rawSchema.id, myself.uri);

			// Set the default JSON Pointer to be the top object at the URL
			// if this URL does not already have a fragment
			uri.forceFragment = true;
			return uri.toString();
		}

		myself = this;
		return this.recall('id', determineId);
	};


	/**
	 * Tries to remember something that was previously determined.  If it
	 * was not already determined, this calls the callback and remembers the
	 * result so it won't need to do that work again.
	 *
	 * @parameter string key
	 * @parameter function callback
	 * @return mixed
	 */
	JsonSchema.prototype.recall = function (key, determineFunc) {
		if (this.remembered[key] === undefined) {
			this.remembered[key] = determineFunc();
		}

		return this.remembered[key];
	};


	/**
	 * Ensure that properties have the right data types and that some
	 * dependencies are given.
	 *
	 * @throws Error when something is wrong
	 */
	JsonSchema.prototype.validityCheck = function () {
		var myself;

		function checkProperties(properties, validator) {
			properties.forEach(function (singleElement) {
				var result, propertyName;

				if (typeof singleElement !== 'string') {
					propertyName = singleElement[0];
				} else {
					propertyName = singleElement;
				}

				if (myself[propertyName] !== undefined) {
					result = validator(myself[propertyName], singleElement);

					if (result) {
						throw new Error(propertyName + ' ' + result + ' (' + myself.getId() + ')');
					}
				}
			});
		}

		myself = this;

		// When one is present, the other must also be present
		// JSON Schema: validation 5.1.2.1 (exclusiveMaximum), 5.1.3.1
		// (exclusiveMinimum)
		checkProperties([
			['exclusiveMaximum', 'maximum'],
			['exclusiveMinimum', 'minimum']
		], function (val, pairing) {
			if (typeof myself[pairing[1]] === undefined) {
				return 'requires ' + pairing[1] + ' to be defined';
			}
		});

		// These must be strings
		// JSON Schema: validation 5.2.3.1 (pattern)
		checkProperties(['pattern'], function (val) {
			if (typeof val !== 'pattern') {
				return 'must be a string';
			}
		});

		// These must be numbers
		// JSON Schema: validation 5.1.1.1 (multipleOf), 5.1.2.1 (maximum),
		// 5.1.3.1 (minimum), 5.2.1.1 (maxLength), 5.2.2.1 (minLength)
		checkProperties(['multipleOf', 'maximum', 'minimum', 'maxLength', 'minLength'], function (val) {
			if (typeof val !== 'number') {
				return 'must be a number';
			}
		});

		// When set, these must be greater than zero
		// JSON Schema: validation 5.1.1.1 (multipleOf)
		checkProperties(['multipleOf'], function (val, key) {
			if (val <= 0) {
				return 'must be greater than 0';
			}
		});

		// When set, these must be greater than or equal zero
		// JSON Schema: validation 5.2.1.1 (maxLength), 5.2.2.1 (minLength)
		checkProperties(['maxLength', 'minLength'], function (val, key) {
			if (val <= 0) {
				return 'must be greater than or equal to 0';
			}
		});
	};


	return JsonSchema;
}));
