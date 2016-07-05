"use strict";

var why = require('why-is-node-running');

var SS = require('../src/gtor_singular_sync');

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