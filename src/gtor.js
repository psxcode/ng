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
	};

	SingularSync.prototype.reject = function (val) {
		if (this.isPending()) {
			this.$$value = val;
			this.$$status = SingularStatusEnum.REJECTED;
		}
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

var IterationSync = (function () {

	function IterationSync(singularValue, done) {
		this.value = singularValue;
		this.done = done;
	}

	IterationSync.DONE = IterationSync.resolve(void 0, true);

	IterationSync.resolve = function (value, done) {
		return new IterationSync(SingularSync.resolve(value), done === true);
	};

	IterationSync.reject = function (reason, done) {
		return new IterationSync(SingularSync.reject(reason), done === true);
	};

	return IterationSync;
}());

var IteratorSync = (function () {

	var IteratorSync = (function () {

		function EmptyIteratorSync() {}

		EmptyIteratorSync.prototype = Object.create(IteratorSync.prototype);
		EmptyIteratorSync.prototype.constructor = EmptyIteratorSync;

		EmptyIteratorSync.prototype.next = function () {
			return IterationSync.DONE;
		};

		function IteratorSync(iterable, beginIndex, endIndex) {
			if (!iterable) {
				return new EmptyIteratorSync();
			} else if (iterable instanceof IteratorSync) {
				return iterable;
			} else if (!(this instanceof IteratorSync)) {
				return new IteratorSync(iterable, beginIndex, endIndex);
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

		IteratorSync.can = function (iterable) {
			return !!(iterable &&
			(iterable instanceof IteratorSync ||
			_.isArrayLike(iterable) ||
			_.isFunction(iterable.next) ||
			_.isFunction(iterable) ||
			_.isObject(iterable)))
		};

		IteratorSync.func = function (fn) {
			var invoked = false;
			return function () {
				if (invoked) {
					return IterationSync.DONE;
				} else {
					invoked = true;
					try {
						return IterationSync.resolve(fn(), 0);
					} catch (e) {
						return IterationSync.reject(e, 0);
					}
				}
			}
		};

		IteratorSync.empty = IteratorSync();

		IteratorSync.prototype.next = function (resolveHandler) {
			this.impl.next(resolveHandler);
		};

		IteratorSync.prototype.map = function (resolveHandler, rejectHandler) {
			return new MapIterator(this, resolveHandler, rejectHandler);
		};

		IteratorSync.prototype.filter = function (resolveHandler, rejectHandler) {
			return new FilterIterator(this, resolveHandler, rejectHandler);
		};

		IteratorSync.prototype.reduce = function (resolveHandler, initialValue) {
			return new ReduceIterator(this, resolveHandler, initialValue);
		};

		IteratorSync.prototype.flatten = function () {
			return new FlattenIterator(this);
		};

		IteratorSync.prototype.cycle = function (numCycles) {
			return new CycleIterator(this, numCycles);
		};

		IteratorSync.prototype.catch = function (handler) {
			return new CatchIterator(this, handler);
		};

		IteratorSync.prototype.toArray = function () {
			var result = [];
			while (true) {
				var iteration = this.next();
				if (iteration.done) break;
				result.push(iteration.error ? void 0 : iteration.value);
			}
			return result;
		};

		return IteratorSync;
	}());

	var MapIterator = (function () {

		function MapIterator(iterator, resolveHandler, rejectHandler) {
			this.iterator = iterator;
			this.resolveHandler = resolveHandler;
			this.rejectHandler = rejectHandler;
		}

		MapIterator.prototype = Object.create(IteratorSync.prototype);
		MapIterator.prototype.constructor = MapIterator;

		MapIterator.prototype.next = function (iterationHandler) {
			this.iterator.next(function nextHandler(iteration) {
				if (!iteration.done) {
					iteration.value = iteration.value.then(this.resolveHandler, this.rejectHandler);
				}
				iterationHandler(iteration);
			});
		};

		return MapIterator;
	}());

	var FilterIterator = (function () {

		function FilterIterator(iterator, resolveHandler, rejectHandler) {
			this.iterator = iterator;
			this.resolveHandler = resolveHandler;
			this.rejectHandler = rejectHandler;
		}

		FilterIterator.prototype = Object.create(IteratorSync.prototype);
		FilterIterator.prototype.constructor = FilterIterator;

		FilterIterator.prototype.next = function (iterationHandler) {
			var self = this;
			this.iterator.next(function (iteration) {
				if (iteration.done) {
					iterationHandler(iteration);
				}

				iteration.value
					.then(self.resolveHandler, self.rejectHandler)
					.then(function (isApproved) {
						if (isApproved) iterationHandler(iteration);
					});
			});
		};

		return FilterIterator;
	}());

	var ReduceIterator = (function () {

		function ReduceIterator(iterator, resolveHandler, initialValue) {
			this.iterator = iterator;
			this.resolveHandler = resolveHandler;
			this.lastValue = initialValue;
		}

		ReduceIterator.prototype = Object.create(IteratorSync.prototype);
		ReduceIterator.prototype.constructor = ReduceIterator;

		ReduceIterator.prototype.next = function (iterationHandler) {
			var self = this;

			this.iterator.next(nextHandler);

			function nextHandler(iteration) {
				if (iteration.done) {
					iterationHandler(IteratorSync.resolve(self.lastValue));
				}

				if (_.isFunction(self.resolveHandler)) {
					iteration.value.then(function (val) {
						try {
							self.lastValue = self.resolveHandler(self.lastValue, val);
						} catch (e) {
							iterationHandler(IteratorSync.reject(e));
						}
					}).then(function () {
						self.iterator.next(nextHandler);
					})
				} else {
					self.iterator.next(nextHandler);
				}
			}
		};

		return ReduceIterator;
	}());

	var FlattenIterator = (function () {

		function FlattenIterator(iterator) {
			this.iteratorStack = [IteratorSync(iterator)];
		}

		FlattenIterator.prototype = Object.create(IteratorSync.prototype);
		FlattenIterator.prototype.constructor = FlattenIterator;

		FlattenIterator.prototype.next = function (iterationHandler) {
			var self = this;

			this.iteratorStack[0].next(nextHandler);

			function nextHandler(iteration) {
				if (iteration.done) {
					self.iteratorStack.shift();
					self.iteratorStack.length ? self.iteratorStack[0].next(nextHandler) : iterationHandler(iteration);
				} else {
					iteration.value.then(IteratorSync.can).then();
					if (IteratorSync.can(iteration.value)) {
						self.iteratorStack.unshift(IteratorSync(iteration.value));
					}
				}
			}
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

		CycleIterator.prototype = Object.create(IteratorSync.prototype);
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

		CatchIterator.prototype = Object.create(IteratorSync.prototype);
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
			return IterationSync.DONE;
		};

		return IteratorImpl;
	}());

	var IndexIteratorImpl = (function () {

		function IndexIteratorImpl(iterable, beginIndex, endIndex) {
			this.iterable = iterable;
			this.end = isFinite(endIndex) ? _.min([iterable.length, _.max([endIndex, 0])]) : iterable.length;
			this.index = isFinite(beginIndex) ? _.max([0, _.min([beginIndex, iterable.length, this.end])]) : 0;
		}

		IndexIteratorImpl.prototype = Object.create(IteratorImpl.prototype);
		IndexIteratorImpl.prototype.constructor = IndexIteratorImpl;

		IndexIteratorImpl.prototype.next = function (resolveHandler) {
			resolveHandler((this.index >= this.end) ? IterationSync.DONE : IterationSync.resolve(this.iterable[this.index++]));
		};

		return IndexIteratorImpl;
	}());

	var ObjectIteratorImpl = (function () {

		function ObjectIteratorImpl(object) {
			this.iterable = object;
			this.keys = Object.keys(object);
			this.index = 0;
		}

		ObjectIteratorImpl.prototype = Object.create(IteratorImpl.prototype);
		ObjectIteratorImpl.prototype.constructor = ObjectIteratorImpl;

		ObjectIteratorImpl.prototype.next = function (resolveHandler) {
			resolveHandler((this.index >= this.keys.length) ? IterationSync.DONE : IterationSync.resolve(this.iterable[this.keys[this.index++]]));
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

		FunctionIteratorImpl.prototype.next = function (iterationHandler) {
			var iteration = IterationSync.DONE;

			if (!this.invoked) {
				this.invoked = true;
				try {
					iteration = IterationSync.resolve(this.fn());
				} catch (e) {
					iteration = IterationSync.reject(e);
				}
			}

			iterationHandler(iteration);
		};

		return FunctionIteratorImpl;
	}());

	return IteratorSync;
}());

/*var IteratorAsync = (function () {

 function IteratorAsync() {

 }

 var MapIteratorAsync = (function () {
 function MapIteratorAsync(iterator, resolveHandler, rejectHandler) {
 this.iterator = iterator;
 this.resolveHandler = resolveHandler;
 this.rejectHandler = rejectHandler;
 }

 MapIteratorAsync.prototype = Object.create(IteratorAsync.prototype);
 MapIteratorAsync.prototype.constructor = MapIteratorAsync;

 MapIteratorAsync.prototype.next = function () {
 var iteration = this.iterator.next();

 //done case
 if (!iteration.done) {
 //error case
 if (iteration.error) {
 //map handler first
 if (_.isFunction(this.rejectHandler)) {
 try {
 iteration.value = this.rejectHandler(iteration.value, iteration.key);
 } catch (e) {
 iteration = Iteration.reject(e, iteration.key);
 }
 }
 }
 //resolved case
 else {
 //map resolver first
 if (_.isFunction(this.resolveHandler)) {
 try {
 iteration.value = this.resolveHandler(iteration.value, iteration.key);
 } catch (e) {
 iteration = Iteration.reject(e, iteration.key);
 }
 }
 }
 }

 return iteration;
 };

 return MapIteratorAsync;
 }());

 return IteratorAsync;
 }());*/

function PluralSync() {

}

function PluralAsync() {

}

module.exports.SingularSync = SingularSync;
module.exports.SingularAsync = SingularAsync;
module.exports.IteratorSync = IteratorSync;

function initialValue() {
	return void 0;
}