/**
 * JSON Schema object
 *
 * Create a schema object that can check validation, complete itself, etc.
 *
 * TODO:  Set 'id'
 * TODO:  Handle $ref fully
 * TODO:  Possibly handle $schema
 */
'use strict';

var SimpleNotify, URI;

SimpleNotify = require('./simplenotify');
URI = require('./URI');

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
JSONSchema.prototype.callResolverMethod = function callResolverMethod(name, obj, propName, fetcher, notifier) {
	var method;

	method = this.resolverMapping[name];
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
JSONSchema.prototype.compare = function compare(a, b) {
	var aKeys, aType, bKeys, bType, myself, valid;

	aType = this.getType(a);
	bType = this.getType(b);
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
 * Gets the effective type of the data.
 *
 * @param mixed data
 * @return string type
 */
JSONSchema.prototype.getType = function getType(data) {
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
 * Determine if a type passed in (string only) is a simple type.
 *
 * @param string type
 * @return boolean True if this is a simple type
 */
JSONSchema.prototype.isSimpleType = function isSimpleType(type) {
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


JSONSchema.prototype.iterate = function iterate(object, callback, thisRef) {
	var propName;

	for (propName in object) {
		if (Object.prototype.hasOwnProperty.call(object, propName)) {
			callback.call(thisRef, object[propName], propName, object);
		}
	}
};


/**
 * Resolve an object, fetching additional resources as necessary.
 * The actual fetching is done by resolveSchema()
 *
 * @param Function fetcher (uri, callback)
 * @param Function whenDone (err)
 */
JSONSchema.prototype.resolve = function resolve(fetcher, whenDone) {
	var myself, uri;

	myself = this;

	function resolve_theRest() {
		var map, notifier, property;

		notifier = new SimpleNotify(function (err) {
			whenDone(err);
		});

		myself.iterate(JSONSchema.prototype.resolverMapping, function (func, propName) {
			myself.callResolverMethod(func, myself.schema, propName, fetcher, notifier);
		});
	}

	// Handle $ref first and it must complete before we tackle any other
	// properties
	if (this.schema.$ref) {
		// URI resolution
		uri = new URI(this.schema.$ref, this.schemaId);

		// Get the schema - this returns the correct JSON Schema object
		// by following the URL and the pointer
		fetcher(uri.toString(), function resolve_ref(err, data) {
			if (err) {
				whenDone(err);
				return;
			}

			this.schema = data;
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
JSONSchema.prototype.resolverMapping = {
	additionalItems: 'booleanOrSchema',
	additionalProperties: 'booleanOrSchema',
	'default': 'any',
	dependencies: 'typeOrSchema',
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
JSONSchema.prototype.resolverMethods = {
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

		this.schema.iterate(obj[property], function (propValue, propName) {
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
	 * Convert everything to an array for easier comparisons.
	 */
	type: function (obj, property, fetcher, notifier) {
		var myself;

		myself = this;

		if (!Array.isArray(obj[property])) {
			obj[property] = [ obj[property] ];
		}

		if (!obj[property].length) {
			obj[property] = [ 'any' ];
			return;
		}

		obj[property].forEach(function (value, key) {
			myself.callResolverMethod('typeOrSchema', obj[key], key, fetcher, notifier);
		});
	},

	/**
	 * This should be either a single simple type or schema.  If not known,
	 * this defaults to 'any'
	 */
	typeOrSchema: function (obj, property, fetcher, notifier) {
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
JSONSchema.prototype.resolveSchema = function resolveSchema(parentObj, key, fetcher, whenDone) {
	var schema = new JSONSchema(parentObj[key]);
	parentObj[key] = schema;
	schema.resolve(fetcher, whenDone);
};


/**
 * Validate that data matches this schema
 *
 * @param function failureCallback (path, code, message)
 * @param string path Current path to this object
 * @return boolean
 */
JSONSchema.prototype.validate = function validate(data, failureCallback, path) {
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
	dataType = this.getType(data);
	myself = this;
	errors = 0;

	this.iterate(this.validateMethods, function (func, propName) {
		if (!func(myself.schema[propName], data, dataType)) {
			// TODO: On failure, call failureCallback, maybe pass in path
			// TODO:  Maybe stop immediately
			errors += 1;
		}
	});

	return errors === 0;
};


/**
 * Validation methods for every rule
 */
JSONSchema.prototype.validateMethods = {
	/**
	 * Must match one of the simple types or validate against a schema.
	 * This also allows undefined to pass and the 'required' attribute
	 * should be the one enforcing if a value is present.
	 */
	type: function (rule, data, dataType) {
		if (dataType === 'undefined') {
			return true;
		}

		return rule.some(function (testType) {
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
	},

	/**
	 * The properties listed must match against the matching schema
	 */
	properties: function (rule, data, dataType) {
		var valid;

		if (dataType !== 'object') {
			return true;
		}

		valid = true;
		this.iterate(rule, function (subSchema, propName) {
			if (!subSchema.validate(data[propName])) {
				valid = false;
			}
		});

		return valid;
	},

	/**
	 * Match a schema against multiple properties whose name matches a
	 * pattern.
	 */
	patternProperties: function (rule, data, dataType) {
		var myself, valid;

		if (dataType !== 'object') {
			return true;
		}

		myself = this;
		valid = true;

		this.iterate(rule, function (subSchema, propPatternString) {
			var propPattern;

			propPattern = new RegExp(propPatternString);
			myself.iterate(data, function (dataValue, dataProperty) {
				if (dataProperty.match(propPattern)) {
					if (!subSchema.validate(dataValue)) {
						valid = false;
					}
				}
			});
		});

		return valid;
	},

	additionalProperties: function (rule, data, dataType) {
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
		this.iterate(this.schema.patternProperties, function (subSchema, patternString) {
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
			return false;
		}

		valid = true;

		if (rule !== true) {
			// All properties left over must validate against a schema
			propNames.forEach(function (propName) {
				if (!rule.validate(data[propName])) {
					valid = false;
				}
			});
		}

		return valid;
	},

	items: function (rule, data, dataType) {
		var valid;

		if (dataType !== 'array') {
			return true;
		}

		valid = true;

		if (!Array.isArray(rule)) {
			// All items in the array must match the schema
			data.forEach(function (item) {
				if (!rule.validate(item)) {
					valid = false;
				}
			});
			return valid;
		}

		// Tuple typing - a positional validation
		rule.forEach(function (subSchema, offset) {
			if (!subSchema.validate(data[offset])) {
				valid = false;
			}
		});

		return valid;
	},

	additionalItems: function (rule, data, dataType) {
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
					valid = false;
				}
			}
		});
		return valid;
	},

	required: function (rule, data, dataType) {
		if (rule && dataType === 'undefined') {
			return false;
		}

		return true;
	},

	dependencies: function (rule, data, dataType) {
		var myself, valid;

		if (dataType !== 'object') {
			return true;
		}

		myself = this;
		valid = true;

		this.iterate(rule, function (propValue, propName) {
			// Determine if we can skip this dependency
			if (data[propName] === undefined) {
				return;
			}

			// Simple dependency - if A is specified, B must exist
			if (typeof propValue === 'string') {
				if (data[propValue] === undefined) {
					valid = false;
				}

				return;
			}

			// Schema dependency - if A is specified, the data must
			// validate against this additional schema
			if (!propValue.validate(data)) {
				valid = false;
			}
		});

		return valid;
	},

	minimum: function (rule, data, dataType) {
		if (dataType !== 'number' && dataType !== 'integer') {
			return true;
		}

		if (rule === null) {
			return true;
		}

		if (this.schema.exclusiveMinimum) {
			if (data <= rule) {
				return false;
			}
		} else {
			if (data < rule) {
				return false;
			}
		}

		return true;
	},

	maximum: function (rule, data, dataType) {
		if (dataType !== 'number' && dataType !== 'integer') {
			return true;
		}

		if (rule === null) {
			return true;
		}

		if (this.schema.exclusiveMaximum) {
			if (data >= rule) {
				return false;
			}
		} else {
			if (data > rule) {
				return false;
			}
		}

		return true;
	},

	minItems: function (rule, data, dataType) {
		if (dataType !== 'array' || rule === null) {
			return true;
		}

		if (data.length < rule) {
			return false;
		}

		return true;
	},

	maxItems: function (rule, data, dataType) {
		if (dataType !== 'array' || rule === null) {
			return true;
		}

		if (data.length > rule) {
			return false;
		}

		return true;
	},

	uniqueItems: function (rule, data, dataType) {
		var myself, unique, valid;

		if (dataType !== 'array') {
			return true;
		}

		myself = this;
		unique = [];
		valid = true;

		valid = data.every(function (item) {
			if (!unique.some(function (uniqueItem) {
					return myself.compare(item, uniqueItem);
				})) {
				unique.push(item);
				return true;
			}

			return false;
		});

		return valid;
	},

	pattern: function (rule, data, dataType) {
		var pattern;

		if (dataType !== 'string' || rule === null) {
			return true;
		}

		pattern = new RegExp(rule);

		if (!data.match(pattern)) {
			return false;
		}

		return true;
	},

	minLength: function (rule, data, dataType) {
		if (dataType !== 'string' || rule === null) {
			return true;
		}

		if (data.length < rule) {
			return false;
		}

		return true;
	},

	maxLength: function (rule, data, dataType) {
		if (dataType !== 'string' || rule === null) {
			return true;
		}

		if (data.length > rule) {
			return false;
		}

		return true;
	},

	'enum': function (rule, data, dataType) {
		var myself;

		if (dataType === 'undefined') {
			// This is handled by 'required'
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

		return false;
	},

	'divisibleBy': function (rule, data, dataType) {
		if (dataType !== 'integer' && dataType !== 'number') {
			return true;
		}

		if (rule === null) {
			return true;
		}

		if (data / rule === 0) {
			return true;
		}

		return false;
	},

	/**
	 * Same idea as 'type', but the logic is reversed.  If any schema
	 * or simple type matches, then this is invalid.
	 */
	disallow: function (rule, data, dataType) {
		if (dataType === 'undefined') {
			return true;
		}

		return rule.every(function (testType) {
			// Handle schema objects
			if (typeof testType === 'object') {
				return !testType.validate(data);
			}

			// Handle basic types and "any"
			if (testType === "any" || testType === dataType) {
				return false;
			}

			return true;
		});
	},

	'extends': function (rule, data, dataType) {
		if (!Array.isArray(rule)) {
			return rule.validate(data);
		}

		return rule.every(function (subSchema) {
			return subSchema.validate(data);
		});
	}
};

module.exports = JSONSchema;
