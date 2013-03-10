"use strict";
var assert, batch, cloneInputs, util, vows, vtools;

assert = require('assert');
batch = {};
util = require('../lib/hapierUtil');
vows = require('vows');
vtools = require('./vtools');

batch.areSame = vtools.dataProvider(function (a, b) {
	var result;
	result = util.areSame(a, b);
	this.callback(null, result);
}, {
	'same boolean': {
		args: [ true, true ],
		returns: true
	},
	'different falsy': {
		args: [ undefined, null ],
		returns: false
	},
	'different strings': {
		args: [ 'abcdefg', 'abcdefgh' ],
		returns: false
	},
	'same objects': {
		args: [
			{
				abc: "def",
				ghi: [
					1, 2, 3, 6, 7, 9
				],
				bool: false
			},
			{
				abc: "def",
				bool: false,
				ghi: [
					1, 2, 3, 6, 7, 9
				]
			}
		],
		returns: true
	},
	'different objects': {
		args: [
			{
				abc: "def",
				ghi: [
					1, 2, 3, 6, 7, 9
				],
				bool: false
			},
			{
				abc: "def",
				ghi: [
					1, 2, 3, 6, 9, 7
				],
				bool: false
			}
		],
		returns: false
	}
});

batch.determineType = vtools.dataProvider(function (data) {
	var result;
	result = util.determineType(data);
	this.callback(null, result);
}, {
	'boolean true': {
		args: [ true ],
		returns: 'boolean'
	},
	'boolean false': {
		args: [ false ],
		returns: 'boolean'
	},
	'number non-integer': {
		args: [ 1234.5 ],
		returns: 'number'
	},
	'number integer': {
		args: [ 1234 ],
		returns: 'integer'
	},
	'null': {
		args: [ null ],
		returns: 'null'
	},
	'object object': {
		args: [ {} ],
		returns: 'object',
	},
	'object array': {
		args: [ [] ],
		returns: 'array'
	},
	'string': {
		args: [ '12345' ],
		returns: 'string'
	},
	'undefined': {
		args: [ undefined ],
		returns: 'undefined'
	},
	'unknown': {
		args: [ function () {} ],
		returns: 'unknown'
	}
});

batch.uniqueArrayAdd = vtools.dataProvider(function (target, more) {
	util.uniqueArrayAdd(target, more);
	this.callback(null, target);
}, {
	'adding nothing': {
		args: [
			[ 1, 3, 4, 5 ],
			[]
		],
		returns: [ 1, 3, 4, 5 ]
	},
	'adding duplicate': {
		args: [
			[ 'Red', 'leather', 'yellow' ],
			[ 'leather' ]
		],
		returns: [ 'Red', 'leather', 'yellow' ]
	},
	'letters and numbers': {
		args: [
			[ 'a', 3, 'm', 0, 'q', 't', 's', '5' ],
			[ 7, '3', 'w', 0, 'a', 'g' ]
		],
		returns: [ 'a', 3, 'm', 0, 'q', 't', 's', '5', 7, '3', 'w', 'g' ]
	}
});

exports.batch = vows.describe('../lib/hapierUtil.js').addBatch(batch);
