"use strict";

var cps = require('../src/cps');

describe('CPS', function () {

	it('visits array sequentially and synchronously', function () {
		var arr = [1, 2, 3];
		var index = 0;

		cps.visitArraySequentialSync(arr, function (val) {
			//check sequentiality
			expect(val).toEqual(arr[index++]);
		});

		//check synchronous
		expect(index).toEqual(arr.length);
	});

	it('maps array sequentially and synchronously', function () {
		var arr = [1, 2, 3];
		var index = 0;

		var result = cps.mapArraySequentialSync(arr, function (val) {
			//check sequentiality
			expect(val).toEqual(arr[index++]);
			return val * 2;
		});

		//check synchronous
		expect(index).toEqual(arr.length);

		//check mapping
		expect(result).toEqual([2, 4, 6]);
	});

	it('visits array sequentially and asynchronously', function (done) {
		var arr = [1, 2, 3];
		var index = 0;

		cps.visitArraySequentialAsync(arr, function (val, i, arr, done) {
			//check sequentiality
			expect(val).toEqual(arr[index++]);
			setTimeout(done, 100);
		}, done);

		//check asynchronous
		expect(index).toEqual(0);
	});

	it('maps array sequentially and asynchronously', function (done) {
		var arr = [1, 2, 3];
		var index = 0;

		cps.mapArraySequentialAsync(arr, function (val, i, arr, done) {
			//check sequentiality
			expect(val).toEqual(arr[index++]);

			//delay visitor return
			setTimeout(function () {
				done(val * 2);
			}, 100);
		}, function (result) {
			//check mapping
			expect(result).toEqual([2, 4, 6]);
			done();
		});

		//check asynchronous
		expect(index).toEqual(0);
	});

	it('maps array sequentially and asynchronously with immediate result', function (done) {
		var arr = [1, 2, 3];

		var immediateResult = cps.mapArraySequentialAsync(arr, function (val, i, arr, done) {
			done(val * 2);
		}, function (result) {
			//check same object
			expect(result).toBe(immediateResult);
			done();
		});

		//check asynchronous
		expect(immediateResult).toEqual(new Array(arr.length));
	});

	it('maps array parallel and asynchronously', function (done) {
		var arr = [1, 2, 3];
		var index = 0;

		cps.mapArrayParallelAsync(arr, function (val, i, arr, done) {

			//delay visitor return
			setTimeout(function () {
				done(val * 2);
			}, 100);
		}, function (result) {
			//check mapping
			expect(result).toEqual([2, 4, 6]);

			done();
		});

		//check asynchronous
		expect(index).toEqual(0);
	});

	it('maps array parallel and asynchronously with immediate result', function (done) {
		var arr = [1, 2, 3];

		var immediateResult = cps.mapArrayParallelAsync(arr, function (val, i, arr, done) {
			done(val * 2);
		}, function (result) {
			//check same object
			expect(result).toBe(immediateResult);
			done();
		});

		//check asynchronous
		expect(immediateResult).toEqual(new Array(arr.length));
	});

	it('visits tree sequentially and synchronously', function () {
		var arr = [[1, 2], [[], [3, 4, []], 5], 6];
		var index = 0;
		var mult = 1;

		cps.visitTreeSequentialSync(arr, function (val) {
			//check sequentiality
			mult *= val;
			++index;
		});

		//check synchronous
		expect(index).toEqual(6);
		expect(mult).toEqual(720);
	});

	it('maps tree sequentially and synchronously', function () {
		var arr = [[1, 2], [[], [3, 4, []], 5], 6];
		var index = 0;
		var mult = 1;

		var result = cps.mapTreeSequentialSync(arr, function (val) {
			//check sequentiality
			mult *= val;
			++index;

			return val * 2;
		});

		//check synchronous
		expect(index).toEqual(6);
		expect(mult).toEqual(720);

		//check result
		expect(result).toEqual([[2, 4], [[], [6, 8, []], 10], 12]);
	});

	it('visits tree sequentially and asynchronously', function (done) {
		var arr = [[1, 2], [[], [3, 4, []], 5], 6];
		var index = 0;
		var mult = 1;

		cps.visitTreeSequentialAsync(arr, function (val, i, arr, done) {
			//check sequentiality
			++index;
			mult *= val;

			//delay visitor return
			setTimeout(done, 100);
		}, function () {
			//check asynchronous
			expect(index).toEqual(6);
			//check sequentiality
			expect(mult).toEqual(720);

			done();
		});

		//check asynchronous
		expect(index).toEqual(0);
		expect(mult).toEqual(1);
	});

	it('maps tree sequentially and asynchronously', function (done) {
		var arr = [[1, 2], [[], [3, 4, []], 5], 6];
		var index = 0;
		var mult = 1;

		cps.mapTreeSequentialAsync(arr, function (val, i, arr, done) {
			//check sequentiality
			mult *= val;
			++index;

			//delay visitor return
			setTimeout(function () {
				done(val * 2);
			}, 100);
		}, function (result) {
			//check asynchronous
			expect(index).toEqual(6);
			//check sequentiality
			expect(mult).toEqual(720);
			//check result
			expect(result).toEqual([[2, 4], [[], [6, 8, []], 10], 12]);

			done();
		});

		//check asynchronous
		expect(index).toEqual(0);
		expect(mult).toEqual(1);
	});

	it('maps tree sequentially and asynchronously with immediate result', function (done) {
		var arr = [[1, 2], [[], [3, 4, []], 5], 6];

		var immediateResult = cps.mapTreeSequentialAsync(arr, function (val, i, arr, done) {
			done(val * 2);
		}, function (result) {
			//check same object
			expect(result).toBe(immediateResult);
			done();
		});
	});

	it('maps tree parallel and asynchronously', function (done) {
		var arr = [[1, 2], [[], [3, 4, []], 5], 6];

		cps.mapTreeSequentialAsync(arr, function (val, i, arr, done) {
			//delay visitor return
			setTimeout(function () {
				done(val * 2);
			}, 100);
		}, function (result) {
			//check result
			expect(result).toEqual([[2, 4], [[], [6, 8, []], 10], 12]);

			done();
		});
	});

	it('maps tree parallel and asynchronously with immediate result', function (done) {
		var arr = [[1, 2], [[], [3, 4, []], 5], 6];

		var immediateResult = cps.mapTreeSequentialAsync(arr, function (val, i, arr, done) {
			done(val * 2);
		}, function (result) {
			//check same object
			expect(result).toBe(immediateResult);

			done();
		});
	});
});