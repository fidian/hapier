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
		if (!(this instanceof Promise)) {
			return new Promise();
		}

		this.state = 'pending';
		this.onFulfilled = [];
		this.onRejected = [];
		this.data = [];
		this.chainedPromise = null;
	}


	/**
	 * Add to an array
	 *
	 * @param array destArray
	 * @param function srcValue
	 */
	function addToArray(destArray, srcValue) {
		if (typeof srcValue !== 'function') {
			return;
		}

		destArray.push(srcValue);
	}


	/**
	 * Calls every function in the functionList with the given arguments
	 * and then calls "this.chain(method, ...)" when everything is done.
	 *
	 * Queues this up with setTimeout for portability.
	 *
	 * @param string method 'fulfill' or 'reject'
	 * @param array functionList
	 * @param array argumentCopy
	 */
	function asyncCall(method, functionList, argumentCopy) {
		var returned;

		setTimeout(function () {
			try {
				returned = this.callFunctions(functionList, argumentCopy);
				this.chain(method, returned);
			} catch (ex) {
				this.chain('reject', [ ex ]);
			}
		}, 0);
	}


	/**
	 * Call resolved functions for fullment/rejection
	 *
	 * @param array functionArray
	 * @param array passArguments
	 */
	function callFunctions(functionArray, passArguments) {
		var result;

		if (!functionArray.length) {
			return passArguments;
		}

		functionArray.forEach(function (fn) {
			result = fn.apply(null, passArguments);
		});

		return result;
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
		addToArray(this.onFulfilled, onFulfilled);
		addToArray(this.onRejected, onRejected);

		if (!this.chainedPromise) {
			this.chainedPromise = new Promise();
		}

		return this.chainedPromise;
	};


	/**
	 * Fulfill a promise
	 */
	Promise.prototype.fulfill = function fulfill() {
		var argumentCopy;

		if (this.state !== 'pending') {
			return;
		}

		this.state = 'fulfilled';
		argumentCopy = Array.prototype.slice.call(arguments);
		asyncCall('fulfill', this.onFulfilled, argumentCopy);
	};


	/**
	 * Chain a fulfillment/rejection to the next promise
	 *
	 * @param string method 'fulfill' or 'reject'
	 * @param array returned (optional)
	 */
	Promise.prototype.chain = function chain(method, args) {
		if (!this.chainedPromise) {
			return;
		}

		if (!args) {
			args = [];
		}

		// Check if a promise was returned
		if (args.length === 1 && isThenable(args[0])) {
			// Attach this.chainedPromise to this new "thenable"
			this.chainThenable(args[0]);
		} else {
			this.chainedPromise[method].apply(null, args);
		}
	};


	/**
	 * Chain the next promise (this.chainedPromise) to the promise
	 * that is passed in.
	 *
	 * @param function|object thenable
	 */
	Promise.prototype.chainThenable = function chainThenable(thenable) {
		if (!this.chainedPromise) {
			return;
		}

		try {
			// Pass all arguments to the next promise
			thenable.then(function () {
				var args;
				args = Array.prototype.slice.apply(arguments);
				this.chain('fulfill', args);
			}, function () {
				var args;
				args = Array.prototype.slice.apply(arguments);
				this.chain('reject', args);
			});
		} catch (ex) {
			this.chain('reject', ex);
		}
	};


	/**
	 * Reject a promise
	 */
	Promise.prototype.reject = function reject() {
		var argumentCopy;

		if (this.state !== 'pending') {
			return;
		}

		this.state = 'rejected';
		argumentCopy = Array.prototype.slice.call(arguments);
		asyncCall('reject', this.onRejected, argumentCopy);
	};


	return Promise;
}));
