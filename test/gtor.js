"use strict";

var gtor = require('../src/gtor');
var SA = gtor.SA;

describe('GTOR Singular Async', function () {

	it('can resolve a value', function (done) {
		var spy = jasmine.createSpy('spy');
		var sa = new SA();

		sa.$get(spy);
		sa.$set(42);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(42);
			done();
		}, 10);
	});

	it('can reject a value', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.$get(spy, errspy);
		sa.$error('err');

		setTimeout(function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errspy).toHaveBeenCalledWith('err');
			done();
		}, 10);
	});

	it('works if resolved before adding a listener', function (done) {
		var sa = new SA();
		sa.$set(42);

		var spy = jasmine.createSpy('spy');
		sa.$get(spy);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(42);
			done();
		}, 10);
	});

	it('does not invoke listeners synchronously', function () {
		var sa = new SA();
		sa.$set(42);

		var spy = jasmine.createSpy('spy');
		sa.$get(spy);

		expect(spy).not.toHaveBeenCalled();
	});

	it('can be resolved at most once', function (done) {
		var spy = jasmine.createSpy('spy');
		var sa = new SA();

		sa.$get(spy);
		sa.$set(42);
		sa.$set(22);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledTimes(1);
			expect(spy).toHaveBeenCalledWith(42);
			done();
		}, 10);
	});

	it('may have multiple callbacks', function (done) {
		var spy1 = jasmine.createSpy('spy1');
		var spy2 = jasmine.createSpy('spy2');

		var sa = new SA();

		sa.$get(spy1);
		sa.$get(spy2);
		sa.$set(42);

		setTimeout(function () {
			expect(spy1).toHaveBeenCalledWith(42);
			expect(spy2).toHaveBeenCalledWith(42);
			done();
		}, 10);
	});

	it('invokes callbacks at most once', function (done) {
		var spy1 = jasmine.createSpy('spy1');
		var spy2 = jasmine.createSpy('spy2');

		var sa = new SA();

		sa.$get(spy1);
		sa.$set(42);

		setTimeout(function () {
			expect(spy1).toHaveBeenCalledWith(42);
			sa.$get(spy2);

			setTimeout(function () {
				expect(spy1).toHaveBeenCalledTimes(1);
				expect(spy2).toHaveBeenCalledWith(42);
				done();
			}, 10);

		}, 10);
	});

	it('cannot resolve once rejected', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.$get(spy, errspy);
		sa.$error('err');

		setTimeout(function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errspy).toHaveBeenCalledWith('err');

			sa.$set(42);

			setTimeout(function () {
				expect(spy).not.toHaveBeenCalled();
				expect(errspy).toHaveBeenCalledTimes(1);
				done();
			}, 10);

		}, 10);
	});

	it('does not require full listener set on resolve', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.$get(spy);
		sa.$get(null, errspy);
		sa.$set(42);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(42);
			expect(errspy).not.toHaveBeenCalled();
			done();
		}, 10);
	});

	it('does not require full listener set on reject', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.$get(spy);
		sa.$get(null, errspy);
		sa.$error('err');

		setTimeout(function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errspy).toHaveBeenCalledWith('err');
			done();
		}, 10);
	});

	it('invokes \'done\' function when resolved', function (done) {
		var donespy = jasmine.createSpy('donespy');

		var sa = new SA();

		sa.$get(null, null, donespy);
		sa.$set(42);

		setTimeout(function () {
			expect(donespy).toHaveBeenCalledWith(42);
			done();
		}, 10);
	});

	it('invokes \'done\' function when rejected', function (done) {
		var donespy = jasmine.createSpy('donespy');

		var sa = new SA();

		sa.$get(null, null, donespy);
		sa.$error('err');

		setTimeout(function () {
			expect(donespy).toHaveBeenCalledWith(undefined);
			done();
		}, 10);
	});

	it('allows chaining handlers', function (done) {
		var spy = jasmine.createSpy('spy');

		var sa = new SA();

		sa.$get(function (val) {
			return val + 1;
		}).$get(function (val) {
			return val * 2;
		}).$get(spy);

		sa.$set(20);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(42);
			done();
		});
	});

	it('does not modify original values in chain', function (done) {
		var spy = jasmine.createSpy('spy');

		var sa = new SA();

		sa.$get(function (val) {
			return val + 1;
		}).$get(function (val) {
			return val * 2;
		});
		sa.$get(spy);

		sa.$set(20);

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(20);
			done();
		});
	});

	it('propagates value in chain', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.$get(null, errspy).$get(spy);

		sa.$set(42);

		setTimeout(function () {
			expect(errspy).not.toHaveBeenCalled();
			expect(spy).toHaveBeenCalledWith(42);
			done();
		});
	});

	it('propagates rejection in chain', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.$get(spy).$get(spy).$get(null, errspy);

		sa.$error('err');

		setTimeout(function () {
			expect(spy).not.toHaveBeenCalled();
			expect(errspy).toHaveBeenCalledWith('err');
			done();
		});
	});

	it('treats \'error\' function return value as resolution', function (done) {
		var spy = jasmine.createSpy('spy');
		var errspy = jasmine.createSpy('errspy');

		var sa = new SA();

		sa.$get(null, function () {return 42;}).$get(spy);

		sa.$error('err');

		setTimeout(function () {
			expect(spy).toHaveBeenCalledWith(42);
			expect(errspy).toHaveBeenCalledWith('err');
			done();
		});
	});
});