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
/*global define, YUI*/
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
	} else if (typeof YUI === 'function') {
		YUI.add('Promise', function (Y) {
			Y.Promise = factory();
		});
	} else if (typeof root === 'object') {
		root.Promise = factory();
	} else {
		throw "Unable to export Promise";
	}
}(this, function () {
	'use strict';


	/**
	 * Copy arguments, which is not an array, into an actual Array
	 *
	 * @param array|arguments arrayLike
	 * @return Array
	 */
	function arrayCopy(arrayLike) {
		return Array.prototype.slice.call(arrayLike);
	}


	/**
	 * Create a new Promise
	 */
	function Promise() {
		if (!(this instanceof Promise)) {
			return new Promise();
		}

		// null = pending, true = fulfilled, false = rejected
		this.state = null;
		this.thenCallArray = [];
		this.data = [];
		this.waitingFor = 0;

		if (arguments.length) {
			this.when.apply(this, arrayCopy(arguments));
		}
	}


	/**
	 * Determines if something is "thenable" according to A+ spec
	 *
	 * @param mixed target
	 * @return boolean True if it's thenable
	 */
	function isThenable(target) {
		try {
			if (typeof target.then === 'function') {
				return true;
			}
		} catch (ex) {
		}

		return false;
	}


	/**
	 * Become fulfilled only when everything is resolved
	 *
	 * @param Promise
	 * @return this
	 */
	Promise.prototype.when = function when() {
		var args, myself;

		args = arrayCopy(arguments);
		myself = this;

		// Avoid triggering too early
		myself.waitingFor += 1;

		args.forEach(function (promise) {
			myself.waitingFor += 1;
			promise.then(function () {
				myself.waitingFor -= 1;

				if (!myself.waitingFor) {
					myself.fulfill();
				}
			});
		});

		// Ok, now we can check to see if we are waiting for things
		myself.waitingFor -= 1;

		if (!myself.waitingFor) {
			myself.fulfill();
		}

		return this;
	};


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
			this.chain(thenCall.chainedPromise, this.state, this.data);
			return;
		}

		myself = this;

		setTimeout(function () {
			var returned;

			try {
				returned = fn.apply(null, myself.data);
				myself.chain(thenCall.chainedPromise, true, [ returned ]);
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

		// Check if a promise was returned and should be called
		if (fulfilled && args.length === 1 && isThenable(args[0])) {
			// Attach this.chainedPromise to this new "thenable"
			this.chainThenable(chainedPromise, args[0]);
		} else {
			chainedPromise.resolve.call(chainedPromise, fulfilled, args);
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
				chainedPromise.resolve(true, arrayCopy(arguments));
			}, function () {
				chainedPromise.resolve(false, arrayCopy(arguments));
			});
		} catch (ex) {
			chainedPromise.resolve(false, [ ex ]);
		}
	};


	/**
	 * Convenience Methods
	 */


	Promise.prototype.fulfill = function () {
		return this.resolve(true, arrayCopy(arguments));
	};


	Promise.prototype.reject = function () {
		return this.resolve(false, arrayCopy(arguments));
	};


	Promise.prototype.success = function (fn) {
		return this.then(fn);
	};


	Promise.prototype.error = function (fn) {
		return this.then(null, fn);
	};


	Promise.prototype.always = function (fn) {
		return this.then(fn, fn);
	};


	return Promise;
}));
