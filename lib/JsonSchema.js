/**
 * JSON Schema object
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
		this.parentSchema = parentSchema;  // Only used for debugging
		this.populateObject();
		this.childSchemas = [];
	}


	/**
	 * Generator that throws if the type passed in is not a "number"
	 *
	 * @param string name
	 * @return function
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
	 * @return function
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
	 * @param string name
	 * @return function
	 */
	function mustBeOfType(name, desiredType) {
		return function (val, type, schema) {
			if (type !== desiredType) {
				this.throwError(name + ' value must be ' + desiredType);
			}

			return val;
		};
	}


	/**
	 * Generator that assures the value is an array composed entirely
	 * of schemas with at least one schema to match.
	 *
	 * @param string name
	 * @return function
	 */
	function mustBeArrayOfSchemas(name) {
		return function (val, type, schema) {
			var result, myself;

			if (type !== 'array') {
				this.throwError(name + ' must be an array of schemas');
			}

			if (val.length < 1) {
				this.throwError(name + ' must have at least one schema');
			}

			result = [];
			myself = this;
			val.forEach(function (subVal, subKey) {
				if (util.determineType(subVal) !== 'object') {
					myself.throwError(name + '[' + subKey + '] must be a schema');
				}

				result[subKey] = myself.makeChild(subVal);
			});
			return result;
		};
	}


	JsonSchema.prototype.allProperties = {
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
		pattern: function (val, type, schema) {
			if (type !== 'string') {
				this.throwError('pattern value must be string');
			}

			return new RegExp(val);
		},

		// JSON Schema: validation 5.3.1
		additionalItems: function (val, type, schema) {
			if (type === 'boolean') {
				return val;
			}

			if (type !== 'object') {
				this.throwError('additionalItems requires a boolean or a schema');
			}

			return this.makeChild(val);
		},
		items: function (val, type, schema) {
			var result, myself;

			if (type === 'object') {
				return this.makeChild(val);
			}

			if (type !== 'array') {
				this.throwError('items must be a schema or array of schemas');
			}

			result = [];
			myself = this;
			val.forEach(function (subVal, subKey) {
				if (util.determineType(subVal) !== 'object') {
					myself.throwError('items[' + subKey + '] must be a schema');
				}

				result[subKey] = myself.makeChild(subVal);
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
			var checked, myself;

			if (type !== 'array') {
				this.throwError('required must be an array');
			}

			if (val.length < 1) {
				this.throwError('required must have at least one value in the array');
			}

			checked = {};
			myself = this;
			val.forEach(function (indexVal, index) {
				if (util.determineType(indexVal) !== 'string') {
					myself.throwError('required[' + indexVal + '] must be a string');
				}

				if (checked[index]) {
					myself.throwError('required[' + indexVal + '] is a duplicate');
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

			return this.makeChild(val);
		},
		properties: function (val, type, schema) {
			var result, myself;

			if (type !== 'object') {
				this.throwError('properties must be an object');
			}

			result = {};
			myself = this;
			Object.keys(val).forEach(function (key) {
				if (util.determineType(val[key]) !== 'object') {
					myself.throwError('properties.' + key + ' must be a schema');
				}

				result[key] = myself.makeChild(val[key]);
			});
			return result;
		},
		patternProperties: function (val, type, schema) {
			var result, myself;

			if (type !== 'object') {
				this.throwError('patternProperties must be an object');
			}

			result = {};
			myself = this;
			Object.keys(val).forEach(function (key) {
				if (util.determineType(val[key]) !== 'object') {
					myself.throwError('patternProperties.' + key + ' must be a schema');
				}

				result[key] = {
					regexp: new RegExp(key),
					schema: myself.makeChild(val[key])
				};
			});
			return result;
		},
		dependencies: function (val, type, schema) {
			var result, myself;

			if (type !== 'object') {
				this.throwError('dependencies must be an object');
			}

			result = {};
			myself = this;
			Object.keys(val).forEach(function (key) {
				var subVal, subValType;

				subVal = val[key];
				subValType = util.determineType(subVal);

				if (subValType === 'object') {
					result[key] = myself.makeChild(subVal);
				} else if (subValType !== 'array') {
					myself.throwError('dependencies.' + key + ' must be a schema or array of property names');
				} else {
					subVal.forEach(function (propName, propIndex) {
						if (util.determineType(propName) !== 'string') {
							myself.throwError('dependencies.' + key + '[' + propIndex + '] must be a string');
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
			var myself;

			if (type === 'string') {
				if (!util.isPrimitive(type)) {
					this.throwError('type must be an array or a primitive type');
				}

				return val;
			}

			if (type !== 'array') {
				this.throwError('type must be an array or a primitive type');
			}

			myself = this;
			val.forEach(function (subVal, subKey) {
				if (!util.isPrimitive(subVal)) {
					myself.throwError('type[' + subKey + '] must be a primitive type');
				}
			});

			return val;
		},

		// JSON Schema: validation 5.5.3
		allOf: mustBeArrayOfSchemas('allOf'),

		// JSON Schema: validation 5.5.4
		anyOf: mustBeArrayOfSchemas('anyOf'),

		// JSON Schema: validation 5.5.5
		oneOf: mustBeArrayOfSchemas('oneOf'),

		// JSON Schema: validation 5.5.6
		not: function (val, type, schema) {
			if (type !== 'object') {
				this.throwError('not must be a schema');
			}

			return this.makeChild(val);
		},

		// JSON Schema: validation 5.5.7
		definitions: function (val, type, schema) {
			var result, myself;

			if (type !== 'object') {
				this.throwError('definitions must be an object of schemas');
			}

			result = {};
			myself = this;
			Object.keys(val).forEach(function (key) {
				if (util.determineType(val[key]) !== 'object') {
					myself.throwError('definitions.' + key + ' must be a schema');
				}

				result[key] = myself.makeChild(val[key]);
			});
			return result;
		},

		// JSON Schema: validation 6.1
		title: mustBeOfType('title', 'string'),
		description: mustBeOfType('description', 'string'),

		// JSON Schema: validation 6.2
		'default': function (val, type, schema) {
			return val;
		},

		// JSON Schema: validation 7.2
		format: function (val, type, schema) {
			if (type !== 'string') {
				this.throwError('format must be a string');
			}

			switch (val) {
			case 'date-time':
			case 'email':
			case 'hostname':
			case 'ipv4':
			case 'ipv6':
			case 'uri':
				return val;
			}

			this.throwError('format is unrecognized');
		}
	};


	/**
	 * Useful tie-in for debugging.  Override this method when you
	 * want to debug things
	 *
	 * @param string message
	 */
	JsonSchema.prototype.debug = function (message) {
		// console.log('JsonSchema ' + this.id + ': ' + message);
	};


	/**
	 * Make a child schema
	 *
	 * @param object data
	 * @return JsonSchema
	 */
	JsonSchema.prototype.makeChild = function makeChild(data) {
		var child;
		child = new JsonSchema(data);
		this.childSchemas.push(child);
		return child;
	};


	/**
	 * Handle setting the 'id' property
	 *
	 * JSON Schema: core 7.2
	 */
	JsonSchema.prototype.populateId = function populateId() {
		var uri;

		if (this.rawSchema.id === undefined) {
			this.id = this.uri;
			this.debug('populateId auto = ' + this.id);
			return;
		}

		uri = new Uri(this.rawSchema.id, this.uri);

		// Set the default JSON Pointer to be the top object at the URL
		// if this URL does not already have a fragment
		uri.forceFragment = true;
		this.id = uri.toString();
		this.debug('populateId ' + this.rawSchema.id + ' = ' + this.id);
	};


	/**
	 * Do validity checking and data conversion to change the raw
	 * schema into a usable object.
	 */
	JsonSchema.prototype.populateObject = function populateObject() {
		var myself;

		myself = this;
		this.debug('populateObject');
		this.populateId();
		this.populateRef();

		// JSON Reference: 3
		// Any members other than $ref in a JSON Reference object 
		// shall be ignored
		if (!this.$ref) {
			this.debug('validating all properties');
			Object.keys(this.allProperties).forEach(function (key) {
				var getter, result, val, type;
				getter = 'get' + key;
				val = myself.rawSchema[key];
				type = util.determineType(val);

				if (val !== undefined) {
					myself.debug('validate ' + key);
					result = myself.allProperties[key].call(myself, val, type, myself.rawSchema);
					if (result !== undefined) {
						myself.debug('validation success');
						myself[getter] = result;
					} else {
						myself.debug('validation returned nothing');
					}
				} else {
					myself.debug('validate ' + key + ': not set');
				}
			});
		}
	};


	/**
	 * Set the $ref property if there is a valid reference
	 *
	 * JSON Reference: 3
	 */
	JsonSchema.prototype.populateRef = function populateRef() {
		if (!this.rawSchema.$ref) {
			this.debug('populateRef none');
			return;
		}

		if (util.determineType(this.rawSchema.$ref) !== 'string') {
			// If it is not a string, then it should not be
			// interpreted as a JSON Reference
			this.debug('populateRef non-string');
			return;
		}

		this.$ref = this.rawSchema.$ref;
		this.debug('populateRef ' + this.$ref);
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
