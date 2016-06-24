"use strict";

var why = require('why-is-node-running');

var gtor = require('../src/gtor');
var SS = gtor.SingularSync;
var SA = gtor.SingularAsync;
var Iterator = gtor.Iterator;


describe('GTOR Singular Sync', function () {

	it('can resolve a value', function () {
		var spy = jasmine.createSpy('spy');
		var ss = new SS();

		ss.resolve(42);
		ss.then(spy);

		expect(spy).toHaveBeenCalledWith(42);
	});

	it('can reject a value', function () {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');
		var ss = new SS();

		ss.reject('err');
		ss.then(spy, errspy);

		expect(spy).not.toHaveBeenCalled();
		expect(errspy).toHaveBeenCalledWith('err');
	});

	it('rejects itself if value is taken before resolved or rejected', function () {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');
		var ss = new SS();

		ss.then(spy, errspy);
		ss.resolve(42);

		expect(spy).not.toHaveBeenCalled();
		expect(errspy).toHaveBeenCalled();
	});

	it('can be resolved at most once', function () {
		var spy = jasmine.createSpy('spy');
		var ss = new SS();

		ss.resolve(42);
		ss.resolve(22);
		ss.then(spy);

		expect(spy).toHaveBeenCalledWith(42);
	});

	it('cannot resolve once rejected', function () {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var ss = new SS();

		ss.reject('err');
		ss.then(spy, errspy);

		expect(spy).not.toHaveBeenCalled();
		expect(errspy).toHaveBeenCalledWith('err');

		ss.resolve(42);
		ss.then(spy, errspy);

		expect(spy).not.toHaveBeenCalled();
	});
});

