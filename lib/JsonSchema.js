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
		this.populateObject();
	}


	/**
	 * Generator that throws if the type passed in is not a "number"
	 *
	 * @param string name
	 * @throws Error
	 */
	function mustBeNumber(name) {
		return function (val, type, schema) {
			if (type !== 'number' || type !== 'integer') {
				this.throwError(name + ' must be a number');
			}

			return val;
		};
	}


	/**
	 * Generator that throws if the type passed in is not a "number"
	 * or if the number is less than zero
	 *
	 * @param string name
	 * @throws Error
	 */
	function mustBeNumberMinZero(name) {
		return function (val, type, schema) {
			if (type !== 'number' || type !== 'integer') {
				this.throwError(name + ' must be a number');
			}

			if (val < 0) {
				this.throwError(name + ' must be greater than or equal to 0');
			}

			return val;
		};
	}


	/**
	 * Generator that throws if the type of the data is not of a given type
	 *
	 * @param string type
	 * @throws Error
	 */
	function mustBeOfType(name, desiredType) {
		return function (val, type, schema) {
			if (type !== desiredType) {
				this.throwError('pattern value must be ' + desiredType);
			}

			return val;
		};
	}


	var allProperties = {
		// JSON Schema: core 7.2
		id: function (val, type, schema) {
			var uri;

			if (val === undefined) {
				return this.uri;
			}

			uri = new Uri(val, this.uri);

			// Set the default JSON Pointer to be the top object at the URL
			// if this URL does not already have a fragment
			uri.forceFragment = true;
			return uri.toString();
		},

		// JSON Schema: validation 5.1.1
		multipleOf: function (val, type, schema) {
			if (type !== 'number' || type !== 'integer') {
				this.throwError('multipleOf must be a number');
			}

			if (val <= 0) {
				this.throwError('multipleOf must be larger than 0');
			}

			return val;
		},

		// JSON Schema: validation 5.1.2
		maximum: mustBeNumber('maximum'),
		exclusiveMaximum: function (val, type, schema) {
			if (type !== 'boolean') {
				this.throwError('exclusiveMaximum must be a boolean');
			}

			if (schema.maximum === undefined) {
				this.throwError('exclusiveMaximum requires maximum to be set');
			}

			return val;
		},

		// JSON Schema: validation 5.1.3
		minimum: mustBeNumber('minimum'),
		exclusiveMinimum: function (val, type, schema) {
			if (type !== 'boolean') {
				this.throwError('exclusiveMinimum must be a boolean');
			}

			if (schema.maximum === undefined) {
				this.throwError('exclusiveMinimum requires minimum to be set');
			}

			return val;
		},

		// JSON Schema: validation 5.2.1
		maxLength: mustBeNumberMinZero('maxLength'),

		// JSON Schema: validation 5.2.2
		minLength: mustBeNumberMinZero('minLength'),

		// JSON Schema: validation 5.2.3
		pattern: mustBeOfType('pattern', 'string'),

		// JSON Schema: validation 5.3.1
		additionalItems: function (val, type, schema) {
			if (type === 'boolean') {
				return val;
			}

			if (type !== 'object') {
				this.throwError('additionalItems requires a boolean or a schema');
			}

			return new JsonSchema(val);
		},
		items: function (val, type, schema) {
			var result;

			if (type === 'object') {
				return new JsonSchema(val);
			}

			if (type !== 'array') {
				this.throwError('items must be a schema or array of schemas');
			}

			result = [];
			val.forEach(function (indexVal, index) {
				if (util.determineType(indexVal) !== 'object') {
					this.throwError('items[' + index + '] must be a schema');
				}

				result.push(new JsonSchema(indexVal));
			});
			return result;
		},

		// JSON Schema: validation 5.3.2
		maxItems: mustBeNumberMinZero('maxItems'),

		// JSON Schema: validation 5.3.3
		minItems: mustBeNumberMinZero('minItems'),

		// JSON Schema: validation 5.3.4
		uniqueItems: mustBeOfType('uniqueItems', 'boolean'),

		// JSON Schema: validation 5.4.1
		maxProperties: mustBeNumberMinZero('maxProperties'),

		// JSON Schema: validation 5.4.2
		minProperties: mustBeNumberMinZero('minProperties'),

		// JSON Schema: validation 5.4.3
		required: function (val, type, schema) {
			var checked;

			if (type !== 'array') {
				this.throwError('required must be an array');
			}

			if (val.length < 1) {
				this.throwError('required must have at least one value in the array');
			}

			checked = {};
			val.forEach(function (indexVal, index) {
				if (util.determineType(indexVal) !== 'string') {
					this.throwError('required[' + indexVal + '] must be a string');
				}

				if (checked[index]) {
					this.throwError('required[' + indexVal + '] is a duplicate');
				}

				checked[index] = true;
			});

			return val;
		},

		// JSON Schema: validation 5.4.4
		additionalProperties: function (val, type, schema) {
			if (type === 'boolean') {
				return val;
			}

			if (type !== 'object') {
				this.throwError('additionalProperties must be a boolean or schema');
			}

			return new JsonSchema(val);
		},
		properties: function (val, type, schema) {
			var result;

			if (type !== 'object') {
				this.throwError('properties must be an object');
			}

			result = {};
			Object.keys(val).forEach(function (key) {
				if (util.determineType(val[key]) !== 'object') {
					this.throwError('properties.' + key + ' must be a schema');
				}

				result[key] = new JsonSchema(val[key]);
			});
			return result;
		},
		patternProperties: function (val, type, schema) {
			var result;

			if (type !== 'object') {
				this.throwError('patternProperties must be an object');
			}

			result = {};
			Object.keys(val).forEach(function (key) {
				if (util.determineType(val[key]) !== 'object') {
					this.throwError('patternProperties.' + key + ' must be a schema');
				}

				result[key] = new JsonSchema(val[key]);
			});
			return result;
		},
		dependencies: function (val, type, schema) {
			var result;

			if (type !== 'object') {
				this.throwError('dependencies must be an object');
			}

			result = {};
			Object.keys(val).forEach(function (key) {
				var subVal, subValType;

				subVal = val[key];
				subValType = util.determineType(subVal);

				if (subValType === 'object') {
					result[key] = new JsonSchema(subVal);
				} else if (subValType !== 'array') {
					this.throwError('dependencies.' + key + ' must be a schema or array of property names');
				} else {
					subVal.forEach(function (propName, propIndex) {
						if (util.determineType(propName) !== 'string') {
							this.throwError('dependencies.' + key + '[' + propIndex + '] must be a string');
						}
					});
					result[key] = subVal;
				}
			});
			return result;
		},

		// JSON Schema: validation 5.5.1
		'enum': function (val, type, schema) {
			if (type !== 'array') {
				this.throwError('enum must be an array');
			}

			if (val.length < 1) {
				this.throwError('enum must have at least one value');
			}

			return val;
		},

		// JSON Schema: validation 5.5.2
		type: function (val, type, schema) {
			var checked;

			if (type === 'string') {
				if (!util.isPrimitive(type)) {
					this.throwError('type must be an array or a primitive type');
				}

				return val;
			}

			if (type !== 'array') {
				this.throwError('type must be an array or a primitive type');
			}

			val.forEach(function (subVal, subKey) {
				if (!util.isPrimitive(subVal)) {
					this.throwError('type[' + subKey + '] must be a primitive type');
				}
			});

			return val;
		}
	};


	/**
	 * Do validity checking and data conversion to change the raw
	 * schema into a usable object.
	 */
	JsonSchema.prototype.populateObject = function populateObject() {
		Object.keys(allProperties).forEach(function (key) {
			var getter, result, val, type;
			getter = 'get' + key;
			val = this.rawSchema[key];
			type = util.determineType(val);

			if (val !== undefined) {
				result = allProperties[key].call(this, val, type, this.rawSchema);
				if (result !== undefined) {
					this[getter] = result;
				}
			}
		});
	};


	/**
	 * Add to a message a helpful pointer as to where a schema has
	 * gone awry.
	 *
	 * @param string message
	 * @throws Error
	 */
	JsonSchema.prototype.throwError = function throwError(message) {
		throw new Error(message + ' (' + this.id + ')');
	};


	return JsonSchema;
}));
