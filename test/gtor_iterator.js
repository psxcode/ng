"use strict";

var gtor = require('../src/gtor');
var Iterator = gtor.Iterator;

describe('GTOR Iterator', function () {

	it('should iterate over array', function () {
		var arr = [1, 2, 3];
		var it = new Iterator(arr);

		for (var i = 0; i < arr.length; ++i) {
			expect(it.next().value).toEqual(arr[i]);
		}
	});

	it('should iterate over array-like-object', function () {
		var arr = {
			length: 3,
			'0': 1,
			'1': 2,
			'2': 3
		};
		var it = new Iterator(arr);

		for (var i = 0; i < arr.length; ++i) {
			expect(it.next().value).toEqual(arr[i]);
		}
	});

	it('can start from any index', function () {
		var arr = [1, 2, 3];
		var it = new Iterator(arr, 1);

		expect(it.next().value).toEqual(2);
	});

	it('provides \'begin\' property', function () {
		var arr = [1, 2, 3];
		var it = Iterator.begin(arr);

		expect(it.next().key).toEqual(0);
	});

	it('should return \'undefined\' after \'isDone\'', function () {
		var arr = [1, 2, 3];
		var it = Iterator.begin(arr);

		while (!it.next().done);

		expect(it.next().value).toBeUndefined();
	});

	it('should allow to map iterator', function () {
		var arr = [1, 2, 3];
		var it = Iterator.begin(arr)
			.map(function (val, index) {
				expect(val).toEqual(arr[index]);
				return val * 2;
			});

		for (var i = 0; i < arr.length; ++i) {
			expect(it.next().value).toEqual(arr[i] * 2);
		}
	});

	it('should not invoke map function if \'iterable.length\' is 0', function () {
		var spy = jasmine.createSpy('spy');
		var arr = [];
		var it = Iterator.begin(arr).map(spy);

		it.next();

		expect(spy).not.toHaveBeenCalled();
	});

	it('should allow to chain map iterators', function () {
		var arr = [1, 2, 3];
		var it = Iterator.begin(arr)
			.map(function (val, index) {
				expect(val).toEqual(arr[index]);
				return val * 2;
			})
			.map(function (val, index) {
				expect(val).toEqual(arr[index] * 2);
				return val * 2;
			});

		for (var i = 0; i < arr.length; ++i) {
			expect(it.next().value).toEqual(arr[i] * 4);
		}
	});

	it('should not invoke chained map functions if \'iterable.length\' is 0', function () {
		var spy = jasmine.createSpy('spy');
		var arr = [];
		var it = Iterator.begin(arr)
			.map(spy)
			.map(spy);

		it.next();

		expect(spy).not.toHaveBeenCalled();
	});

	it('allows to filter iterator', function () {
		var arr = [1, 2, 3];
		var arrCompare = arr.filter(function (val) {
			return val >= 2;
		});
		var it = Iterator.begin(arr)
			.filter(function (val, index) {
				expect(val).toEqual(arr[index]);
				return val >= 2;
			});

		for (var i = 0; i < arrCompare.length; ++i) {
			expect(it.next().value).toEqual(arrCompare[i]);
		}
	});

	it('does not invoke \'filter\' function if iterable.length is 0', function () {
		var spy = jasmine.createSpy('spy');
		var arr = [];
		var it = Iterator.begin(arr).filter(spy);

		it.next();

		expect(spy).not.toHaveBeenCalled();
	});

	it('allows to chain \'map\' and \'filter\'', function () {
		var arr = [1, 2, 3, 4, 5];
		var arrCompare = arr.map(mp).filter(flt);

		var it = Iterator.begin(arr).map(mp).filter(flt);

		for (var i = 0; i < arrCompare.length; ++i) {
			expect(it.next().value).toEqual(arrCompare[i]);
		}

		function flt(val) { return val > 2; }

		function mp(val) { return val * 2; }
	});

	it('allows to chain \'filter\' and \'map\'', function () {
		var arr = [1, 2, 3, 4, 5];
		var arrCompare = arr.filter(flt).map(mp);

		var it = Iterator.begin(arr).filter(flt).map(mp);

		for (var i = 0; i < arrCompare.length; ++i) {
			expect(it.next().value).toEqual(arrCompare[i]);
		}

		function flt(val) { return val > 2; }

		function mp(val) { return val * 2; }
	});

	it('allows \'reduce\' iterator', function () {
		var arr = [1, 2, 3];
		var it = Iterator.begin(arr)
			.reduce(function (acc, val, index) {
				expect(val).toEqual(arr[index]);
				return acc + val;
			}, 0);

		expect(it.next().value).toEqual(6);
	});

	it('allows to chain \'map\', \'filter\' and \'reduce\'', function () {
		var arr = [1, 2, 3, 4];
		var it = Iterator.begin(arr)
			.map(function (val) {
				return val * 2;
			})
			.filter(function (val) {
				return val > 4;
			})
			.reduce(function (acc, val, index) {
				return acc + val;
			}, 0);

		expect(it.next().value).toEqual(14);
	});
});