describe('GTOR Singular Async', function () {

	//afterAll(why);

	it('can resolve a value', function (done) {
		var spy = jasmine.createSpy('spy');
		var sa = new SA();

		sa.then(spy);
		sa.resolve(42);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(42);
			done();
		}, 100);
	});

	it('can reject a value', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.then(spy, errspy);
		sa.reject('err');

		setTimeout(function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errspy).toHaveBeenCalledWith('err');
			done();
		}, 100);
	});

	it('works if resolved before adding a listener', function (done) {
		var sa = new SA();
		sa.resolve(42);

		var spy = jasmine.createSpy('spy');
		sa.then(spy);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(42);
			done();
		}, 100);
	});

	it('does not invoke listeners synchronously', function () {
		var sa = new SA();
		sa.resolve(42);

		var spy = jasmine.createSpy('spy');
		sa.then(spy);

		expect(spy).not.toHaveBeenCalled();
	});

	it('can be resolved at most once', function (done) {
		var spy = jasmine.createSpy('spy');
		var sa = new SA();

		sa.then(spy);
		sa.resolve(42);
		sa.resolve(22);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledTimes(1);
			expect(spy).toHaveBeenCalledWith(42);
			done();
		}, 100);
	});

	it('may have multiple callbacks', function (done) {
		var spy1 = jasmine.createSpy('spy1');
		var spy2 = jasmine.createSpy('spy2');

		var sa = new SA();

		sa.then(spy1);
		sa.then(spy2);
		sa.resolve(42);

		setTimeout(function () {
			expect(spy1).toHaveBeenCalledWith(42);
			expect(spy2).toHaveBeenCalledWith(42);
			done();
		}, 100);
	});

	it('invokes callbacks at most once', function (done) {
		var spy1 = jasmine.createSpy('spy1');
		var spy2 = jasmine.createSpy('spy2');

		var sa = new SA();

		sa.then(spy1);
		sa.resolve(42);

		setTimeout(function () {
			expect(spy1).toHaveBeenCalledWith(42);
			sa.then(spy2);

			setTimeout(function () {
				expect(spy1).toHaveBeenCalledTimes(1);
				expect(spy2).toHaveBeenCalledWith(42);
				done();
			}, 100);

		}, 100);
	});

	it('cannot resolve once rejected', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.then(spy, errspy);
		sa.reject('err');

		setTimeout(function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errspy).toHaveBeenCalledWith('err');

			sa.resolve(42);

			setTimeout(function () {
				expect(spy).not.toHaveBeenCalled();
				expect(errspy).toHaveBeenCalledTimes(1);
				done();
			}, 100);

		}, 100);
	});

	it('does not require full listener set on resolve', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.then(spy);
		sa.then(null, errspy);
		sa.resolve(42);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(42);
			expect(errspy).not.toHaveBeenCalled();
			done();
		}, 100);
	});

	it('does not require full listener set on reject', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.then(spy);
		sa.then(null, errspy);
		sa.reject('err');

		setTimeout(function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errspy).toHaveBeenCalledWith('err');
			done();
		}, 100);
	});

	it('invokes \'done\' function when resolved', function (done) {
		var donespy = jasmine.createSpy('donespy');

		var sa = new SA();

		sa.then(null, null, donespy);
		sa.resolve(42);

		setTimeout(function () {
			expect(donespy).toHaveBeenCalledWith(42);
			done();
		}, 100);
	});

	it('invokes \'done\' function when rejected', function (done) {
		var donespy = jasmine.createSpy('donespy');

		var sa = new SA();

		sa.then(null, null, donespy);
		sa.reject('err');

		setTimeout(function () {
			expect(donespy).toHaveBeenCalled();
			done();
		}, 100);
	});

	it('allows chaining handlers', function (done) {
		var spy = jasmine.createSpy('spy');

		var sa = new SA();

		sa.then(function (val) {
			return val + 1;
		}).then(function (val) {
			return val * 2;
		}).then(spy);

		sa.resolve(20);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(42);
			done();
		}, 100);
	});

	it('does not modify original values in chain', function (done) {
		var spy = jasmine.createSpy('spy');

		var sa = new SA();

		sa.then(function (val) {
			return val + 1;
		}).then(function (val) {
			return val * 2;
		});
		sa.then(spy);

		sa.resolve(20);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(20);
			done();
		}, 100);
	});

	it('propagates value in chain', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa
		//.then(null, errspy)
			.catch(errspy)
			.catch(errspy)
			.then(spy);

		sa.resolve(42);

		setTimeout(function () {
			expect(errspy).not.toHaveBeenCalled();
			expect(spy).toHaveBeenCalledWith(42);
			done();
		}, 100);
	});

	it('propagates rejection in chain', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa
			.then(spy)
			.then(spy)
			//.then(null, errspy);
			.catch(errspy);

		sa.reject('err');

		setTimeout(function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errspy).toHaveBeenCalledWith('err');
			done();
		}, 100);
	});

	it('treats \'error\' function return value as resolution', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa
			.then(null, function () { return 42; })
			.then(spy, errspy);

		sa.reject('err');

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(42);
			expect(errspy).not.toHaveBeenCalled();
			done();
		}, 100);
	});

	it('rejects chained value when listener throws', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.then(function () {
			throw new Error('');
		}).then(spy, errspy);

		sa.resolve(42);

		setTimeout(function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errspy).toHaveBeenCalled();
			done();
		}, 100);
	});

	it('does not reject current value when listener throws', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.then(function () {
			throw 'err';
		}, errspy).then(spy);

		sa.then(function (val) {
			expect(val).toEqual(42);
		});

		sa.resolve(42);

		setTimeout(function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errspy).not.toHaveBeenCalled();
			done();
		}, 100);
	});

	it('waits on \'sa\' value returned from listener, and resolves to its value', function (done) {
		var sa = new SA();

		sa.then(function (val) {
			var saVal = new SA();

			//resolve later
			setTimeout(function () {
				saVal.resolve(val * 2);
			}, 100);

			return saVal;
		}).then(function (val) {
			expect(val).toEqual(42);
			done();
		});

		sa.resolve(21);
	});

	it('waits on \'sa\' value returned from listener, and gets its error', function (done) {
		var spy = jasmine.createSpy('spy');

		var sa = new SA();

		sa.then(function () {
			var saVal = new SA();

			//reject later
			setTimeout(function () {
				saVal.reject('err');
			}, 100);

			return saVal;
		}).then(spy, function (e) {
			expect(spy).not.toHaveBeenCalled();
			expect(e).toEqual('err');
			done();
		});

		sa.resolve(21);
	});
});

