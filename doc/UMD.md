Universal Module Definition
===========================

This library uses a pattern to define a module in multiple systems with the same source file.  In general, it looks like this:

    Header
	Code to make the object
	Footer

Here is a tiny example of module AAA that also requires modules BBB and CCC.  I've commented it a lot so we know why each line exists.

	// jslint configuration
	/*global define, YUI*/
	(function (root, factory) {
		'use strict';  // For jslint

		if (typeof exports === 'object') {
			// CommonJS always defines exports, may define module
			// Used in node, Montage
			if (typeof module === 'object' && module.exports) {
				module.exports = factory(require('./BBB'), require('./CCC'));
			} else {
				exports.Schema = factory(require('./BBB'), require('./CCC'));
			}
		} else if (typeof define === 'function' && define.amd) {
			// RequireJS
			define(['BBB', 'CCC'], factory);
		} else if (typeof YUI === 'function') {
			// YUI
			YUI.add('AAA', function (Y) {
				Y.AAA = factory(Y.BBB, Y.CCC);
			}, '', {
				requires: ['BBB', 'CCC']
			});
		} else if (typeof root === 'object') {
			// In-browser with no load system
			root.AAA = factory(root.BBB, root.CCC);
		} else {
			throw "Unable to export AAA";
		}
	}(this, function (BBB, CCC) {
		'use strict';

		// Done with header, begin the code to make the AAA module

		function AAA() {
			// AAA will extend CCC
			if (!(this instanceof AAA)) {
				return new AAA();
			}

			CCC.call(this);
		}

		AAA.prototype = Object.create(CCC.prototype);
		AAA.prototype.constructor = AAA;

		AAA.prototype.getBBB = function getBBB() {
			return BBB;
		};

		// Done with code, start footer

		return AAA;
	}));

Here is the header again, except now the AAA module does not require any dependencies.  Comments have also been stripped.

	/*global define, YUI*/
	(function (root, factory) {
		'use strict';

		if (typeof exports === 'object') {
			if (typeof module === 'object' && module.exports) {
				module.exports = factory();
			} else {
				exports.Schema = factory();
			}
		} else if (typeof define === 'function' && define.amd) {
			define([], factory);
		} else if (typeof YUI === 'function') {
			YUI.add('AAA', function (Y) {
				Y.AAA = factory();
			});
		} else if (typeof root === 'object') {
			root.AAA = factory();
		} else {
			throw "Unable to export AAA";
		}
	}(this, function () {
		'use strict';
