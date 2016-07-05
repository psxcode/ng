"use strict";

var _ = require('lodash');
var prereq = require('./gtor_singular_prereq');

var SingularStatusEnum = prereq.SingularStatusEnum;
var initialValue = prereq.initialValue;

function SAhandler(resolveHandler, rejectHandler, doneHandler) {
	this.res = resolveHandler;
	this.err = rejectHandler;
	this.done = doneHandler;
	this.sa = new SingularAsync();
}

function SingularAsync() {
	this.$$value = initialValue();
	this.$$status = SingularStatusEnum.PENDING;
	this.$$handlers = [];
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

SingularAsync.resolve = function (val) {
	var sa = new SingularAsync();
	sa.resolve(val);
	return sa;
};

SingularAsync.reject = function (reason) {
	var sa = new SingularAsync();
	sa.reject(reason);
	return sa;
};

SingularAsync.all = all;
SingularAsync.any = any;
SingularAsync.race = race;

SingularAsync.prototype.isPending = prereq.singularIsPending;
SingularAsync.prototype.isResolved = prereq.singularIsResolved;
SingularAsync.prototype.isRejected = prereq.singularIsRejected;

SingularAsync.prototype.then = function (resolveHandler, rejectHandler, doneHandler) {
	var handler = new SAhandler(resolveHandler, rejectHandler, doneHandler);
	this.$$handlers.push(handler);

	if (!this.isPending()) {
		this.$$invoke();
	}

	return handler.sa.consumer;
};

SingularAsync.prototype.catch = function (handler) {
	return this.then(null, handler);
};

SingularAsync.prototype.finally = function (handler) {
	this.$$handlers.push(new SAhandler(null, null, handler));

	if (!this.isPending()) {
		this.$$invoke();
	}

	return this.consumer;
};

SingularAsync.prototype.resolve = function (val) {
	//resolve or reject only once
	if (this.isPending()) {
		if (_.isFunction(val.then)) {
			val.then(_.bind(this.resolve, this), _.bind(this.reject, this));
		} else {
			this.$$value = val;
			this.$$status = SingularStatusEnum.RESOLVED;
		}
	}

	if (!this.isPending()) {
		this.$$invoke();
	}
};

SingularAsync.prototype.reject = function (val) {
	//resolve or reject only once
	if (this.isPending()) {
		this.$$value = val;
		this.$$status = SingularStatusEnum.REJECTED;
	}

	this.$$invoke();
};

SingularAsync.prototype.$$invoke = function () {
	var self = this;
	process.nextTick(function () {
		var handler, handlerPropName, saFuncName;
		if (self.isResolved()) {
			handlerPropName = 'res';
			saFuncName = 'resolve';
		} else {
			handlerPropName = 'err';
			saFuncName = 'reject';
		}
		while (self.$$handlers.length) {
			handler = self.$$handlers.shift();
			if (_.isFunction(handler[handlerPropName])) {
				try {
					handler.sa.resolve(handler[handlerPropName](self.$$value));
				} catch (e) {
					handler.sa.reject(e);
				}
			} else {
				handler.sa[saFuncName](self.$$value);
			}
			if (_.isFunction(handler.done)) {
				self.isResolved() ? handler.done(self.$$value) : handler.done();
			}
		}
	});
};

function all(saArray) {
	var values = new Array(saArray.length);
	var result = new SingularAsync();
	var completed = 0;

	_.forEach(saArray, function (sa, index) {
		sa.then(function (val) {
			//values could be invalid
			if (!values) return;

			values[index] = val;
			if (++completed >= values.length) {
				result.resolve(values);
			}
		}, function (e) {
			//release values
			values = null;
			result.reject(e);
		});
	});

	return result.consumer;
}

function any(saArray, rejectValue) {
	var values = new Array(saArray.length);
	var result = new SingularAsync();
	var completed = 0;

	_.forEach(saArray, function (sa, index) {
		sa.then(function (val) {
			values[index] = val;
		}, function () {
			values[index] = rejectValue;
		}).finally(function () {
			if (++completed >= values.length) {
				result.resolve(values);
			}
		});
	});

	return result.consumer;
}

function race(saArray) {
	var result = new SingularAsync();

	for (var i = 0; i < saArray.length; ++i) {
		saArray[i].then(function (val) {
			result.resolve(val);
		});
	}

	return result.consumer;
}

function sequense(saArray) {

}

module.exports = SingularAsync;