describe('GTOR Iterator', function () {

	it('should iterate over array', function () {
		var arr = [1, 2, 3];
		var it = new Iterator(arr);

		for (var i = 0; i < arr.length; ++i) {
			expect(it.next()).toEqual(arr[i]);
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
			expect(it.next()).toEqual(arr[i]);
		}
	});

	it('can start from any index', function () {
		var arr = [1, 2, 3];
		var it = new Iterator(arr, 1);

		expect(it.next()).toEqual(2);
	});

	it('provides \'begin\' property', function () {
		var arr = [1, 2, 3];
		var it = Iterator.begin(arr);

		expect(it.$$index).toEqual(0);
	});

	it('provides \'end\' property', function () {
		var arr = [1, 2, 3];
		var it = Iterator.end(arr);

		expect(it.$$index).toEqual(arr.length);
	});

	it('provides \'isDone\' property', function () {
		var arr = [1, 2, 3];
		var it = Iterator.begin(arr);

		expect(it.isDone).toBeDefined();
		for (var i = 0; i < arr.length; ++i) {
			expect(it.isDone()).toEqual(false);
			it.next();
		}
		expect(it.isDone()).toEqual(true);
	});

	it('should have index set to array.length after \'isDone\'', function () {
		var arr = [1, 2, 3];
		var it = Iterator.begin(arr);

		while (!it.isDone()) {
			it.next();
		}

		//call next more times
		it.next();
		it.next();

		expect(it.$$index).toEqual(arr.length);
	});

	it('should return \'undefined\' after \'isDone\'', function () {
		var arr = [1, 2, 3];
		var it = Iterator.begin(arr);

		while (!it.isDone()) {
			it.next();
		}

		expect(it.next()).toBeUndefined();
	});

	it('should allow to map iterator', function () {
		var arr = [1, 2, 3];
		var it = Iterator.begin(arr)
			.map(function (val, index) {
				expect(val).toEqual(arr[index]);
				return val * 2;
			});

		for (var i = 0; i < arr.length; ++i) {
			expect(it.next()).toEqual(arr[i] * 2);
		}
	});

	it('should not invoke map function if \'iterable.length\' is 0', function () {
		var spy = jasmine.createSpy('spy');
		var arr = [];
		var it = Iterator.begin(arr)
			.map(spy);

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
			expect(it.next()).toEqual(arr[i] * 4);
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
			expect(it.next()).toEqual(arrCompare[i]);
		}
	});

	it('does not invoke \'filter\' function if iterable.length is 0', function () {
		var spy = jasmine.createSpy('spy');
		var arr = [];
		var it = Iterator.begin(arr)
			.filter(spy);

		it.next();

		expect(spy).not.toHaveBeenCalled();
	});

	it('allows to chain \'map\' and \'filter\'', function () {
		var arr = [1, 2, 3, 4, 5];
		var arrCompare = arr.map(mp).filter(flt);

		var it = Iterator.begin(arr).map(mp).filter(flt);

		for (var i = 0; i < arrCompare.length; ++i) {
			expect(it.next()).toEqual(arrCompare[i]);
		}

		function flt(val) {
			return val > 2;
		}

		function mp(val) {
			return val * 2;
		}
	});

	it('allows to chain \'filter\' and \'map\'', function () {
		var arr = [1, 2, 3, 4, 5];
		var arrCompare = arr.filter(flt).map(mp);

		var it = Iterator.begin(arr).filter(flt).map(mp);

		for (var i = 0; i < arrCompare.length; ++i) {
			expect(it.next()).toEqual(arrCompare[i]);
		}

		function flt(val) {
			return val > 2;
		}

		function mp(val) {
			return val * 2;
		}
	});

	it('allows \'reduce\' iterator', function () {
		var arr = [1, 2, 3];
		var val = Iterator.begin(arr)
			.reduce(function (acc, val, index) {
				expect(val).toEqual(arr[index]);
				return acc + val;
			}, 0);

		expect(val).toEqual(6);
	});

	it('allows to chain \'map\', \'filter\' and \'reduce\'', function () {
		var arr = [1, 2, 3, 4];
		var val = Iterator.begin(arr)
			.map(function (val) {
				return val * 2;
			})
			.filter(function (val) {
				return val > 4;
			})
			.reduce(function (acc, val, index) {
				return acc + val;
			}, 0);

		expect(val).toEqual(14);
	});
});