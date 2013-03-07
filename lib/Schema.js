/**
 * JSON Schema object
 *
 * Stores information about the schema, converts sub-schemas into Schema
 * objects.
 */
/*global define, YUI*/
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		if (typeof module === 'object' && module.exports) {
			module.exports = factory(require('./Promise'), require('./Uri'));
		} else {
			exports.Schema = factory(require('./Promise'), require('./Uri'));
		}
	} else if (typeof define === 'function' && define.amd) {
		define(['Promise', 'Uri'], factory);
	} else if (typeof YUI === 'function') {
		YUI.add('Schema', function (Y) {
			Y.Schema = factory(Y.Promise, Y.Uri);
		}, '', {
			requires: ['Promise', 'Uri']
		});
	} else if (typeof root === 'object') {
		root.Schema = factory(root.Promise, root.Uri);
	} else {
		throw "Unable to export Schema";
	}
}(this, function (Promise) {
	'use strict';

	var Uri, util;

	Uri = require('./uri');
	util = require('./util');

	/**
	 * Create a new Schema object from a plain object
	 *
	 * @param string schemaUri Schema's ID as per how it was fetched (full URI)
	 * @param Object schema Schema related information
	 */
	function Schema(schemaUri, rawData) {
		// Allow people to omit the 'new' keyword
		if (!(this instanceof Schema)) {
			return new Schema(schemaId, schema);
		}

		this.schemaId = schemaId;
		this.schemaRaw = util.clone(schema);
		this.schema = schema;
	}


	/**
	 * Call a resolver method given its name.
	 * Forces the scope appropriately
	 *
	 * @param string name
	 * @param object obj
	 * @param string propName
	 * @param Function fetcher (uri, callback)
	 * @param SimpleNotify notifier
	 * @return mixed Whatever came from the resolver method
	 */
	Schema.prototype.callResolverMethod = function callResolverMethod(name, obj, propName, fetcher, notifier) {
		var method;

		method = this.resolverMethods[name];
		return method.call(this, obj, propName, fetcher, notifier);
	};

	/**
	 * Compare if two values are the same.  This embodies the logic that is
	 * used for uniqueItems comparisons.
	 *
	 * @param mixed a
	 * @param mixed b
	 * @return boolean True if they are the same
	 */
	Schema.prototype.compare = function compare(a, b) {
		var aKeys, aType, bKeys, bType, myself, valid;

		aType = this.determineType(a);
		bType = this.determineType(b);
		myself = this;

		if (aType !== bType) {
			return false;
		}

		switch (aType) {
		case 'null':
			// If they are both null, they can't differ
			return true;

		case 'boolean':
		case 'integer':
		case 'number':
		case 'string':
			// Compare the value
			if (a === b) {
				return true;
			}

			return false;

		case 'array':
			if (a.length !== b.length) {
				return false;
			}

			valid = a.every(function (aValue, aKey) {
				if (!myself.compare(aValue, b[aKey])) {
					return false;
				}

				return true;
			});
			return valid;

		case 'object':
			aKeys = Object.keys(a);
			bKeys = Object.keys(b);

			if (!this.compare(aKeys, bKeys)) {
				return false;
			}

			valid = aKeys.every(function (key) {
				if (!myself.compare(a[key], b[key])) {
					return false;
				}

				return true;
			});
			return valid;
		}

		// "unknown" and "undefined" should not be passed in.
		// Treat them as being different
		return false;
	};

	/**
	 * Gets the effective type of the data, not the type from the schema.
	 *
	 * @param mixed data
	 * @return string type
	 */
	Schema.prototype.determineType = function determineType(data) {
		switch (typeof data) {
		case 'boolean':
			return 'boolean';

		case 'number':
			if (Math.round(data) === data) {
				return 'integer';
			}

			return 'number';

		case 'null':
			return 'null';

		case 'object':
			if (Array.isArray(data)) {
				return 'array';
			}

			return 'object';

		case 'string':
			return 'string';

		case 'undefined':
			return 'undefined';
		}

		return 'unknown';
	};


	/**
	 * Assign getters that also search the schemas which extend this one.
	 */
	util.iterate({
		/*
		additionalItems: 'booleanOrSchema',
		additionalProperties: 'booleanOrSchema',
		dependencies: 'typeOrSchema',
		divisibleBy: 'numberNotZeroOrNull',
		'extends': 'schemaOrArrayOfSchemas',
		items: 'schemaOrArrayOfSchemas',
		*/
		'default': 'firstValue',
		description: 'firstValue',
		'enum': 'uniqueArray',
		exclusiveMaximum: 'trueIfOneIsTrue',
		exclusiveMinimum: 'trueIfOneIsTrue',
		format: 'firstValue',
		maximum: 'minimum',
		maxItems: 'minimum',
		maxLength: 'minimum',
		minimum: 'maximum',
		minItems: 'maximum',
		minLength: 'maximum',
		pattern: 'firstValue',
		patternProperties: 'propertyCollection',
		properties: 'propertyCollection',
		required: 'trueIfOneIsTrue',
		title: 'firstValue',
		type: 'type',
		uniqueItems: 'trueIfOneIsTrue'
	}, function (type, property) {
		var fn, myself;

		fn = function () {};

		function extendData(schema, callback) {
			if (schema.schema[property] !== undefined) {
				callback(schema.schema[property]);
			}
			if (schema.schema['extends']) {
				if (Array.isArray(schema.schema['extends'])) {
					schema.schema['extends'].forEach(function (childSchema) {
						extendData(childSchema, callback);
					});
				} else {
					extendData(schema.schema['extends'], callback);
				}
			}
		}

		switch (type) {
		case 'firstValue':
			fn = function firstValue() {
				var val = null;
				extendData(this, function (testVal) {
					if (!val && testVal) {
						val = testVal;
					}
				});
				return val;
			};
			break;

		case 'maximum':
			fn = function maximum() {
				var result = null;
				extendData(this, function (val) {
					if (result === null || val > result) {
						result = val;
					}
				});
				return result;
			};
			break;

		case 'minimum':
			fn = function minimum() {
				var result = null;
				extendData(this, function (val) {
					if (result === null || val < result) {
						result = val;
					}
				});
				return result;
			};
			break;

		case 'propertyCollection':
			fn = function propertyCollection() {
				var properties = {};
				extendData(this, function (newProperties) {
					util.iterate(newProperties, function (propValue, propName) {
						properties[propName] = propValue;
					});
				});

				return properties;
			};
			break;

		case 'trueIfOneIsTrue':
			fn = function trueIfOneIsTrue() {
				var result = false;
				extendData(this, function (val) {
					if (val) {
						result = true;
					}
				});
				return result;
			};
			break;

		case 'type':
			fn = function type() {
				var result = [];
				extendData(this, function (val) {
					if (Array.isArray(val)) {
						Schema.prototype.uniqueArrayAdd(result, val);
					} else if (val) {
						Schema.prototype.uniqueArrayAdd(result, [ val ]);
					}
				});

				if (result.length === 0) {
					return null;
				}

				return result;
			};
			break;

		case 'uniqueArray':
			fn = function uniqueArray() {
				var result = null;
				extendData(this, function (val) {
					if (Array.isArray(val)) {
						if (!Array.isArray(result)) {
							result = [];
						}

						Schema.prototype.uniqueArrayAdd(result, val);
					}
				});
				return result;
			};
			break;
		}

		Schema.prototype['get' + property.charAt(0).toUpperCase() + property.slice(1)] = fn;
	});


	/**
	 * Determine if a type passed in (string only) is a simple type.
	 *
	 * @param string type
	 * @return boolean True if this is a simple type
	 */
	Schema.prototype.isSimpleType = function isSimpleType(type) {
		if (type === undefined) {
			type = this.schema.type;
		}

		if (typeof type === 'object') {
			type = type.toString();
		}

		if (typeof type !== 'string') {
			return false;
		}

		switch (type) {
		case 'any':
		case 'array':
		case 'boolean':
		case 'integer':
		case 'null':
		case 'number':
		case 'object':
		case 'string':
			return true;
		}

		return false;
	};


	/**
	 * Resolve an object, fetching additional resources as necessary.
	 * The actual fetching is done by resolveSchema()
	 *
	 * @param Function fetcher (uri, callback)
	 * @param Function whenDone (err)
	 */
	Schema.prototype.resolve = function resolve(fetcher, whenDone) {
		var myself, uri;

		myself = this;

		function resolve_theRest() {
			var map, notifier, property;

			notifier = new SimpleNotify(function (err) {
				if (err) {
					whenDone(err);
				} else {
					whenDone(null, myself);
				}
			});

			util.iterate(Schema.prototype.resolverMapping, function (func, propName) {
				myself.callResolverMethod(func, myself.schema, propName, fetcher, notifier);
			});
		}

		// Handle $ref first and it must complete before we tackle any other
		// properties
		if (this.schema.$ref) {
			// URI resolution
			uri = new Uri(this.schema.$ref, this.schemaId);

			// Get the schema - this returns the correct JSON Schema object
			// by following the URL and the pointer
			fetcher(uri.toString(), function resolve_ref(err, data) {
				console.log(uri.toString(), err, data);
				if (err) {
					whenDone(err);
					return;
				}

				myself.schema = data;
				myself.$ref = uri.toString();
				resolve_theRest();
			});
		} else {
			resolve_theRest();
		}
	};


	/**
	 * Map a schema's properties to a method that helps ensure it is valid or
	 * that will set it to a default value.
	 */
	Schema.prototype.resolverMapping = {
		additionalItems: 'booleanOrSchema',
		additionalProperties: 'booleanOrSchema',
		'default': 'any',
		dependencies: 'dependencies',
		description: 'stringOrNull',
		divisibleBy: 'numberNotZeroOrNull',
		'enum': 'arrayOrNull',
		exclusiveMaximum: 'booleanDefaultFalse',
		exclusiveMinimum: 'booleanDefaultFalse',
		'extends': 'schemaOrArrayOfSchemas',
		format: 'stringOrNull',
		items: 'schemaOrArrayOfSchemas',
		maximum: 'numberOrNull',
		maxItems: 'integerOrNull',
		maxLength: 'integerOrNull',
		minimum: 'numberOrNull',
		minItems: 'integerOrNull',
		minLength: 'integerOrNull',
		pattern: 'stringOrNull',
		patternProperties: 'objectOfSchemas',
		properties: 'objectOfSchemas',
		required: 'booleanDefaultFalse',
		title: 'stringOrNull',
		type: 'type',
		uniqueItems: 'booleanDefaultFalse'
	};


	/**
	 * Individual functions that handle the different variations of properties
	 */
	Schema.prototype.resolverMethods = {
		/**
		 * Allow anything
		 */
		any: function (obj, property, fetcher, notifier) {
		},

		/**
		 * This value must be an array or set this to null
		 */
		arrayOrNull: function (obj, property, fetcher, notifier) {
			if (!Array.isArray(obj[property])) {
				obj[property] = null;
				return;
			}
		},

		/**
		 * The property should be a boolean.  If not specified, the value is
		 * considered false.
		 */
		booleanDefaultFalse: function (obj, property, fetcher, notifier) {
			if (obj[property] === undefined) {
				obj[property] = false;
				return;
			}

			obj[property] = !!obj[property];
		},

		/**
		 * The value should be a boolean or a schema object.  Set the default value
		 * of 'true' since booleanDefaultFalse will make the default not friendly
		 * to JSON Schema spec.
		 */
		booleanOrSchema: function (obj, property, fetcher, notifier) {
			if (obj[property] === undefined) {
				obj[property] = true;
				return;
			}

			if (typeof obj[property] === 'object') {
				this.callResolverMethod('schema', obj, property, fetcher, notifier);
				return;
			}

			this.callResolverMethod('booleanDefaultFalse', obj, property, fetcher, notifier);
		},

		/**
		 * An object that contains schemas or types as values
		 */
		dependencies: function (obj, property, fetcher, notifier) {
			var myself;

			myself = this;

			if (typeof obj[property] !== 'object') {
				obj[property] = {};
				return;
			}

			util.iterate(obj[property], function (value, key) {
				myself.callResolverMethod('typeOrSchema', obj[key], key, fetcher, notifier);
			});
		},

		/**
		 * Make this an integer or set it to a null value
		 */
		integerOrNull: function (obj, property, fetcher, notifier) {
			if (typeof obj[property] !== 'number') {
				obj[property] = null;
				return;
			}

			obj[property] = Math.round(obj[property]);
		},

		/**
		 * Make this an integer that is not zero or set it to a null value
		 */
		numberNotZeroOrNull: function (obj, property, fetcher, notifier) {
			if (typeof obj[property] !== 'number') {
				obj[property] = null;
				return;
			}

			if (obj[property] === 0) {
				obj[property] = null;
				return;
			}
		},

		/**
		 * Make this a number or set it to a null value
		 */
		numberOrNull: function (obj, property, fetcher, notifier) {
			if (typeof obj[property] !== 'number') {
				obj[property] = null;
				return;
			}
		},

		/**
		 * An object that contains schemas as properties
		 */
		objectOfSchemas: function (obj, property, fetcher, notifier) {
			var myself;

			myself = this;

			if (typeof obj[property] !== 'object') {
				obj[property] = {};
				return;
			}

			util.iterate(obj[property], function (propValue, propName) {
				myself.callResolverMethod('schema', obj[property], propName, fetcher, notifier);
			});
		},

		/**
		 * Only allow a schema here.  If an invalid value is found, convert to
		 * an empty schema.
		 */
		schema: function (obj, property, fetcher, notifier) {
			if (typeof obj[property] !== 'object') {
				obj[property] = {};
				// Do not return here - process the empty schema to set up rules
			}

			this.resolveSchema(obj, property, fetcher, notifier.done());
		},

		/**
		 * A schema or an array of schemas
		 */
		schemaOrArrayOfSchemas: function (obj, property, fetcher, notifier) {
			var myself;

			myself = this;

			if (Array.isArray(obj[property])) {
				obj[property].forEach(function (propName) {
					myself.callResolverMethod('schema', obj[property], propName, fetcher, notifier);
				});
				return;
			}

			if (!obj[property]) {
				return;
			}

			this.callResolverMethod('schema', obj, property, fetcher, notifier);
		},

		/**
		 * Make this a string or set it to a null value
		 */
		stringOrNull: function (obj, property, fetcher, notifier) {
			if (typeof obj[property] !== 'string') {
				obj[property] = null;
			}
		},

		/**
		 * These are a known type (string) or a schema or possibly a list of
		 * known types (strings) or schemas in an array.
		 *
		 * Convert everything to an array for easier comparisons.  Also, make
		 * the items in the array unique.
		 */
		type: function (obj, property, fetcher, notifier) {
			var myself, unique;

			myself = this;

			if (!Array.isArray(obj[property])) {
				obj[property] = [ obj[property] ];
			}

			if (!obj[property].length) {
				obj[property] = [ 'any' ];
				return;
			}

			unique = [];
			Schema.prototype.uniqueArrayAdd(unique, obj[property]);
			obj[property] = unique;
			obj[property].forEach(function (value, key) {
				myself.callResolverMethod('typeOrSchema', obj[key], key, fetcher, notifier);
			});
		},

		/**
		 * This should be either a single simple type or schema.  If not known,
		 * this defaults to 'any'
		 */
		typeOrSchema: function (obj, property, fetcher, notifier) {
			if (obj === undefined) {
				return;
			}

			if (this.isSimpleType(obj[property])) {
				return;
			}

			if (typeof obj[property] === 'object') {
				// Objects should be schemas
				this.callResolverMethod('schema', obj, property, fetcher, notifier);
				return;
			}

			// Treat the rest as "any"
			obj[property] = "any";
		}
	};


	/**
	 * Go lookup a schema using the provided fetching function.  This can be
	 * either async or sync, depending on if we need to actually fetch a
	 * schema or if one was already fetched earlier.
	 *
	 * @param Object parentObj
	 * @param number|string key
	 * @param Function fetcher (uri, callback)
	 * @param Function whenDone (err)
	 */
	Schema.prototype.resolveSchema = function resolveSchema(parentObj, key, fetcher, whenDone) {
		var schema = new Schema(this.schemaId, parentObj[key]);
		parentObj[key] = schema;
		schema.resolve(fetcher, whenDone);
	};


	/**
	 * Uniquely add more things to a target array
	 *
	 * @param Array target Array that should grow
	 * @param Array more Array containing elements that may be added to target
	 */
	Schema.prototype.uniqueArrayAdd = function uniqueArrayAdd(target, more) {
		more.forEach(function (moreVal) {
			if (moreVal !== undefined && !target.some(function (targetVal) {
					if (Schema.prototype.compare(moreVal, targetVal)) {
						return true;
					}

					return false;
				})) {
				target.push(moreVal);
			}
		});
	};


	/**
	 * Validate that data matches this schema
	 *
	 * @param function failureCallback (path, code, message)
	 * @param string path Current path to this object
	 * @return boolean
	 */
	Schema.prototype.validate = function validate(data, failureCallback, path) {
		var dataType, errors, method, myself, result;

		if (typeof failureCallback !== 'function') {
			failureCallback = function () {};
		}

		if (typeof path !== 'string') {
			path = '';
		}

		if (data === undefined && this.schema['default'] !== undefined) {
			data = this.schema['default'];
		}

		path += '/';
		dataType = this.determineType(data);
		myself = this;
		errors = 0;

		util.iterate(this.validateMethods, function (func, propName) {
			var result;

			function validateFailureCallback(message) {
				failureCallback(path, propName, message);
			}

			result = func.call(myself, myself.schema[propName], data, dataType, validateFailureCallback);

			if (!result) {
				// TODO:  Maybe stop immediately
				errors += 1;
			}
		});

		return errors === 0;
	};


	/**
	 * Validation methods for every rule
	 */
	Schema.prototype.validateMethods = {
		/**
		 * Must match one of the simple types or validate against a schema.
		 * This also allows undefined to pass and the 'required' attribute
		 * should be the one enforcing if a value is present.
		 */
		type: function (rule, data, dataType, failureCallback) {
			var result;

			if (dataType === 'undefined') {
				return true;
			}

			result = rule.some(function (testType) {
				// Handle schema objects
				if (typeof testType === 'object') {
					return testType.validate(data);
				}

				// Handle basic types and "any"
				if (testType === "any" || testType === dataType) {
					return true;
				}

				return false;
			});

			if (!result) {
				failureCallback();
			}

			return result;
		},

		/**
		 * The properties listed must match against the matching schema
		 */
		properties: function (rule, data, dataType, failureCallback) {
			var valid;

			if (dataType !== 'object') {
				return true;
			}

			valid = true;

			util.iterate(rule, function (subSchema, propName) {
				if (!subSchema.validate(data[propName])) {
					// TODO:  Chain the failure callback into the call to validate()
					failureCallback(propName);
					valid = false;
				}
			});

			return valid;
		},

		/**
		 * Match a schema against multiple properties whose name matches a
		 * pattern.
		 */
		patternProperties: function (rule, data, dataType, failureCallback) {
			var myself, valid;

			if (dataType !== 'object') {
				return true;
			}

			myself = this;
			valid = true;

			util.iterate(rule, function (subSchema, propPatternString) {
				var propPattern;

				propPattern = new RegExp(propPatternString);
				util.iterate(data, function (dataValue, dataProperty) {
					if (dataProperty.match(propPattern)) {
						if (!subSchema.validate(dataValue)) {
							failureCallback(dataProperty);
							valid = false;
						}
					}
				});
			});

			return valid;
		},

		additionalProperties: function (rule, data, dataType, failureCallback) {
			var myself, propNames, valid;

			if (dataType !== 'object') {
				return true;
			}

			myself = this;
			propNames = Object.keys(data);

			// Remove property names matching a property in this.schema.properties
			propNames = propNames.filter(function (propName) {
				if (myself.schema[propName] !== undefined) {
					return false;  // Remove
				}

				return true;  // Keep
			});

			// Remove property names matching a patternProperties pattern
			util.iterate(this.schema.patternProperties, function (subSchema, patternString) {
				var pattern;

				pattern = new RegExp(patternString);
				propNames = propNames.filter(function (propName) {
					if (propName.match(pattern)) {
						return false;  // Remove
					}

					return true;  // Keep
				});
			});

			if (propNames.length === 0) {
				return true;
			}

			if (rule === false) {
				// No additional properties were allowed to exist
				failureCallback();
				return false;
			}

			valid = true;

			if (rule !== true) {
				// All properties left over must validate against a schema
				propNames.forEach(function (propName) {
					if (!rule.validate(data[propName])) {
						failureCallback(propName);
						valid = false;
					}
				});
			}

			return valid;
		},

		items: function (rule, data, dataType, failureCallback) {
			var valid;

			if (dataType !== 'array') {
				return true;
			}

			valid = true;

			if (!Array.isArray(rule)) {
				// All items in the array must match the schema
				data.forEach(function (item, offset) {
					if (!rule.validate(item)) {
						failureCallback(offset);
						valid = false;
					}
				});
				return valid;
			}

			// Tuple typing - a positional validation
			rule.forEach(function (subSchema, offset) {
				if (!subSchema.validate(data[offset])) {
					failureCallback(offset);
					valid = false;
				}
			});

			return valid;
		},

		additionalItems: function (rule, data, dataType, failureCallback) {
			var myself, valid;

			if (dataType !== 'array' || !Array.isArray(this.schema.items)) {
				return true;
			}

			myself = this;
			valid = true;
			data.forEach(function (value, key) {
				// Ignore data validated by 'items' rule
				if (key >= myself.schema.items.length) {
					if (!rule.validate(value)) {
						failureCallback(key);
						valid = false;
					}
				}
			});
			return valid;
		},

		required: function (rule, data, dataType, failureCallback) {
			if (rule && dataType === 'undefined') {
				failureCallback();
				return false;
			}

			return true;
		},

		dependencies: function (rule, data, dataType, failureCallback) {
			var myself, valid;

			if (dataType !== 'object') {
				return true;
			}

			myself = this;
			valid = true;

			util.iterate(rule, function (propValue, propName) {
				// Determine if we can skip this dependency
				if (data[propName] === undefined) {
					return;
				}

				// Simple dependency - if A is specified, B must exist
				if (typeof propValue === 'string') {
					if (data[propValue] === undefined) {
						failureCallback(propName);
						valid = false;
					}

					return;
				}

				// Schema dependency - if A is specified, the data must
				// validate against this additional schema
				if (!propValue.validate(data)) {
					failureCallback(propName);
					valid = false;
				}
			});

			return valid;
		},

		minimum: function (rule, data, dataType, failureCallback) {
			if (dataType !== 'number' && dataType !== 'integer') {
				return true;
			}

			if (rule === null) {
				return true;
			}

			if (this.schema.exclusiveMinimum) {
				if (data <= rule) {
					failureCallback();
					return false;
				}
			} else {
				if (data < rule) {
					failureCallback();
					return false;
				}
			}

			return true;
		},

		maximum: function (rule, data, dataType, failureCallback) {
			if (dataType !== 'number' && dataType !== 'integer') {
				return true;
			}

			if (rule === null) {
				return true;
			}

			if (this.schema.exclusiveMaximum) {
				if (data >= rule) {
					failureCallback();
					return false;
				}
			} else {
				if (data > rule) {
					failureCallback();
					return false;
				}
			}

			return true;
		},

		minItems: function (rule, data, dataType, failureCallback) {
			if (dataType !== 'array' || rule === null) {
				return true;
			}

			if (data.length < rule) {
				failureCallback();
				return false;
			}

			return true;
		},

		maxItems: function (rule, data, dataType, failureCallback) {
			if (dataType !== 'array' || rule === null) {
				return true;
			}

			if (data.length > rule) {
				failureCallback();
				return false;
			}

			return true;
		},

		uniqueItems: function (rule, data, dataType, failureCallback) {
			var myself, unique, valid;

			if (dataType !== 'array') {
				return true;
			}

			myself = this;
			unique = [];
			valid = true;

			valid = data.every(function (item, offset) {
				if (!unique.some(function (uniqueItem) {
						return myself.compare(item, uniqueItem);
					})) {
					unique.push(item);
					return true;
				}

				failureCallback(offset);
				return false;
			});

			return valid;
		},

		pattern: function (rule, data, dataType, failureCallback) {
			var pattern;

			if (dataType !== 'string' || rule === null) {
				return true;
			}

			pattern = new RegExp(rule);

			if (!data.match(pattern)) {
				failureCallback();
				return false;
			}

			return true;
		},

		minLength: function (rule, data, dataType, failureCallback) {
			if (dataType !== 'string' || rule === null) {
				return true;
			}

			if (data.length < rule) {
				failureCallback();
				return false;
			}

			return true;
		},

		maxLength: function (rule, data, dataType, failureCallback) {
			if (dataType !== 'string' || rule === null) {
				return true;
			}

			if (data.length > rule) {
				failureCallback();
				return false;
			}

			return true;
		},

		'enum': function (rule, data, dataType, failureCallback) {
			var myself;

			if (dataType === 'undefined') {
				// This is handled by 'required'
				return true;
			}

			if (rule === null) {
				// No rule to validate against
				return true;
			}

			myself = this;

			if (rule.some(function (enumValue) {
					if (myself.compare(enumValue, data)) {
						return true;
					}

					return false;
				})) {
				return true;
			}

			failureCallback();
			return false;
		},

		'divisibleBy': function (rule, data, dataType, failureCallback) {
			if (dataType !== 'integer' && dataType !== 'number') {
				return true;
			}

			if (rule === null) {
				return true;
			}

			if (data / rule === 0) {
				return true;
			}

			failureCallback();
			return false;
		},

		/**
		 * Same idea as 'type', but the logic is reversed.  If any schema
		 * or simple type matches, then this is invalid.
		 */
		disallow: function (rule, data, dataType, failureCallback) {
			if (dataType === 'undefined') {
				return true;
			}

			if (!rule) {
				// No rule, so no need to worry
				return true;
			}

			return rule.every(function (testType, offset) {
				var result;

				// Handle schema objects
				if (typeof testType === 'object') {
					result = testType.validate(data);

					if (result) {
						// Successful validation means this matched - force failure
						failureCallback(offset);
						return false;
					}

					return true;
				}

				// Handle basic types and "any"
				if (testType === "any" || testType === dataType) {
					// We shouldn't match "any"
					failureCallback(offset);
					return false;
				}

				return true;
			});
		},

		'extends': function (rule, data, dataType, failureCallback) {
			if (!rule) {
				// No schema, so don't validate
				return true;
			}

			if (!Array.isArray(rule)) {
				if (!rule.validate(data)) {
					// TODO:  Chain the failure callback into the call to validate()
					failureCallback();
					return false;
				}

				return true;
			}

			if (!rule.every(function (subSchema) {
					return subSchema.validate(data);
				})) {
				// TODO:  Chain the failure callback into the call to validate()
				failureCallback();
				return false;
			}

			return true;
		}
	};

	return Schema;
}));
