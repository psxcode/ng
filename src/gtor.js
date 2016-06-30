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

	SingularAsync.all = all;
	SingularAsync.any = any;
	SingularAsync.race = race;

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
}());


var Iterator = (function () {

	var Iteration = (function () {

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
		return Iteration;
	}());

	var Iterator = (function () {

		function Iterator(iterable, beginIndex, endIndex) {
			if (!iterable) {
				return new EmptyIterator();
			} else if (iterable instanceof Iterator) {
				return iterable;
			} else if (!(this instanceof Iterator)) {
				return new Iterator(iterable, beginIndex, endIndex);
			}
			//implementation
			else if (_.isFunction(iterable.next)) {
				this.impl = iterable;
			} else if (_.isFunction(iterable)) {
				this.impl = new FunctionIteratorImpl(iterable);
			} else if (_.isArrayLike(iterable)) {
				this.impl = new IndexIteratorImpl(iterable, beginIndex, endIndex);
			} else if (_.isObject(iterable)) {
				this.impl = new ObjectIteratorImpl(iterable);
			}
			//error
			else {
				throw new Error('cannot iterate');
			}
		}

		Iterator.can = function (iterable) {
			return !!(iterable &&
			(iterable instanceof Iterator ||
			_.isArrayLike(iterable) ||
			_.isFunction(iterable.next) ||
			_.isFunction(iterable) ||
			_.isObject(iterable)))
		};

		Iterator.func = function (fn) {
			var invoked = false;
			return function () {
				if (invoked) {
					return Iteration.DONE;
				} else {
					invoked = true;
					try {
						return Iteration.resolve(fn(), 0);
					} catch (e) {
						return Iteration.reject(e, 0);
					}
				}
			}
		};

		Iterator.empty = Iterator();

		Iterator.Iteration = Iteration;

		Iterator.prototype.next = function (resolveHandler, rejectHandler) {
			return this.impl.next(resolveHandler, rejectHandler);
		};

		Iterator.prototype.map = function (resolveHandler, rejectHandler) {
			return new MapIterator(this, resolveHandler, rejectHandler);
		};

		Iterator.prototype.filter = function (resolveHandler, rejectHandler) {
			return new FilterIterator(this, resolveHandler, rejectHandler);
		};

		Iterator.prototype.reduce = function (resolveHandler, initialValue) {
			return new ReduceIterator(this, resolveHandler, initialValue);
		};

		Iterator.prototype.flatten = function () {
			return new FlattenIterator(this);
		};

		Iterator.prototype.cycle = function (numCycles) {
			return new CycleIterator(this, numCycles);
		};

		Iterator.prototype.catch = function (handler) {
			return new CatchIterator(this, handler);
		};

		Iterator.prototype.toArray = function () {
			var result = [];
			while (true) {
				var iteration = this.next();
				if (iteration.done) break;
				result.push(iteration.error ? void 0 : iteration.value);
			}
			return result;
		};

		return Iterator;
	}());

	function EmptyIterator() {}

	EmptyIterator.prototype = Object.create(Iterator.prototype);
	EmptyIterator.prototype.constructor = EmptyIterator;

	EmptyIterator.prototype.next = function () {
		return Iteration.DONE;
	};

	var MapIterator = (function () {

		function MapIterator(iterator, resolveHandler, rejectHandler) {
			this.iterator = iterator;
			this.resolveHandler = resolveHandler;
			this.rejectHandler = rejectHandler;
		}

		MapIterator.prototype = Object.create(Iterator.prototype);
		MapIterator.prototype.constructor = MapIterator;

		MapIterator.prototype.next = function () {
			var iteration = this.iterator.next();

			//done case
			if (iteration.done) {
				return iteration;
			}

			//error case
			if (iteration.error) {
				if (_.isFunction(this.rejectHandler)) {
					try {
						return Iteration.resolve(this.rejectHandler(iteration.value, iteration.key), iteration.key);
					} catch (e) {
						return Iteration.reject(e, iteration.key);
					}
				} else {
					return iteration;
				}
			}

			if (_.isFunction(this.resolveHandler)) {
				try {
					return Iteration.resolve(this.resolveHandler(iteration.value, iteration.key), iteration.key);
				} catch (e) {
					return Iteration.reject(e, iteration.key);
				}
			} else {
				return Iteration.resolve(iteration.value, iteration.key);
			}
		};

		return MapIterator;
	}());

	var FilterIterator = (function () {

		function FilterIterator(iterator, resolveHandler, rejectHandler) {
			this.iterator = iterator;
			this.resolveHandler = resolveHandler;
			this.rejectHandler = rejectHandler;
		}

		FilterIterator.prototype = Object.create(Iterator.prototype);
		FilterIterator.prototype.constructor = FilterIterator;

		FilterIterator.prototype.next = function () {
			while (true) {

				var iteration = this.iterator.next();

				//done case
				if (iteration.done) {
					return iteration;
				}

				//error case
				if (iteration.error) {
					if (_.isFunction(this.rejectHandler)) {
						try {
							//call rejectHandler but ignore its return value
							this.rejectHandler(iteration.value, iteration.key);
						} catch (e) {
							return Iteration.reject(e, iteration.key);
						}
					} else {
						return iteration;
					}
				} else {
					//only valid values are passed to resolveHandler
					try {
						if (this.resolveHandler(iteration.value, iteration.key)) {
							return Iteration.resolve(iteration.value, iteration.key);
						}
					}
					catch (e) {
						return Iteration.reject(e, iteration.key);
					}
				}
			}
		};

		return FilterIterator;
	}());

	var ReduceIterator = (function () {

		function ReduceIterator(iterator, resolveHandler, initialValue) {
			this.iterator = iterator;
			this.resolveHandler = resolveHandler;
			this.lastValue = initialValue;
		}

		ReduceIterator.prototype = Object.create(Iterator.prototype);
		ReduceIterator.prototype.constructor = ReduceIterator;

		ReduceIterator.prototype.next = function () {

			if (_.isFunction(this.resolveHandler)) {
				var iterations = [];

				//run iterators
				while (true) {
					var iteration = this.iterator.next();
					if (iteration.done) break;
					iterations.push(iteration);
				}

				for (var i = 0; i < iterations.length; ++i) {
					iteration = iterations[i];
					if (iteration.error) {
						return iteration;
					} else {
						try {
							this.lastValue = this.resolveHandler(this.lastValue, iteration.value, iteration.key);
						} catch (e) {
							return Iteration.reject(e, iteration.key, true);
						}
					}
				}
			} else {
				//run iterators
				while (!this.iterator.next().done);
			}

			return Iteration.resolve(this.lastValue, void 0, true);
		};

		return ReduceIterator;
	}());

	var FlattenIterator = (function () {

		function FlattenIterator(iterator) {
			this.iteratorStack = [Iterator(iterator)];
		}

		FlattenIterator.prototype = Object.create(Iterator.prototype);
		FlattenIterator.prototype.constructor = FlattenIterator;

		FlattenIterator.prototype.next = function () {
			var iteration = this.iteratorStack[0].next();

			if (iteration.done) {
				this.iteratorStack.shift();
				return this.iteratorStack.length ? this.next() : iteration;
			}

			if (Iterator.can(iteration.value)) {
				this.iteratorStack.unshift(Iterator(iteration.value));
				return this.next();
			}

			return iteration;
		};

		return FlattenIterator;
	}());

	var CycleIterator = (function () {
		function CycleIterator(iterator, numCycles) {
			this.source = iterator;
			this.index = 0;
			this.count = isFinite(numCycles) ? _.max([1, numCycles]) : 1;
			this.iterations = null;
			this.iterIndex = 0;
		}

		CycleIterator.prototype = Object.create(Iterator.prototype);
		CycleIterator.prototype.constructor = CycleIterator;

		CycleIterator.prototype.next = function () {
			//accumulate
			if (!this.iterations) {
				this.iterations = [];
				while (true) {
					var iteration = this.source.next();
					if (iteration.done) break;
					this.iterations.push(iteration);
				}
			}

			//iterate
			if (this.iterIndex < this.iterations.length) {
				return this.iterations[this.iterIndex++];
			} else {
				if (++this.index < this.count) {
					this.iterIndex = 0;
					return this.next();
				} else {
					return Iteration.DONE;
				}
			}
		};

		return CycleIterator;
	}());

	var CatchIterator = (function () {

		function CatchIterator(iterator, handler) {
			this.iterator = iterator;
			this.handler = handler;
		}

		CatchIterator.prototype = Object.create(Iterator.prototype);
		CatchIterator.prototype.constructor = CatchIterator;

		CatchIterator.prototype.next = function () {
			var iteration = this.iterator.next();

			if (iteration.done) {
				return iteration;
			}

			if (iteration.error) {
				if (_.isFunction(this.handler)) {
					try {
						return Iteration.resolve(this.handler(iteration.value, iteration.key), iteration.key);
					} catch (e) {
						return Iteration.reject(e, iteration.key);
					}
				} else {
					//resolve with undefined
					return Iteration.resolve(void 0, iteration.key);
				}
			}

			return iteration;
		};

		return CatchIterator;
	}());

	var IteratorImpl = (function () {

		function IteratorImpl() {
		}

		IteratorImpl.prototype.next = function () {
			return Iteration.DONE;
		};

		return IteratorImpl;
	}());


	var IndexIteratorImpl = (function () {

		function IndexIteratorImpl(iterable, beginIndex, endIndex) {
			this.iterable = iterable;
			this.end = isFinite(endIndex) ? _.min([iterable.length, _.max([endIndex, 0])]) : iterable.length;
			this.begin = this.index = isFinite(beginIndex) ? _.max([0, _.min([beginIndex, iterable.length, this.end])]) : 0;
		}

		IndexIteratorImpl.prototype = Object.create(IteratorImpl.prototype);
		IndexIteratorImpl.prototype.constructor = IndexIteratorImpl;

		IndexIteratorImpl.prototype.next = function () {
			if (this.index >= this.end) {
				return Iteration.DONE;
			}

			var result = Iteration.resolve(this.iterable[this.index], this.index);

			++this.index;
			return result;
		};

		return IndexIteratorImpl;
	}());

	var ObjectIteratorImpl = (function () {

		function ObjectIteratorImpl(object) {
			this.iterable = object;
			this.impl = new IndexIteratorImpl(Object.keys(object));
		}

		ObjectIteratorImpl.prototype = Object.create(IteratorImpl.prototype);
		ObjectIteratorImpl.prototype.constructor = ObjectIteratorImpl;

		ObjectIteratorImpl.prototype.next = function () {
			var iteration = this.impl.next();
			return iteration.done ? iteration : Iteration.resolve(this.iterable[iteration.value], iteration.value);
		};

		return ObjectIteratorImpl;
	}());

	var FunctionIteratorImpl = (function () {

		function FunctionIteratorImpl(fn) {
			this.fn = fn;
			this.invoked = false;
		}

		FunctionIteratorImpl.prototype = Object.create(IteratorImpl.prototype);
		FunctionIteratorImpl.prototype.constructor = FunctionIteratorImpl;

		FunctionIteratorImpl.prototype.next = function () {
			if (this.invoked) {
				return Iteration.DONE;
			} else {
				this.invoked = true;
				try {
					return Iteration.resolve(this.fn(), 0);
				} catch (e) {
					return Iteration.reject(e, 0);
				}
			}
		};

		return FunctionIteratorImpl;
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