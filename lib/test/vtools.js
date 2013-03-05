'use strict';

var assert, preserved;

preserved = [];
assert = require('assert');

function dataProvider(topic, tests) {
    var scenarios = {};

	Object.keys(tests).forEach(function (scenarioName) {
		var args, scenario, testBuilt;

		scenario = tests[scenarioName];
		testBuilt = {};

		args = scenario.args;

		if (!Array.isArray(args)) {
			args = [ args ];
		}

		testBuilt.topic = function () {
			try {
				topic.apply(this, args);
			} catch (e) {
				this.callback(e);
			}
		};

		// Make sure "returns" matches what we expected from the callback
		if (scenario.hasOwnProperty('returns')) {
			// Weirdly, we need result here otherwise it is passed in
			// the err parameter
			testBuilt.returns = function (err, result) {
				assert.ifError(err);
				assert.deepEqual(scenario.returns, result);
			};
		}

		// Never let an exception slip by, unless told explicitly otherwise
		testBuilt.exception = function (err, result) {
			assert.ifError(err);
		};

		if (scenario.hasOwnProperty('exception')) {
			if (typeof scenario.exception === 'boolean') {
				if (scenario.exception) {
					testBuilt.exception = function (err, result) {
						assert.instanceOf(err, Error);
					};
				} else if (typeof scenario.exception === 'string') {
					testBuilt.exception = function (err, result) {
						assert.equal(err.toString(), scenario.exception);
					};
				} else if (scenario.exception instanceof Error) {
					testBuilt.exception = function (err, result) {
						assert.equal(err, scenario.exception);
					};
				}
			}
		}
		Object.keys(scenario).forEach(function (scenarioKey) {
			if (scenarioKey !== "args" && scenarioKey !== "returns" && scenarioKey !== "exception") {
				testBuilt[scenarioKey] = scenario[scenarioKey];
			}
		});

		scenarios[scenarioName] = testBuilt;
	});
	return scenarios;
}

function preserve(obj, prop) {
	preserved.push({
		obj: obj,
		prop: prop,
		value: obj[prop]
	});
}

function restore() {
	var what;
	while (preserved.length) {
		what = preserved.pop();
		what.obj[what.prop] = what.value;
	}
}

module.exports = {
	dataProvider: dataProvider,
	preserve: preserve,
	restore: restore
};
