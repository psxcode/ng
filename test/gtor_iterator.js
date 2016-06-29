"use strict";

var gtor = require('../src/gtor');
var Iterator = gtor.Iterator;

describe('GTOR Iterator', function () {

	function throwFunc() {
		throw new Error('error');
	}

	function accumulate(acc, val) {
		return acc + val;
	}

	it('should iterate over array', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr);

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
		var it = Iterator(arr);

		for (var i = 0; i < arr.length; ++i) {
			expect(it.next().value).toEqual(arr[i]);
		}
	});

	it('should iterate over any object with \'next\' function', function () {
		var iterable = {
			next: function () {
				return Iterator.Iteration.resolve(42, 0, true);
			}
		};

		var it = Iterator(iterable);

		expect(it.next().value).toEqual(42);
	});

	it('should iterate over any function. Function should return Iteration object', function () {
		function generator() {
			return Iterator.Iteration.resolve(42, 0, true);
		}

		var it = Iterator(generator);

		expect(it.next().value).toEqual(42);
	});

	it('can start from any index', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr, 1);

		expect(it.next().value).toEqual(2);
	});

	it('can stop at any index', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr, 1, 2);

		it.next();
		expect(it.next().done).toEqual(true);
	});

	it('handles negative start range indexes', function () {
		var arr = [1, 2, 3, 4, 5];
		//negative begin index trims to 0
		var it = Iterator(arr, -1);

		var iteration = it.next();
		expect(iteration.key).toEqual(0);
	});

	it('handles negative end range indexes', function () {
		var arr = [1, 2, 3, 4, 5];
		//negative end index trims to 0
		var it = Iterator(arr, 0, -1);

		var iteration = it.next();
		expect(iteration.done).toEqual(true);
	});

	it('handles start index larger than stop', function () {
		var arr = [1, 2, 3, 4, 5];
		//begin index trims to end if larger
		var it = Iterator(arr, 3, 1);

		var iteration = it.next();
		expect(iteration.done).toEqual(true);
	});

	it('handles end index larger than length', function () {
		var spy = jasmine.createSpy('spy');

		var arr = [1, 2, 3, 4, 5];
		//end index trims to iterable.length if larger
		new Iterator(arr, 0, 42).reduce(spy).next();

		expect(spy).toHaveBeenCalledTimes(5);
	});

	it('should return \'undefined\' after \'done\'', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr);

		var iteration = it.next();
		while (!iteration.done) {
			iteration = it.next();
		}

		expect(iteration.value).toBeUndefined();
	});

	it('should allow to map iterator', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr)
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
		var it = Iterator(arr).map(spy);

		it.next();

		expect(spy).not.toHaveBeenCalled();
	});

	it('should allow to chain map iterators', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr)
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
		Iterator(arr).map(spy).map(spy).next();

		expect(spy).not.toHaveBeenCalled();
	});

	it('allows to filter iterator', function () {
		var arr = [1, 2, 3];
		var arrCompare = arr.filter(function (val) {
			return val >= 2;
		});
		var it = Iterator(arr)
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
		Iterator(arr).filter(spy).next();

		expect(spy).not.toHaveBeenCalled();
	});

	it('allows to chain \'map\' and \'filter\'', function () {
		var arr = [1, 2, 3, 4, 5];
		var arrCompare = arr.map(mp).filter(flt);

		var it = Iterator(arr).map(mp).filter(flt);

		for (var i = 0; i < arrCompare.length; ++i) {
			expect(it.next().value).toEqual(arrCompare[i]);
		}

		function flt(val) { return val > 2; }

		function mp(val) { return val * 2; }
	});

	it('allows to chain \'filter\' and \'map\'', function () {
		var arr = [1, 2, 3, 4, 5];
		var arrCompare = arr.filter(flt).map(mp);

		var it = Iterator(arr).filter(flt).map(mp);

		for (var i = 0; i < arrCompare.length; ++i) {
			expect(it.next().value).toEqual(arrCompare[i]);
		}

		function flt(val) { return val > 2; }

		function mp(val) { return val * 2; }
	});

	it('allows \'reduce\' iterator', function () {
		var arr = [1, 2, 3];
		var iteration = Iterator(arr)
			.reduce(function (acc, val, index) {
				expect(val).toEqual(arr[index]);
				return acc + val;
			}, 0)
			.next();

		expect(iteration.value).toEqual(6);
	});

	it('allows empty \'reduce\' to return initial value', function () {
		var arr = [1, 2, 3];
		var iteration = Iterator(arr)
			.reduce(null, 0)
			.next();

		expect(iteration.value).toEqual(0);
	});
	
	it('allows to \'flatten\' iterators', function() {
		var arr = [1, [2, 3], 4, [5, [6]]];
		var iteration = Iterator(arr)
			.flatten()
			.reduce(accumulate, 0)
			.next();

		expect(iteration.value).toEqual(0);
	});

	it('allows to chain \'map\', \'filter\' and \'reduce\'', function () {
		var arr = [1, 2, 3, 4];
		var iteration = Iterator(arr)
			.map(function (val) {
				return val * 2;
			})
			.filter(function (val) {
				return val > 4;
			})
			.reduce(function (acc, val) {
				return acc + val;
			}, 0)
			.next();

		expect(iteration.value).toEqual(14);
	});

	it('allows \'map\' handler to catch errors thrown in uplevel handlers', function () {
		var spy = jasmine.createSpy('spy');
		var errSpy = jasmine.createSpy('errSpy');

		var arr = [1, 2, 3, 4];
		Iterator(arr)
			.map(throwFunc)
			.map(spy, errSpy)
			.reduce()
			.next();

		expect(spy).not.toHaveBeenCalled();
		expect(errSpy).toHaveBeenCalledTimes(arr.length);
	});

	it('allows \'filter\' handler to catch errors thrown in uplevel handlers', function () {
		var spy = jasmine.createSpy('spy');
		var errSpy = jasmine.createSpy('errSpy');

		var arr = [1, 2, 3, 4];
		Iterator(arr)
			.map(throwFunc)
			.filter(spy, errSpy)
			.reduce()
			.next();

		expect(spy).not.toHaveBeenCalled();
		expect(errSpy).toHaveBeenCalledTimes(arr.length);
	});

	it('allows \'catch\' to handle errors thrown in uplevel handlers', function () {
		var errSpy = jasmine.createSpy('errSpy');

		var arr = [1, 2, 3, 4];
		Iterator(arr)
			.map(throwFunc)
			.catch(errSpy)
			.reduce()
			.next();

		expect(errSpy).toHaveBeenCalledTimes(arr.length);
	});

	it('allows \'catch\' to resolve values', function () {
		var arr = [1, 2, 3, 4];
		var iteration = Iterator(arr)
			.map(throwFunc)
			.catch(function (e, index) {
				return arr[index];
			})
			.reduce(function (acc, val) {
				return acc + val;
			}, 0)
			.next();

		expect(iteration.value).toEqual(10);
	});

	it('allows empty \'catch\' to resolve values as undefined', function () {
		var arr = [1, 2, 3, 4];
		var iteration = Iterator(arr)
			.map(throwFunc)
			.catch()
			.reduce()
			.next();

		expect(iteration.value).toBeUndefined();
	});

	it('errors propagate without invoking resolvers in chain', function () {
		var spy = jasmine.createSpy('spy');
		
		var arr = [1, 2, 3, 4];
		var iteration = Iterator(arr)
			.map(throwFunc)
			.map(spy)
			.catch()
			.reduce()
			.next();

		expect(spy).not.toHaveBeenCalled();
	});
});