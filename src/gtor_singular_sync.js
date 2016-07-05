"use strict";

var _ = require('lodash');
var prereq = require('./gtor_singular_prereq');

var SingularStatusEnum = prereq.SingularStatusEnum;
var initialValue = prereq.initialValue;

function SingularSync() {
	this.$$value = initialValue();
	this.$$status = SingularStatusEnum.PENDING;
	this.producer = {
		resolve: _.bind(this.resolve, this),
		reject: _.bind(this.reject, this)
	};
	this.consumer = {
		'then': _.bind(this.then, this),
		'catch': _.bind(this.catch, this),
		'finally': _.bind(this.finally, this)
	}
}

SingularSync.resolve = function (val) {
	var ss = new SingularSync();
	ss.resolve(val);
	return ss;
};

SingularSync.reject = function (reason) {
	var ss = new SingularSync();
	ss.reject(reason);
	return ss;
};

SingularSync.prototype.isPending = prereq.singularIsPending;
SingularSync.prototype.isResolved = prereq.singularIsResolved;
SingularSync.prototype.isRejected = prereq.singularIsRejected;

SingularSync.prototype.then = function (resolveHandler, rejectHandler, doneHandler) {
	var result = new SingularSync();
	if (this.isResolved()) {
		if (_.isFunction(resolveHandler)) {
			try {
				result.resolve(resolveHandler(this.$$value));
			} catch (e) {
				result.reject(e);
			}
		} else {
			result.resolve(this.$$value);
		}
	} else if (this.isRejected()) {
		if (_.isFunction(rejectHandler)) {
			try {
				result.resolve(rejectHandler(this.$$value));
			} catch (e) {
				result.reject(e);
			}
		} else {
			result.reject(this.$$value);
		}
	} else {
		//must be resolved
		this.reject('this is not resolved or rejected');
		return this.then(resolveHandler, rejectHandler, doneHandler);
	}

	if (_.isFunction(doneHandler)) {
		this.isResolved() ? doneHandler(this.$$value) : doneHandler();
	}

	return result.consumer;
};

SingularSync.prototype.catch = function (handler) {
	return this.then(null, handler);
};

SingularSync.prototype.finally = function (handler) {
	if (_.isFunction(handler)) {
		this.isResolved() ? handler(this.$$value) : handler();
	}
	return this.consumer();
};

SingularSync.prototype.resolve = function (val) {
	if (this.isPending()) {
		this.$$value = val;
		this.$$status = SingularStatusEnum.RESOLVED;
	}
};

SingularSync.prototype.reject = function (val) {
	if (this.isPending()) {
		this.$$value = val;
		this.$$status = SingularStatusEnum.REJECTED;
	}
};

module.exports = SingularSync;