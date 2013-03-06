// Tests Promise against the Promises/A+ Test Suite
// https://github.com/promises-aplus/promises-tests

'use strict';

var tests, Promise;

tests = require('promises-aplus-tests');
Promise = require('../lib/Promise');

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

tests(adapter, function (err) {
	console.log(err);
});
