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

	function Iteration(key, value, error, done) {
		this.key = key;
		this.value = value;
		this.error = error;
		this.done = done;
	}

	Iteration.DONE = new Iteration(void 0, void 0, false, true);
	Iteration.resolve = function (value, key, done) {
		return new Iteration(key, value, false, done || false);
	};
	Iteration.reject = function (reason, key, done) {
		return new Iteration(key, reason, true, done || false);
	};

	function Iterator(iterable, beginIndex, endIndex) {
		this.iterator = null;

		if (!iterable) {
			return Iterator.empty;
		} else if (iterable instanceof Iterator) {
			return iterable;
		} else if (!(this instanceof Iterator)) {
			return new Iterator(iterable, beginIndex, endIndex);
		} else if (_.isArrayLike(iterable)) {
			this.iterator = new IndexIterator(iterable, beginIndex, endIndex);
		} else if (_.isFunction(iterable.next)) {
			this.iterator = iterable;
		} else if (_.isObject(iterable)) {
			this.iterator = new ObjectIterator(iterable);
		} else {
			throw new Error('cannot iterate');
		}
	}

	Iterator.begin = function (iterable) {
		return new Iterator(iterable);
	};

	Iterator.prototype.next = function (resolveHandler, rejectHandler) {
		return this.iterator.next(resolveHandler, rejectHandler);
	};

	Iterator.prototype.done = function () {
		return this.iterator.done();
	};

	Iterator.prototype.pos = function () {
		return this.iterator.pos();
	};

	Iterator.prototype.map = function (fn) {
		return new MapIterator(this, fn);
	};

	Iterator.prototype.filter = function (fn) {
		return new FilterIterator(this, fn);
	};

	Iterator.prototype.reduce = function (fn, initialVal) {
		return new ReduceIterator(this, fn, initialVal);
	};

	var EmptyIterator = (function () {
		function EmptyIterator() {

		}

		EmptyIterator.prototype.next = function () {
			return Iteration.DONE;
		};

		return EmptyIterator;
	}());

	var MapIterator = (function () {

		function MapIterator(iterator, visitor) {
			this.iterator = iterator;
			this.visitor = visitor;
		}

		MapIterator.prototype = Object.create(Iterator.prototype);
		MapIterator.prototype.constructor = MapIterator;

		MapIterator.prototype.next = function (resolveHandler, rejectHandler) {
			var iteration = this.iterator.next();

			//done case
			if (iteration.done) {
				return iteration;
			}

			//error case
			if (iteration.error) {
				if (_.isFunction(rejectHandler)) {
					try {
						return Iteration.resolve(rejectHandler(iteration.value, iteration.key), iteration.key);
					} catch (e) {
						return Iteration.reject(e, iteration.key);
					}
				} else {
					return iteration;
				}
			}

			if (_.isFunction(resolveHandler)) {
				try {
					return Iteration.resolve(resolveHandler(this.visitor(iteration.value, iteration.key), iteration.key));
				} catch (e) {
					return Iteration.reject(e, iteration.key);
				}
			} else {
				return Iteration.resolve(this.visitor(iteration.value, iteration.key), iteration.key);
			}
		};

		return MapIterator;
	}());

	var FilterIterator = (function () {

			function FilterIterator(iterator, visitor) {
				this.iterator = iterator;
				this.visitor = visitor;
			}

			FilterIterator.prototype = Object.create(Iterator.prototype);
			FilterIterator.prototype.constructor = FilterIterator;

			FilterIterator.prototype.next = function (resolveHandler, rejectHandler) {
				while (true) {

					var iteration = this.iterator.next();

					//done case
					if (iteration.done) {
						return iteration;
					}

					//error case
					if (iteration.error) {
						if (_.isFunction(rejectHandler)) {
							try {
								return Iteration.resolve(rejectHandler(iteration.value), iteration.key);
							} catch (e) {
								return Iteration.reject(e, iteration.key);
							}
						} else {
							return iteration;
						}
					}

					try {
						if (this.visitor(iteration.value, iteration.key)) {
							if (_.isFunction(resolveHandler)) {
								return Iteration.resolve(resolveHandler(iteration.value), iteration.key);
							} else {
								return Iteration.resolve(iteration.value, iteration.key);
							}
						}
					}
					catch (e) {
						return Iteration.reject(e, iteration.key);
					}
				}
			};

			return FilterIterator;
		}()
	);

	var ReduceIterator = (function () {

		function ReduceIterator(iterator, visitor, initialValue) {
			this.iterator = iterator;
			this.visitor = visitor;
			this.lastValue = initialValue;
		}

		ReduceIterator.prototype = Object.create(Iterator.prototype);
		ReduceIterator.prototype.constructor = ReduceIterator;

		ReduceIterator.prototype.next = function (resolveHandler, rejectHandler) {

			var iterations = [];
			var iteration = this.iterator.next();
			while (!iteration.done) {
				iterations.push(iteration);
				iteration = this.iterator.next();
			}

			for (var i = 0; i < iterations.length; ++i) {
				iteration = iterations[i];
				if (iteration.error) {
					if (_.isFunction(rejectHandler)) {
						try {
							this.lastValue = this.visitor(this.lastValue, rejectHandler(iteration.value, iteration.key), iteration.key);
						} catch (e) {
							return Iteration.reject(e, iteration.key, true);
						}
					} else {
						return iteration;
					}
				} else {
					try {
						this.lastValue = this.visitor(this.lastValue, iteration.value, iteration.key);
					} catch (e) {
						return Iteration.reject(e, iteration.key, true);
					}
				}
			}

			if (_.isFunction(resolveHandler)) {
				try {
					this.lastValue = resolveHandler(this.lastValue);
				} catch (e) {
					return Iteration.reject(e, void 0, true);
				}
			}

			return Iteration.resolve(this.lastValue, void 0, true);
		};

		return ReduceIterator;
	}());

	var IndexIterator = (function () {

		function IndexIterator(iterable, beginIndex, endIndex) {
			this.iterable = iterable;
			this.index = beginIndex || 0;
			this.end = endIndex || iterable.length;
		}

		IndexIterator.prototype.next = function (resolveHandler) {
			if (this.index >= this.end) {
				return Iteration.DONE;
			}

			var result;
			if (_.isFunction(resolveHandler)) {
				try {
					result = Iteration.resolve(resolveHandler(this.iterable[this.index]), this.index);
				} catch (e) {
					result = Iteration.reject(e, this.index);
				}
			} else {
				result = Iteration.resolve(this.iterable[this.index], this.index);
			}

			++this.index;
			return result;
		};

		return IndexIterator;
	}());

	var ObjectIterator = (function () {

		function ObjectIterator(object) {
			this.iterable = object;
			this.iterator = new IndexIterator(Object.keys(object));
		}

		ObjectIterator.prototype.next = function (resolveHandler) {
			var iteration = this.iterator.next();
			if (iteration.done) {
				return iteration;
			}

			if (_.isFunction(resolveHandler)) {
				try {
					return Iteration.resolve(resolveHandler(this.iterable[iteration.value]), iteration.value);
				} catch (e) {
					return Iteration.reject(e, iteration.value);
				}
			} else {
				return Iteration.resolve(this.iterable[iteration.value], iteration.value);
			}
		};

		return ObjectIterator;
	}());

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