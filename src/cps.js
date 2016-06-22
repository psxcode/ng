"use strict";

var _ = require('lodash');

//visitor is synchronous
//function(elem, index, array)

function visitArraySequentialSync(arr, visitor) {
	for (var i = 0; i < arr.length; ++i) {
		visitor(arr[i], i, arr);
	}
}

function mapArraySequentialSync(arr, visitor) {
	var result = new Array(arr.length);
	for (var i = 0; i < arr.length; ++i) {
		result[i] = visitor(arr[i], i, arr);
	}
	return result;
}

//visitor is asynchronous
//function(elem, index, array, done)

function visitArraySequentialAsync(arr, visitor, done) {

	visitNext(0);

	function visitNext(index) {

		setImmediate(visitCurrent);

		function visitCurrent() {
			if (index < arr.length) {
				visitor(arr[index], index, arr, onVisitorDone);
			} else {
				done();
			}
		}

		function onVisitorDone() {
			visitNext(index + 1);
		}
	}
}

//visitor is asynchronous
//function(elem, index, array, done)

function mapArraySequentialAsync(arr, visitor, done) {
	var result = new Array(arr.length);

	visitNext(0);

	//return immediate result
	return result;

	function visitNext(index) {

		setImmediate(visitCurrent);

		function visitCurrent() {
			if (index < arr.length) {
				visitor(arr[index], index, arr, onVisitorDone);
			} else {
				done(result);
			}
		}

		function onVisitorDone(res) {
			result[index] = res;
			visitNext(index + 1);
		}
	}
}

function mapArrayParallelAsync(arr, visitor, done) {
	var result = new Array(arr.length);
	var iterationsComplete = 0;

	setImmediate(function () {
		if (iterationsComplete === result.length) {
			done(result);
		} else {
			for (var i = 0; i < arr.length; ++i) {
				//capturing index
				visitNext(i);
			}
		}
	});

	//return immediate result
	return result;

	function visitNext(index) {
		visitor(arr[index], index, arr, onVisitorDone);

		function onVisitorDone(res) {
			result[index] = res;
			// === prevents multiple 'done' call
			if (++iterationsComplete === result.length) {
				done(result);
			}
		}
	}
}

function visitTreeSequentialSync(tree, visitor) {
	for (var i = 0; i < tree.length; ++i) {
		if (_.isArray(tree[i])) {
			visitTreeSequentialSync(tree[i], visitor);
		} else {
			visitor(tree[i], i, tree);
		}
	}
}

function mapTreeSequentialSync(tree, visitor) {
	var result = new Array(tree.length);
	for (var i = 0; i < tree.length; ++i) {
		if (_.isArray(tree[i])) {
			result[i] = mapTreeSequentialSync(tree[i], visitor);
		} else {
			result[i] = visitor(tree[i], i, tree);
		}
	}
	return result;
}

function visitTreeSequentialAsync(tree, visitor, done) {

	visitNext(tree, 0, done);

	function visitNext(tree, index, done) {

		setImmediate(visitCurrent);

		function visitCurrent() {
			if (index < tree.length) {
				if (_.isArray(tree[index])) {
					visitNext(tree[index], 0, onVisitorDone);
				} else {
					visitor(tree[index], index, tree, onVisitorDone);
				}
			} else {
				done();
			}
		}

		function onVisitorDone() {
			visitNext(tree, index + 1, done);
		}
	}
}

function mapTreeSequentialAsync(tree, visitor, done) {
	var result = new Array(tree.length);

	visitNext(tree, 0, result, done);

	//return immediate result
	return result;

	function visitNext(tree, index, result, done) {

		setImmediate(visitCurrent);

		function visitCurrent() {
			if (index < tree.length) {
				if (_.isArray(tree[index])) {
					visitNext(tree[index], 0, new Array(tree[index].length), onVisitorDone);
				} else {
					visitor(tree[index], index, tree, onVisitorDone);
				}
			} else {
				done(result);
			}
		}

		function onVisitorDone(res) {
			result[index] = res;
			visitNext(tree, index + 1, result, done);
		}
	}
}

function mapTreeParallelAsync(tree, visitor, done) {
	var result = new Array(tree.length);

	var completeCount = 0;

	setImmediate(function () {
		if (completeCount === tree.length) {
			done(result);
		} else {
			for (var i = 0; i < result.length; ++i) {
				visitNext(tree, i, result, onVisitComplete);
			}
		}
	});

	function visitNext(tree, index, result, done) {

		var completeCount = 0;

		if (completeCount < tree.length) {
			if (_.isArray(tree[index])) {
				visitNext(tree[index], 0, new Array(tree[index].length), onVisitorDone);
			} else {
				visitor(tree[index], index, tree, onVisitorDone);
			}
		} else {
			done(result);
		}

		function onVisitorDone(res) {
			result[index] = res;
			if (++completeCount === tree.length) {
				done(result);
			}
		}
	}

	function onVisitComplete() {
		if (++completeCount === tree.length) {
			done(result);
		}
	}
}

exports.visitArraySequentialSync = visitArraySequentialSync;
exports.mapArraySequentialSync = mapArraySequentialSync;
exports.visitArraySequentialAsync = visitArraySequentialAsync;
exports.mapArraySequentialAsync = mapArraySequentialAsync;
exports.mapArrayParallelAsync = mapArrayParallelAsync;
exports.visitTreeSequentialSync = visitTreeSequentialSync;
exports.mapTreeSequentialSync = mapTreeSequentialSync;
exports.visitTreeSequentialAsync = visitTreeSequentialAsync;
exports.mapTreeSequentialAsync = mapTreeSequentialAsync;
exports.mapTreeParallelAsync = mapTreeParallelAsync;


