/**
 * Utility functions
 */
/*global define, YUI*/
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		if (typeof module === 'object' && module.exports) {
			module.exports = factory();
		} else {
			exports.hapierUtil = factory();
		}
	} else if (typeof define === 'function' && define.amd) {
		define([], factory);
	} else if (typeof YUI === 'function') {
		YUI.add('hapierUtil', function (Y) {
			Y.hapierUtil = factory();
		});
	} else if (typeof root === 'object') {
		root.hapierUtil = factory();
	} else {
		throw "Unable to export hapierUtil";
	}
}(this, function () {
	'use strict';
	var util;
	util = {};


	/**
	 * Compare if two values are the same, as per JSON Schema.
	 *
	 * JSON Schema: core 3.6
	 *
	 * @param mixed a
	 * @param mixed b
	 * @return boolean True if they are the same
	 */
	util.areSame = function areSame(a, b) {
		var aKeys, aType, bKeys, bType, valid;

		aType = util.determineType(a);
		bType = util.determineType(b);

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
				if (!util.areSame(aValue, b[aKey])) {
					return false;
				}

				return true;
			});
			return valid;

		case 'object':
			aKeys = Object.keys(a).sort();
			bKeys = Object.keys(b).sort();

			if (!util.areSame(aKeys, bKeys)) {
				return false;
			}

			valid = aKeys.every(function (key) {
				if (!util.areSame(a[key], b[key])) {
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
	 * Gets the effective type of the data passed in.  When multiple choices
	 * are possible, this returns the more restrictive type defined in
	 * JSON Schema.
	 *
	 * JSON Schema: core 3.5
	 *
	 * @param mixed data
	 * @return string type
	 */
	util.determineType = function determineType(data) {
		switch (typeof data) {
		case 'boolean':
			return 'boolean';

		case 'number':
			if (Math.round(data) === data) {
				return 'integer';
			}

			return 'number';

		case 'object':
			if (data === null) {
				return 'null';
			}

			if (Array.isArray(data)) {
				return 'array';
			}

			return 'object';

		case 'string':
			return 'string';

		case 'undefined':
			return 'undefined';
		}

		// This should never happen
		return 'unknown';
	};


	/**
	 * Returns true if the given string is one of the primitive types.
	 *
	 * @param string type
	 * @return boolean
	 */
	util.isPrimitive = function isPrimitive(type) {
		switch (type) {
		case 'array':
		case 'boolean':
		case 'integer':
		case 'number':
		case 'null':
		case 'object':
		case 'string':
			return true;
		}

		return false;
	};


	/**
	 * Uniquely add more things to a target array
	 *
	 * @param Array targetArray The array that should grow
	 * @param Array moreArray Additional values
	 */
	util.uniqueArrayAdd = function uniqueArrayAdd(target, more) {
		more.forEach(function (moreVal) {
			if (moreVal !== undefined && !target.some(function (targetVal) {
					if (util.areSame(moreVal, targetVal)) {
						return true;
					}

					return false;
				})) {
				target.push(moreVal);
			}
		});
	};

	return util;
}));
