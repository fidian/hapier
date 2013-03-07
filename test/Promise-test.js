// Tests Promise against the Promises/A+ Test Suite
// https://github.com/promises-aplus/promises-tests

'use strict';

var tests, Promise, vows, assert;

tests = require('promises-aplus-tests');
Promise = require('../lib/Promise');
vows = require('vows');
assert = require('assert');

var adapter = {
	pending: function () {
		var p = new Promise();
		return {
			promise: p,
			fulfill: function (value) {
				p.fulfill(value);
			},
			reject: function (reason) {
				p.reject(reason);
			}
		};
	}
};

exports.batch = vows.describe('../lib/Promise.js').addBatch({
	'a+': {
		topic: function () {
			var cb = this.callback;
			tests(adapter, function (err) {
				cb(err);
			});
		},

		'they all pass': function (err) {
			assert.ifError(err);
		}
	}
});
