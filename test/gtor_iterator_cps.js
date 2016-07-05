"use strict";

var Iterator = require('../src/gtor_iterator_cps');

describe('GTOR Iterator', function () {

	function throwFunc() {
		throw new Error('error');
	}

	function accumulate(acc, val) {
		return acc + val;
	}

	it('should iterate over array', function () {
		var arr = [1, 2, 3];
		var it = Iterator();
		var testIndex = 0;

		it.next(test);
		it.next(test);
		it.next(test);

		function test(val) {
			expect(val).toEqual(arr[testIndex++]);
		}
	});

	it('should iterate over array-like-object', function () {
		var arr = {
			length: 3,
			'0': 1,
			'1': 2,
			'2': 3
		};
		var testIndex = 0;
		var it = Iterator(arr);

		it.next(test);
		it.next(test);
		it.next(test);

		function test(value) {
			expect(value).toEqual(arr[(testIndex++).toString()]);
		}
	});

	it('should iterate over object', function () {
		var arr = {
			'a': 1,
			'b': 2,
			'c': 3
		};
		var keys = Object.keys(arr);
		var testIndex = 0;
		var it = Iterator(arr);

		it.next(test);
		it.next(test);
		it.next(test);

		function test(value) {
			expect(value).toEqual(arr[keys[testIndex++]]);
		}
	});

	it('should iterate over any object with \'next\' function', function () {
		var iterable = {
			next: Iterator.func(function () {return 42})
		};

		var it = Iterator(iterable);

		it.next(function (value) {
			expect(value).toEqual(42);
		});
	});

	it('should iterate over any function', function () {
		function gen() { return 42; }

		var it = Iterator(gen);

		it.next(function (value) {
			expect(value).toEqual(42);
		});

		it.$next(function (iteration) {
			expect(iteration.done).toEqual(true);
		});
	});

	it('can start from any index', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr, 1);

		it.next(function (value) {
			expect(value).toEqual(2);
		});
	});

	it('can stop at any index', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr, 1, 2);

		it.next(function (value) {
			expect(value).toEqual(2);
		});

		it.$next(function (iteration) {
			expect(iteration.done).toEqual(true);
		});
	});

	it('negative start index counts from end', function () {
		var arr = [1, 2, 3, 4, 5];
		//negative begin index counts from end
		var it = Iterator(arr, -1);

		it.next(function (value) {
			expect(value).toEqual(5);
		});
	});

	it('handles negative end range indexes', function () {
		var arr = [1, 2, 3, 4, 5];
		//negative end index trims to 0
		var it = Iterator(arr, 0, -4);

		it.next(function (value) {
			expect(value).toEqual(1);
		});

		it.$next(function (iteration) {
			expect(iteration.done).toEqual(true);
		});
	});

	it('handles start index larger than stop', function () {
		var arr = [1, 2, 3, 4, 5];
		//begin index trims to end if larger
		var it = Iterator(arr, 3, 1);

		it.$next(function (iteration) {
			expect(iteration.done).toEqual(true);
		});
	});

	it('handles end index larger than length', function () {
		var arr = [1, 2, 3];
		//end index trims to iterable.length if larger
		var it = Iterator(arr, 0, 42);
		var testIndex = 0;

		it.next(test);
		it.next(test);
		it.next(test);

		function test(val) {
			expect(val).toEqual(arr[testIndex++]);
		}
	});

	it('should return \'undefined\' after \'done\'', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr);

		it.next();
		it.next();
		it.next();

		it.$next(function (iteration) {
			expect(iteration.done).toEqual(true);
		})
	});

	it('should allow to map iterator', function () {
		var arr = [1, 2, 3];
		var testIndex = 0;
		var it = Iterator(arr)
			.map(function (val) {
				expect(val).toEqual(arr[testIndex]);
				return val * 2;
			});

		it.next(test);
		it.next(test);
		it.next(test);

		function test(val) {
			expect(val).toEqual(arr[testIndex++] * 2);
		}
	});

	it('should not invoke map function if \'iterable.length\' is 0', function () {
		var spy = jasmine.createSpy('spy');
		var arr = [];
		var it = Iterator(arr)
			.map(spy);

		it.next();

		expect(spy).not.toHaveBeenCalled();
	});

	it('should allow to chain map iterators', function () {
		var arr = [1, 2, 3];
		var testIndex = 0;
		var it = Iterator(arr)
			.map(function (val) {
				expect(val).toEqual(arr[testIndex]);
				return val * 2;
			})
			.map(function (val) {
				expect(val).toEqual(arr[testIndex] * 2);
				return val * 2;
			});

		it.next(test);
		it.next(test);
		it.next(test);

		function test(val) {
			expect(val).toEqual(arr[testIndex++] * 4);
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
		var filterIndex = 0;
		var testIndex = 0;
		var it = Iterator(arr)
			.filter(function (val) {
				expect(val).toEqual(arr[filterIndex++]);
				return val >= 2;
			});

		it.next(test);
		it.next(test);
		it.next(test);

		function test(val) {
			expect(val).toEqual(arrCompare[testIndex++]);
		}
	});

	it('does not invoke \'filter\' function if iterable.length is 0', function () {
		var spy = jasmine.createSpy('spy');
		var arr = [];
		var it = Iterator(arr)
			.filter(spy);

		it.next();

		expect(spy).not.toHaveBeenCalled();
	});

	it('allows to chain \'map\' and \'filter\'', function () {
		var arr = [1, 2, 3, 4, 5];
		var arrCompare = arr.map(mp).filter(flt);
		var testIndex = 0;

		var it = Iterator(arr).map(mp).filter(flt);

		it.next(test);
		it.next(test);
		it.next(test);

		function test(val) {
			expect(val).toEqual(arrCompare[testIndex++]);
		}

		function flt(val) { return val > 2; }

		function mp(val) { return val * 2; }
	});

	it('allows to chain \'filter\' and \'map\'', function () {
		var arr = [1, 2, 3, 4, 5];
		var arrCompare = arr.filter(flt).map(mp);
		var testIndex = 0;

		var it = Iterator(arr).filter(flt).map(mp);

		it.next(test);
		it.next(test);
		it.next(test);

		function test(val) {
			expect(val).toEqual(arrCompare[testIndex++]);
		}

		function flt(val) { return val > 2; }

		function mp(val) { return val * 2; }
	});

	it('allows \'reduce\' iterator', function () {
		var arr = [1, 2, 3];
		var testIndex = 0;
		var it = Iterator(arr)
			.reduce(function (acc, val) {
				expect(val).toEqual(arr[testIndex++]);
				return acc + val;
			}, 0);

		it.next(test);

		function test(val) {
			expect(val).toEqual(6);
		}
	});

	it('allows empty \'reduce\' to return initial value', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr).reduce(null, 0);

		it.next(test);

		function test(val) {
			expect(val).toEqual(0);
		}
	});

	it('allows to \'flatten\' arrays', function () {
		var arr = [1, [2, 3, []], 4, [5, [6]]];
		var it = Iterator(arr)
			.flatten()
			.reduce(accumulate, 0);

		it.next(test);

		function test(val) {
			expect(val).toEqual(21);
		}
	});

	it('allows to \'flatten\' any iterables', function () {
		var arr = [gen, {next: Iterator.func(gen)}, [3, {v1: 4, v2: gen}, [Iterator([2, 3])]], {}, 4, [5, [6]]];
		var it = Iterator(arr)
			.flatten()
			.reduce(accumulate, 0);

		it.next(test);

		function test(val) {
			expect(val).toEqual(42);
		}

		function gen() {return 5;}
	});

	it('allows to \'cycle\' any iterators', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr)
			.cycle(3)
			.reduce(accumulate, 0);

		it.next(test);

		function test(val) {
			expect(val).toEqual(18);
		}
	});

	it('allows to chain \'cycle\' iterators', function () {
		var arr = [1, 2, 3];
		var it = Iterator(arr)
			.cycle(3)
			.cycle(3)
			.reduce(accumulate, 0);

		it.next(test);

		function test(val) {
			expect(val).toEqual(54);
		}
	});

	it('allows to chain \'map\', \'filter\' and \'reduce\'', function () {
		var arr = [1, 2, 3, 4];
		var it = Iterator(arr)
			.map(function (val) {
				return val * 2;
			})
			.filter(function (val) {
				return val > 4;
			})
			.reduce(accumulate, 0);

		it.next(test);

		function test(val) {
			expect(val).toEqual(14);
		}
	});

	it('allows \'map\' handler to catch errors thrown in uplevel handlers', function () {
		var spy = jasmine.createSpy('spy');
		var errSpy = jasmine.createSpy('errSpy');

		var arr = [1, 2, 3, 4];
		var it = Iterator(arr)
			.map(throwFunc)
			.map(spy, errSpy)
			.reduce();

		it.next();

		expect(spy).not.toHaveBeenCalled();
		expect(errSpy).toHaveBeenCalledTimes(arr.length);
	});

	it('allows \'filter\' handler to catch errors thrown in uplevel handlers', function () {
		var spy = jasmine.createSpy('spy');
		var errSpy = jasmine.createSpy('errSpy');

		var arr = [1, 2, 3, 4];
		var it = Iterator(arr)
			.map(throwFunc)
			.filter(spy, errSpy)
			.reduce();

		it.next();

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
		var testIndex = 0;
		var it = Iterator(arr)
			.map(throwFunc)
			.catch(function (e) {
				return arr[testIndex++];
			})
			.reduce(accumulate, 0);

		it.next(test);

		function test(val) {
			expect(val).toEqual(10);
		}
	});

	it('allows empty \'catch\' to resolve values as undefined', function () {
		var arr = [1, 2, 3, 4];
		var it = Iterator(arr)
			.map(throwFunc)
			.catch();

		it.next(test);

		function test(val) {
			expect(val).toEqual(void 0);
		}
	});

	it('errors propagate without invoking resolvers in chain', function () {
		var spy = jasmine.createSpy('spy');

		var arr = [1, 2, 3, 4];
		Iterator(arr)
			.map(throwFunc)
			.map(spy)
			.catch()
			.next();

		expect(spy).not.toHaveBeenCalled();
	});

	it('allows to convert iterator to Array', function () {
		var arr = [1, 2, 3, 4];
		Iterator(arr).toArray(function (val) {
			expect(val).toEqual(arr);
		});

	});
});