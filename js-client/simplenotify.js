/**
 * Very simplistic async signalling when a process is done.
 *
 * Assuming you have an arbitrary number of jobs that you want to
 * execute and that some of them may or may not be asynchronous.  This
 * lets you get all of the stack processing out of the way easily and your
 * final callback will happen on the first error, killing the stack, or
 * when everything is done.
 *
 * Limitations:
 *  - This checks for waiting jobs immediately after your program lets go
 *    (it is set up with setTimeout), so synchronously queue your jobs up.
 *  - The callback is called on the first exception reported (node style)
 *    or when all work is completed.
 */
'use strict';


/**
 * Constructor
 *
 * @param Function callback Final callback, only called once on error / success
 */
function SimpleNotify(callback) {
	var myself = this;

	if (!(this instanceof SimpleNotify)) {
		return new SimpleNotify(callback);
	}

	this.callback = callback;
	this.ready = false;  // Will automatically set to true after all sync jobs
	this.done = false;  // When done, no more callbacks should be called
	this.err = null;
	this.waitingFor = 0;

	// Automatically flag that this job can return values on the next tick
	setTimeout(function () {
		myself.ready = true;

		if (myself.err) {
			myself.done = true;
			myself.callback(myself.err);
		} else if (myself.waitingFor === 0) {
			myself.done = true;
			myself.callback(null);
		}
	}, 1);
}


/**
 * Returns a function that will tell the stack that a job has completed.
 *
 * @return Function
 */
SimpleNotify.prototype.done = function done() {
	var myself = this;

	if (this.state === 2) {
		throw new Error('Do not add jobs when the stack is completed');
	}

	this.waitingFor += 1;
	return function doneFunction(err) {
		myself.waitingFor -= 1;

		// Ignore everything if we're flagged as done
		if (myself.done) {
			return;
		}

		if (!myself.ready) {
			// Not ready to handle callbacks yet - still in sync portion
			if (err) {
				// The error is handled automatically in async portion
				myself.done = true;
				myself.err = err;
			}
		} else {
			// Do the final callback here if there's nothing left or on error
			if (err) {
				myself.done = true;
				myself.callback(err);
			} else if (myself.waitingFor === 0) {
				myself.done = true;
				myself.callback(null);
			}
		}
	};
};


module.exports = SimpleNotify;
