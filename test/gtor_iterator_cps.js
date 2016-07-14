"use strict";

var Iterator = require('../src/gtor_iterator_cps');
var SS = require('../src/gtor_singular_sync');
var SA = require('../src/gtor_singular_async');

describe('GTOR Iterator', function () {

	function throwFunc() {
		throw new Error('error');
	}

	function multBy2(val) {
		return val * 2;
	}

	function accumulate(acc, val) {
		return acc + val;
	}

	function iterate(iterator, visitor, done) {
		next();

		function iterationHandler(iteration) {
			if (iteration.done) {
				done();
			} else {
				iteration.value.then(visitor).finally(next);
			}
		}

		function next() {
			iterator.next(iterationHandler);
		}
	}

	it('should iterate over array', function (done) {
		var arr = [1, 2, 3];
		var it = Iterator(arr);
		var testIndex = 0;

		iterate(it, function (val) {
			expect(val).toEqual(arr[testIndex++]);
		}, done);
	});

	it('should iterate over array-like-object', function (done) {
		var arr = {
			length: 3,
			'0': 1,
			'1': 2,
			'2': 3
		};
		var it = Iterator(arr);
		var testIndex = 0;

		iterate(it, function (value) {
			expect(value).toEqual(arr[(testIndex++).toString()]);
		}, done);
	});

	it('should iterate over object', function (done) {
		var arr = {
			'a': 1,
			'b': 2,
			'c': 3
		};
		var keys = Object.keys(arr);
		var it = Iterator(arr);
		var testIndex = 0;

		iterate(it, function (value) {
			expect(value).toEqual(arr[keys[testIndex++]]);
		}, done);
	});

	it('should iterate over any object with \'next\' function', function (done) {
		var iterable = {
			next: Iterator.func(function () {return 42})
		};
		var it = Iterator(iterable);
		var testIndex = 0;

		iterate(it, function (value) {
			expect(value).toEqual(42);
			++testIndex;
		}, function () {
			//one iteration
			expect(testIndex).toEqual(1);
			done();
		});
	});

	it('should iterate over any function', function (done) {
		function gen() { return 42; }

		var it = Iterator(gen);
		var testIndex = 0;

		iterate(it, function (value) {
			expect(value).toEqual(42);
			++testIndex;
		}, function () {
			//one iteration
			expect(testIndex).toEqual(1);
			done();
		});
	});

	it('can start from any index', function (done) {
		var arr = [1, 2, 3];
		var startIndex = 1, testIndex = 0;
		var it = Iterator(arr, startIndex);

		iterate(it, function (value) {
			expect(value).toEqual(arr[startIndex + testIndex]);
			++testIndex;
		}, function () {
			expect(testIndex).toEqual(arr.length - startIndex);
			done();
		});
	});

	it('can stop at any index', function (done) {
		var arr = [1, 2, 3];
		var startIndex = 1, endIndex = 2, testIndex = 0;
		var it = Iterator(arr, startIndex, endIndex);

		iterate(it, function (val) {
			expect(val).toEqual(arr[startIndex + testIndex]);
			++testIndex;
		}, function () {
			expect(testIndex).toEqual(endIndex - startIndex);
			done();
		});
	});

	it('negative start index counts from end', function (done) {
		var arr = [1, 2, 3, 4, 5];
		//negative begin index counts from end
		var startIndex = -2, testIndex = 0;
		var it = Iterator(arr, startIndex);

		iterate(it, function (value) {
			expect(value).toEqual(arr[arr.length + startIndex + testIndex]);
			++testIndex;
		}, function () {
			expect(testIndex).toEqual(-startIndex);
			done();
		});
	});

	it('handles negative end range indexes', function (done) {
		var arr = [1, 2, 3, 4, 5];
		//negative end index counts from end
		var startIndex = 0, endIndex = -4, testIndex = 0;
		var it = Iterator(arr, startIndex, endIndex);

		iterate(it, function (val) {
			expect(val).toEqual(arr[startIndex + testIndex]);
			++testIndex;
		}, function () {
			expect(testIndex).toEqual(arr.length + endIndex - startIndex);
			done();
		});
	});

	it('handles start index larger than stop', function (done) {
		var spy = jasmine.createSpy('spy');
		var arr = [1, 2, 3, 4, 5];
		//begin index trims to end if larger
		var startIndex = 3, endIndex = 1;
		var it = Iterator(arr, startIndex, endIndex);

		iterate(it, spy, function () {
			expect(spy).not.toHaveBeenCalled();
			done();
		});
	});

	it('handles end index larger than length', function (done) {
		var arr = [1, 2, 3];
		//end index trims to iterable.length if larger
		var startIndex = 0, endIndex = 42, testIndex = 0;
		var it = Iterator(arr, startIndex, endIndex);

		iterate(it, function (val) {
			expect(val).toEqual(arr[startIndex + testIndex]);
			++testIndex;
		}, function () {
			expect(testIndex).toEqual(arr.length - startIndex);
			done();
		});
	});

	it('should return \'undefined\' after \'done\'', function (done) {
		var arr = [1, 2, 3];
		var it = Iterator(arr);

		iterate(it, null, function () {
			it.next(function (iteration) {
				expect(iteration.done).toEqual(true);
				iteration.value.then(function (val) {
					expect(val).toBeUndefined();
					done();
				})
			})
		})
	});

	it('should allow to map iterator', function (done) {
		var arr = [1, 2, 3];
		var testIndex = 0;
		var it = Iterator(arr).map(multBy2);

		iterate(it, function (val) {
			expect(val).toEqual(multBy2(arr[testIndex++]));
		}, done);
	});

	it('should not invoke map function if \'iterable.length\' is 0', function (done) {
		var spy = jasmine.createSpy('spy');
		var arr = [];
		var it = Iterator(arr).map(spy);

		iterate(it, spy, function () {
			expect(spy).not.toHaveBeenCalled();
			done();
		})
	});

	it('should allow to chain map iterators', function (done) {
		var arr = [1, 2, 3];
		var testIndex = 0;
		var it = Iterator(arr).map(multBy2).map(multBy2);

		iterate(it, function (val) {
			expect(val).toEqual(arr[testIndex++] * 4);
		}, done);
	});

	it('should not invoke chained map functions if \'iterable.length\' is 0', function (done) {
		var spy = jasmine.createSpy('spy');
		var arr = [];
		var it = Iterator(arr).map(spy).map(spy);

		iterate(it, null, function () {
			expect(spy).not.toHaveBeenCalled();
			done();
		});
	});

	it('allows to filter iterator', function (done) {
		var arr = [1, 2, 3];
		var arrCompare = arr.filter(flt);
		var testIndex = 0;
		var it = Iterator(arr).filter(flt);

		iterate(it, function test(val) {
			expect(val).toEqual(arrCompare[testIndex++]);
		}, done);

		function flt(val) {
			return val >= 2;
		}
	});

	it('does not invoke \'filter\' function if iterable.length is 0', function (done) {
		var spy = jasmine.createSpy('spy');
		var arr = [];
		var it = Iterator(arr).filter(spy);

		iterate(it, null, function () {
			expect(spy).not.toHaveBeenCalled();
			done();
		})
	});

	it('allows to chain \'map\' and \'filter\'', function (done) {
		var arr = [1, 2, 3, 4, 5];
		var arrCompare = arr.map(mp).filter(flt);
		var testIndex = 0;

		var it = Iterator(arr).map(mp).filter(flt);

		iterate(it, function (val) {
			expect(val).toEqual(arrCompare[testIndex++]);
		}, done);

		function flt(val) { return val > 2; }

		function mp(val) { return val * 2; }
	});

	it('allows to chain \'filter\' and \'map\'', function (done) {
		var arr = [1, 2, 3, 4, 5];
		var arrCompare = arr.filter(flt).map(mp);
		var testIndex = 0;

		var it = Iterator(arr).filter(flt).map(mp);

		iterate(it, function (val) {
			expect(val).toEqual(arrCompare[testIndex++]);
		}, done);

		function flt(val) { return val > 2; }

		function mp(val) { return val * 2; }
	});

	it('allows \'reduce\' iterator', function (done) {
		var arr = [1, 2, 3];
		var testIndex = 0;
		var it = Iterator(arr).reduce(accumulate, 0);

		iterate(it, function (val) {
			expect(val).toEqual(6);
			++testIndex;
		}, function () {
			expect(testIndex).toEqual(1);
			done();
		});
	});

	it('allows empty \'reduce\' to return initial value', function (done) {
		var arr = [1, 2, 3];
		var testIndex = 0, startValue = 1;
		var it = Iterator(arr).reduce(null, startValue);

		iterate(it, function (val) {
			expect(val).toEqual(startValue);
			++testIndex;
		}, function () {
			expect(testIndex).toEqual(1);
			done();
		});
	});

	it('allows to \'flatten\' arrays', function (done) {
		var arr = [1, [2, 3, []], 4, [5, [6]]];
		var it = Iterator(arr)
			.flatten()
			.reduce(accumulate, 0);

		iterate(it, function (val) {
			expect(val).toEqual(21);
		}, done);
	});

	it('allows to \'flatten\' any iterables', function (done) {
		var arr = [gen, {next: Iterator.func(gen)}, [3, {v1: 4, v2: gen}, [Iterator([2, 3])]], {}, 4, [5, [6]]];
		var it = Iterator(arr)
			.flatten()
			.reduce(accumulate, 0);

		iterate(it, function (val) {
			expect(val).toEqual(42);
		}, done);

		function gen() {return 5;}
	});

	it('allows to \'cycle\' any iterators', function (done) {
		var arr = [1, 2, 3];
		var it = Iterator(arr)
			.cycle(3)
			.reduce(accumulate, 0);

		iterate(it, function (val) {
			expect(val).toEqual(18);
		}, done);
	});

	it('allows to chain \'cycle\' iterators', function (done) {
		var arr = [1, 2, 3];
		var it = Iterator(arr)
			.cycle(3)
			.cycle(3)
			.reduce(accumulate, 0);

		iterate(it, function (val) {
			expect(val).toEqual(54);
		}, done);
	});

	it('allows to chain \'map\', \'filter\' and \'reduce\'', function (done) {
		var arr = [1, 2, 3, 4];
		var it = Iterator(arr)
			.map(multBy2)
			.filter(function (val) {
				return val > 4;
			})
			.reduce(accumulate, 0);

		iterate(it, function (val) {
			expect(val).toEqual(14);
		}, done);
	});

	it('allows \'map\' handler to catch errors thrown in uplevel handlers', function (done) {
		var spy = jasmine.createSpy('spy');
		var errSpy = jasmine.createSpy('errSpy');

		var arr = [1, 2, 3, 4];
		var it = Iterator(arr)
			.map(throwFunc)
			.map(spy, errSpy)
			.reduce();

		iterate(it, null, function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errSpy).toHaveBeenCalledTimes(arr.length);
			done();
		});

	});

	it('allows \'filter\' handler to catch errors thrown in uplevel handlers', function (done) {
		var spy = jasmine.createSpy('spy');
		var errSpy = jasmine.createSpy('errSpy');

		var arr = [1, 2, 3, 4];
		var it = Iterator(arr)
			.map(throwFunc)
			.filter(spy, errSpy)
			.reduce();

		iterate(it, null, function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errSpy).toHaveBeenCalledTimes(arr.length);
			done();
		});

	});

	it('allows \'catch\' to handle errors thrown in uplevel handlers', function (done) {
		var errSpy = jasmine.createSpy('errSpy');

		var arr = [1, 2, 3, 4];
		var it = Iterator(arr)
			.map(throwFunc)
			.catch(errSpy)
			.reduce();

		iterate(it, null, function () {
			expect(errSpy).toHaveBeenCalledTimes(arr.length);
			done();
		});

	});

	it('allows \'catch\' to resolve values', function (done) {
		var arr = [1, 2, 3, 4];
		var testIndex = 0;
		var it = Iterator(arr)
			.map(throwFunc)
			.catch(function () {
				return arr[testIndex++];
			})
			.reduce(accumulate, 0);

		iterate(it, function (val) {
			expect(val).toEqual(10);
		}, done);
	});

	it('allows empty \'catch\' to resolve values as undefined', function (done) {
		var arr = [1, 2, 3, 4];
		var it = Iterator(arr)
			.map(throwFunc)
			.catch();

		iterate(it, function (val) {
			expect(val).toBeUndefined();
		}, done);
	});

	it('errors propagate without invoking resolvers in chain', function (done) {
		var spy = jasmine.createSpy('spy');

		var arr = [1, 2, 3, 4];
		var it = Iterator(arr)
			.map(throwFunc)
			.map(spy)
			.catch();

		iterate(it, null, function () {
			expect(spy).not.toHaveBeenCalled();
			done();
		});
	});

	it('provides \'iterate\' member function', function (done) {
		var arr = [1, 2, 3];
		var testIndex = 0;

		Iterator(arr).iterate(function (val) {
			expect(val).toEqual(arr[testIndex++]);
		}, done);
	});

	it('allows to convert iterator to Array', function (done) {
		var arr = [1, 2, 3, 4];
		Iterator(arr).toArray(function (result) {
			expect(result).toEqual(arr);
			done();
		});
	});

	it('allows to use SingularSync as value and resolves to its value', function (done) {
		var arr = [
			SS.resolve(1),
			SS.resolve(2),
			SS.resolve(3)
		];
		var testArr = [1, 2, 3];
		var testIndex = 0;

		var it = Iterator(arr);

		iterate(it, function (val) {
			expect(val).toEqual(testArr[testIndex++]);
		}, done);
	});

	it('allows to use SingularAsync as value and resolves to its value', function (done) {
		var arr = [
			SA.resolve(1),
			SA.resolve(2),
			SA.resolve(3)
		];
		var testArr = [1, 2, 3];
		var testIndex = 0;

		var it = Iterator(arr);

		iterate(it, function (val) {
			expect(val).toEqual(testArr[testIndex]);
			++testIndex;
		}, done);
	});

	it('allows to use SingularAsync with deferred resolving', function (done) {
		var arr = [new SA(), new SA()];
		var testArr = [1, 2];
		var testIndex = 0;

		var it = Iterator(arr);

		iterate(it, function (val) {
			expect(val).toEqual(testArr[testIndex]);
			++testIndex;
		}, done);

		setTimeout(function () {
			arr[0].resolve(1);
		}, 200);

		setTimeout(function () {
			arr[1].resolve(2);
		}, 400);
	});
});