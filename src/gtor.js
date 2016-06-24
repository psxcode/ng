"use strict";

var _ = require('lodash');

var SingularStatusEnum = {
	PENDING: 0,
	RESOLVED: 1,
	REJECTED: 2
};

function singularIsPending() {
	return this.$$status === SingularStatusEnum.PENDING;
}

function singularIsResolved() {
	return this.$$status === SingularStatusEnum.RESOLVED;
}

function singularIsRejected() {
	return this.$$status === SingularStatusEnum.REJECTED;
}

var SingularSync = (function () {

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

	SingularSync.prototype.isPending = singularIsPending;
	SingularSync.prototype.isResolved = singularIsResolved;
	SingularSync.prototype.isRejected = singularIsRejected;

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
			return this.reject('this is not resolved or rejected').then(resolveHandler, rejectHandler, doneHandler);
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
		return this;
	};

	SingularSync.prototype.reject = function (val) {
		if (this.isPending()) {
			this.$$value = val;
			this.$$status = SingularStatusEnum.REJECTED;
		}
		return this;
	};

	return SingularSync;
}());

var SingularAsync = (function () {

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

	SingularAsync.prototype.isPending = singularIsPending;
	SingularAsync.prototype.isResolved = singularIsResolved;
	SingularAsync.prototype.isRejected = singularIsRejected;

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

	return SingularAsync;
}());


var Iterator = (function () {
	"use strict";

	function Iterator(iterable, index) {
		this.$$iterable = iterable;
		this.$$index = (arguments.length < 2 || !isFinite(index) || index < 0) ? 0 : index >= iterable.length ? iterable.length : index;
	}

	Iterator.begin = function (iterable) {
		return new Iterator(iterable);
	};

	Iterator.end = function (iterable) {
		return new Iterator(iterable, iterable.length);
	};

	Iterator.prototype.diff = function (iterator) {
		return iterator.$$index - this.$$index;
	};

	Iterator.prototype.isDone = function () {
		return this.$$index >= this.$$iterable.length;
	};

	Iterator.prototype.next = function () {
		if (this.$$index > this.$$iterable.length) this.$$index = this.$$iterable.length;
		return (this.$$index < this.$$iterable.length) ? this.$$iterable[this.$$index++] : void 0;
	};

	Iterator.prototype.map = function (fn) {
		var self = this;
		var iter = Object.create(this);

		iter.next = function () {
			return self.isDone() ? self.next() : fn(self.next(), self.$$index - 1);
		};

		return iter;
	};

	Iterator.prototype.filter = function (fn) {
		var self = this;
		var iter = Object.create(this);

		iter.next = function () {
			var value;
			while (!self.isDone() && !fn(value = self.next(), self.$$index - 1));
			return value;
		};

		return iter;
	};

	Iterator.prototype.reduce = function (fn, initialVal) {
		var self = this;
		var lastVal = initialVal;
		while (!self.isDone()) {
			lastVal = fn(lastVal, self.next(), self.$$index - 1);
		}
		return lastVal;
	};

	return Iterator;
}());

function PluralSync() {

}

function PluralAsync() {

}

module.exports.SingularSync = SingularSync;
module.exports.SingularAsync = SingularAsync;
module.exports.Iterator = Iterator;

function initialValue() {
	return void 0;
}