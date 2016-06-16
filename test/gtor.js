"use strict";

var why = require('why-is-node-running');

var gtor = require('../src/gtor');
var SS = gtor.SingularSync;
var SA = gtor.SingularAsync;


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