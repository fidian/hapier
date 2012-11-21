'use strict';

var util;

require('./es5-shim.js');

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

		function copy(val, index) {
			target[index] = util.clone(val);
		}

		if (Array.isArray(src)) {
			target = [];
			util.each(src, copy);
		} else if (typeof src === 'object') {
			target = {};
			util.each(src, copy);
		} else {
			target = src;
		}

		return target;
	},


	/**
	 * Iterate over an array or object, or maybe just call the callback
	 * with a single value
	 *
	 * @param mixed thing
	 * @param Function callback(item, index)
	 * @param Object thisArg (optional) Contect for calling the callback
	 */
	each: function each(thing, callback, thisArg) {
		var i;

		if (Array.isArray(thing)) {
			Array.prototype.forEach.call(thing, callback, thisArg);
		} else if (typeof thing === 'object') {
			Object.keys(thing).forEach(function (key) {
				callback.call(thisArg, thing[key], key, thing);
			});
		} else if (thing !== undefined) {
			callback.call(thisArg, thing);
		}
	}
};

module.exports = util;
