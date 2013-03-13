/**
 * JSON Schema validation object
 *
 * Validation of data is the goal.  You use the validator like so:
 *
 *    schema = new JsonSchema(...data...);
 *    validator = new JsonSchemaValidator(schema);
 *    if (!validator.validateData(...instanceData...)) {
 *        throw new Error('sorry, it did not validate');
 *    }
 *
 * The validateData() method also takes an optional callback that will be
 * passed information about each error encountered.
 *
 * TODO:  Write up more
 */
/*global define, YUI*/
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		if (typeof module === 'object' && module.exports) {
			module.exports = factory(require('./hapierUtil'), require('./JsonSchema'));
		} else {
			exports.JsonSchemaValidator = factory(require('./hapierUtil'), require('./JsonSchema'));
		}
	} else if (typeof define === 'function' && define.amd) {
		define(['hapierUtil', 'JsonSchema'], factory);
	} else if (typeof YUI === 'function') {
		YUI.add('JsonSchemaValidator', function (Y) {
			Y.JsonSchemaValidator = factory(Y.hapierUtil, Y.JsonSchema);
		}, '', {
			requires: ['hapierUtil', 'JsonSchema']
		});
	} else if (typeof root === 'object') {
		root.JsonSchemaValidator = factory(root.hapierUtil, root.JsonSchema);
	} else {
		throw "Unable to export JsonSchemaValidator";
	}
}(this, function (util, JsonSchema) {
	'use strict';

	function JsonSchemaValidator(schema) {
		this.schema = schema;

		if (!(schema instanceof JsonSchema)) {
			throw new Error('JsonSchemaValidator.validate() requires a JsonSchema object');
		}
	}

	/**
	 * Validate data given a schema
	 *
	 * Calls the callback for every error that's detected that is somewhat
	 * sane.  More information in the header of this file.
	 *
	 * @param mixed data Json data instance
	 * @param boolean reportAllErrors Optional, if false/unset will quit early
	 * @param function errorCallback Optional error callback
	 * @return boolean True if the data succeeded
	 */
	JsonSchemaValidator.prototype.validateData = function (data, reportAllErrors, errorCallback) {
		var failures, myself, type;

		if (errorCallback === undefined && typeof reportAllErrors === 'function') {
			errorCallback = reportAllErrors;
			reportAllErrors = false;
		}

		myself = this;
		failures = 0;
		type = util.determineType(data);

		Object.keys(this.validations).forEach(function (key) {
			var result, validator;

			if (!failures || reportAllErrors) {
				validator = myself.validations[key];
				result = validator.call(this, data, type);

				if (result) {
					// FIXME - what to pass?
					errorCallback(result + ' (' + this.schema.id + ')');
					failures += 1;
				}
			}
		});

		if (failures) {
			return false;
		}

		return true;
	};


	/**
	 * JSON Schema validators are executed in order presented here
	 */
	JsonSchemaValidator.prototype.validators = {
		// JSON Schema: validation 5.1.1
		multipleOf: function multipleOf(data, type) {
			var howManyTimes;

			if (type !== 'number' && type !== 'integer') {
				return false;
			}

			if (this.multipleOf === undefined) {
				return false;
			}

			howManyTimes = data / this.multipleOf;

			if (Math.round(howManyTimes) !== howManyTimes) {
				return true;  // FIXME - what to return?
			}
		},

		// JSON Schema: validation 5.1.2
		maximum: function maximum(data, type) {
			if (type !== 'number' && type !== 'integer') {
				return false;
			}

			if (this.maximum === undefined) {
				return false;
			}

			if (this.exclusiveMaximum) {
				if (data >= this.maximum) {
					return true;  // FIXME - what to return?
				}
			} else {
				if (data > this.maximum) {
					return true;  // FIXME - what to return?
				}
			}
		},

		// JSON Schema: validation 5.1.3
		minimum: function minimum(data, type) {
			if (type !== 'number' && type !== 'integer') {
				return;
			}

			if (this.minimum === undefined) {
				return;
			}

			if (this.exclusiveMinimum) {
				if (data <= this.minimum) {
					return true;  // FIXME - what to return?
				}
			} else {
				if (data < this.minimum) {
					return true;  // FIXME - what to return?
				}
			}
		},

		// JSON Schema: validation 5.2.1
		maxLength: function maxLength(data, type) {
			if (type !== 'string' || this.maxLength === undefined) {
				return;
			}

			if (data.length > this.maxLength) {
				return true;  // FIXME - what to return?
			}
		},

		// JSON Schema: validation 5.2.2
		minLength: function minLength(data, type) {
			if (type !== 'string' || this.minLength === undefined) {
				return;
			}

			if (data.length > this.minLength) {
				return true;  // FIXME - what to return?
			}
		},

		// JSON Schema: validation 5.2.3
		pattern: function pattern(data, type) {
			if (type !== 'string' || this.pattern === undefined) {
				return;
			}

			if (!this.pattern.test(data)) {
				return true;  // FIXME - what to return?
			}
		},

		// JSON Schema: validation 5.3.1
		items: function items(data, type) {
			if (type !== 'array' || this.items === undefined) {
				return;
			}

			if (!Array.isArray(this.items)) {
				return;
			}

			if (this.additionalItems === undefined) {
				return;
			}

			if (typeof this.additionalItems === 'boolean' && this.additionalItems) {
				return;
			}

			if (data.length > this.items.length) {
				return true;  // FIXME - what to return?
			}

			// child validation is done later
		},

		// JSON Schema: validation 5.3.2
		maxItems: function maxItems(data, type) {
			if (type !== 'array' || this.maxItems === undefined) {
				return;
			}

			if (data.length > this.maxItems) {
				return true;  // FIXME - what to return?
			}
		},

		// JSON Schema: validation 5.3.3
		minItems: function minItems(data, type) {
			if (type !== 'array' || this.minItems === undefined) {
				return;
			}

			if (data.length > this.minItems) {
				return true;  // FIXME - what to return?
			}
		},

		// JSON Schema: validation 5.3.4
		uniqueItems: function uniqueItems(data, type) {
			var i, j;

			if (type !== 'array' || !this.uniqueItems) {
				return;
			}

			for (i = 0; i < data.length; i += 1) {
				for (j = i + 1; j < data.length; j += 1) {
					if (util.areSame(data[i], data[j])) {
						return true;  // FIXME - what to return?
					}
				}
			}
		},

		// JSON Schema: validation 5.4.1
		maxProperties: function maxProperties(data, type) {
			if (type !== 'object' || this.maxProperties === undefined) {
				return;
			}

			if (Object.keys(data).length > this.maxProperties) {
				return true;  // FIXME - what to return?
			}
		},

		// JSON Schema: validation 5.4.2
		minProperties: function minProperties(data, type) {
			if (type !== 'object' || this.minProperties === undefined) {
				return;
			}

			if (Object.keys(data).length < this.minProperties) {
				return true;  // FIXME - what to return?
			}
		},

		// JSON Schema: validation 5.4.3
		required: function required(data, type) {
			var hasFailure;

			if (type !== 'object' || this.required === undefined) {
				return;
			}

			hasFailure = this.required.some(function (requiredProp) {
				if (!data.hasOwnProperty(requiredProp)) {
					return true;  // Signal to some()
				}

				return false;
			});

			if (hasFailure) {
				return true;  // FIXME - what to return?
			}
		},

		// JSON Schema: validation 5.4.4
		properties: function properties(data, type) {
			var names;

			if (type !== 'object') {
				return;
			}

			if (this.additionalProperties) {
				return;
			}

			names = Object.keys(data);

			if (this.properties) {
				// For every property name specified
				Object.keys(this.properties).forEach(function (propertyName) {
					// Filter it out of the names array
					names = names.filter(function (nameVal) {
						return nameVal !== propertyName;
					});
				});
			}

			if (this.patternProperties) {
				Object.keys(this.patternProperties).forEach(function (key) {
					var regexp;

					regexp = this.patternProperties[key].regexp;

					// Filter it out of the names array
					names = names.filter(function (nameVal) {
						return !regexp.test(nameVal);
					});
				});
			}

			if (names.length) {
				return true;  // FIXME - what to return?
			}

			// child validation is done later
		},

		// JSON Schema: validation 5.4.5
		dependencies: function dependencies(data, type) {
			var failures, myself;

			if (type !== 'object' || this.dependencies === undefined) {
				return;
			}

			failures = 0;
			myself = this;
			Object.keys(this.dependencies).forEach(function (dependencyOn) {
				var dependencyTo, validator;

				dependencyTo = myself.dependencies[dependencyOn];

				if (!data.hasOwnProperty(dependencyOn)) {
					return;
				}

				if (Array.isArray(dependencyTo)) {
					// Property dependency
					dependencyTo.forEach(function (mustHaveProperty) {
						if (!data.hasOwnProperty(mustHaveProperty)) {
							failures += 1;
							// FIXME - report back?
						}
					});
				} else {
					// Schema dependency
					validator = new JsonSchemaValidator(dependencyTo);
					if (!validator.validateData(data)) {
						failures += 1;
						// FIXME - report back?
					}
				}
			});

			if (failures) {
				return true;  // FIXME - what to return?
			}
		},
	};


	return JsonSchemaValidator;
}));
