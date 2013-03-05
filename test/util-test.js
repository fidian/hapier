"use strict";
var assert, batch, cloneInputs, eachInputs, util, vows, vtools;

assert = require('assert');
batch = {};
util = require('../util');
vows = require('vows');
vtools = require('./vtools');

cloneInputs = {
	number: 17,
	string: "asdf"
};

function cloneMatches(input, shouldMatch) {
	return function (err, result) {
		assert.ifError(err);
		assert.equal(result === input, shouldMatch);
	};
}

batch.clone = vtools.dataProvider(function (input) {
	this.callback(null, util.clone(input));
}, {
	number: {
		args: cloneInputs.number,
		returns: 17,
		cloneMatches: cloneMatches(cloneInputs.number, true)
	},
	string: {
		args: cloneInputs.string,
		returns: "asdf",
		cloneMatches: cloneMatches(cloneInputs.string, true)
	}
});

eachInputs = {};
eachInputs.array = [ 6, 5, 4 ];
eachInputs.sparseArray = [ 9, 8, 7, 6 ];
delete eachInputs.sparseArray[1];
eachInputs.object = { a: "b", c: true, d: undefined };
eachInputs.sparseObject = { a: "b", c: true, d: undefined };
delete eachInputs.sparseObject.c;

batch.each = vtools.dataProvider(function (input) {
	var count = 0,
		result = [];

	util.each(input, function (val) {
		count += 1;
		result.push(val);
	});

	result.push(count);
	this.callback(null, result);
}, {
	undefined: {
		args: [ undefined ],
		returns: [ 0 ]
	},
	string: {
		args: [ "string" ],
		returns: [ "string", 1 ]
	},
	array: {
		args: [ eachInputs.array ],
		returns: [ 6, 5, 4, 3 ]
	},
	sparseArray: {
		args: [ eachInputs.sparseArray ],
		returns: [ 9, 7, 6, 3 ]
	},
	object: {
		args: [ eachInputs.object ],
		// It has the property even though the value is undefined
		returns: [ "b", true, undefined, 3 ]
	},
	sparseObject: {
		args: [ eachInputs.sparseObject ],
		returns: [ "b", undefined, 2 ]
	}
});

exports.batch = vows.describe('../util.js').addBatch(batch);
