'use strict';

var util;

util = {
	/**
	 * Clones an object.  Don't send a recursive object in here.
	 * Clones data only.
	 *
	 * @param mixed src
	 * @return mixed Copy of src
	 */
	clone: function clone(src) {
		var target, myself;

		if (Array.isArray(src)) {
			target = [];
			Array.prototype.forEach.call(src, function (val, key) {
				target[key] = val;
			});
		} else if (typeof src === 'object') {
			target = {};
			Object.keys(src).forEach(function (key) {
				target[key] = src[key];
			});
		} else {
			target = src;
		}

		return target;
	},

	/**
	 * Iterate across an object's properties, like Array.prototype.forEach
	 *
	 * @param object object
	 * @param Function callback (value, propertyName, object)
	 * @param object|null thisRef
	 */
	iterate: function iterate(object, callback, thisRef) {
		var propName;

		for (propName in object) {
			if (Object.prototype.hasOwnProperty.call(object, propName)) {
				callback.call(thisRef, object[propName], propName, object);
			}
		}
	}
};

module.exports = util;
