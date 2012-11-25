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
	}
};

module.exports = util;
