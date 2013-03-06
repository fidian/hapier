/**
 * Promise/A+ compliant promises, but nothing more.
 *
 * See https://github.com/promises-aplus/promises-spec for information on
 * what Promise/A+ is.
 *
 * Usage:
 *   function somethingAsync() {
 *       promise = new Promise();
 *       // Do something async and that will call promise.fulfill(data) on
 *       // success, promise.reject(error) on failure
 *       return promise;
 *   }
 *   somethingAsync().then(function (data) { console.log(':-)'); },
 *       function (error) { console.log(':-('); });
 */
// Wrapper code from umdjs - UMD (Universal Module Definition) patterns
// https://github.com/umdjs/umd/blob/master/returnExports.js
/*global define*/
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		if (typeof module === 'object' && module.exports) {
			module.exports = factory();
		} else {
			exports.Promise = factory();
		}
	} else if (typeof define === 'function' && define.amd) {
		define([], factory);
	} else if (typeof root === 'object') {
		root.Promise = factory();
	} else {
		throw "Unable to export Promise";
	}
}(this, function () {
	'use strict';

	/**
	 * Create a new Promise
	 */
	function Promise() {
		var myself;

		if (!(this instanceof Promise)) {
			return new Promise();
		}

		// null = pending, true = fulfilled, false = rejected
		this.state = null;
		this.thenCallArray = [];
		this.data = [];
	}


	/**
	 * Determines if something is "thenable" according to A+ spec
	 *
	 * @param mixed target
	 * @return boolean True if it's thenable
	 */
	function isThenable(target) {
		if (typeof target !== 'function' && typeof target !== 'object') {
			return false;
		}

		if (target.then) {
			return true;
		}

		return false;
	}


	/**
	 * Accept onFulfilled and onRejected callbacks.  Adds them to our
	 * arrays and will return a new Promise.
	 *
	 * @param function|array|null onFulfilled
	 * @param function|array|null onRejected
	 * @return Promise
	 */
	Promise.prototype.then = function then(onFulfilled, onRejected) {
		var thenCall;

		thenCall = {
			fulfilled: onFulfilled,
			rejected: onRejected,
			chainedPromise: new Promise()
		};

		this.thenCallArray.push(thenCall);

		if (this.state !== null) {
			this.callBack(thenCall);
		}

		return thenCall.chainedPromise;
	};


	/**
	 * Change the state and pass along the data to all registered 'then'
	 * functions.
	 *
	 * @param boolean success true if fulfilled, false if rejected
	 * @param array args Additional arguments to pass on
	 */
	Promise.prototype.resolve = function resolve(success, args) {
		var myself;

		if (this.state !== null) {
			return;
		}

		this.state = !!success;  // Force to be a boolean
		this.data = args;
		myself = this;
		this.thenCallArray.forEach(function (thenCall) {
			myself.callBack(thenCall);
		});

		return this;
	};


	/**
	 * Call the right function on a thenCall object, passing in this
	 * promise's data.
	 *
	 * @parameter object thenCall
	 */
	Promise.prototype.callBack = function (thenCall) {
		var fn, myself;

		if (this.state) {
			fn = thenCall.fulfilled;
		} else {
			fn = thenCall.rejected;
		}

		if (typeof fn !== 'function') {
			return;
		}

		myself = this;

		setTimeout(function () {
			var returned;

			try {
				returned = fn.apply(null, myself.data);
				myself.chain(thenCall.chainedPromise, myself.state, [ returned ]);
			} catch (ex) {
				myself.chain(thenCall.chainedPromise, false, [ ex ]);
			}
		}, 0);
	};


	/**
	 * Chain a fulfillment/rejection to the next promise
	 *
	 * @param boolean fulfilled true/false
	 * @param array args Pass on to next promise
	 */
	Promise.prototype.chain = function chain(chainedPromise, fulfilled, args) {
		if (!args) {
			args = [];
		}

		// Check if a promise was returned
		if (args.length === 1 && isThenable(args[0])) {
			// Attach this.chainedPromise to this new "thenable"
			this.chainThenable(chainedPromise, args[0]);
		} else {
			args.unshift(fulfilled);
			chainedPromise.resolve.apply(chainedPromise, args);
		}
	};


	/**
	 * Chain the next promise to the promise that is passed in.
	 *
	 * @param function|object thenable
	 */
	Promise.prototype.chainThenable = function chainThenable(chainedPromise, thenable) {
		try {
			// Pass all arguments to the next promise
			thenable.then(function () {
				var args;
				args = Array.prototype.slice.apply(arguments);
				chainedPromise.resolve(true, args);
			}, function () {
				var args;
				args = Array.prototype.slice.apply(arguments);
				chainedPromise.resolve(false, args);
			});
		} catch (ex) {
			chainedPromise.resolve(false, [ ex ]);
		}
	};


	Promise.prototype.fulfill = function () {
		return this.resolve(true, Array.prototype.slice.call(arguments));
	};


	Promise.prototype.reject = function () {
		return this.resolve(false, Array.prototype.slice.call(arguments));
	};


	Promise.prototype.success = function (fn) {
		return this.then(fn);
	};


	Promise.prototype.reject = function (fn) {
		return this.then(null, fn);
	};


	return Promise;
}));