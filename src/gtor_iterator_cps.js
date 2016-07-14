var _ = require('lodash');
var SingularSync = require('./gtor_singular_sync');

var Iteration = (function () {

	function Iteration(singularValue, done) {
		this.value = singularValue;
		this.done = done;
	}

	Iteration.resolve = function (value, done) {
		return new Iteration((value && _.isFunction(value.then)) ? value : SingularSync.resolve(value), done === true);
	};

	Iteration.reject = function (reason, done) {
		return new Iteration((reason && _.isFunction(reason.then)) ? reason : SingularSync.reject(reason), done === true);
	};

	Iteration.DONE = Iteration.resolve(void 0, true);

	return Iteration;
}());

var Iterator = (function () {

	var Iterator = (function () {

		function EmptyIterator() {}

		EmptyIterator.prototype = Object.create(Iterator.prototype);
		EmptyIterator.prototype.constructor = EmptyIterator;

		EmptyIterator.prototype.next = function (iterationHandler) {
			iterationHandler(Iteration.DONE);
		};

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
			var iterarable = new FunctionIteratorImpl(fn);
			return _.bind(iterarable.next, iterarable);
		};

		Iterator.empty = Iterator();

		Iterator.prototype.next = function (resolveHandler) {
			this.impl.next(resolveHandler);
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

		Iterator.prototype.iterate = function (visitor, done) {
			var self = this;
			next();

			function iterationHandler(iteration) {
				if (iteration.done) {
					done();
				} else {
					iteration.value.then(visitor).finally(next);
				}
			}

			function next(goNextStep) {
				if (goNextStep !== false) {
					self.next(iterationHandler);
				}
			}
		};

		Iterator.prototype.toArray = function (handler) {
			var values = [];

			this.iterate(function (val) {
				values.push(val);
			}, function () {
				handler(values);
			})
		};

		return Iterator;
	}());

	var MapIterator = (function () {

		function MapIterator(iterator, resolveHandler, rejectHandler) {
			this.iterator = iterator;
			this.resolveHandler = resolveHandler;
			this.rejectHandler = rejectHandler;
		}

		MapIterator.prototype = Object.create(Iterator.prototype);
		MapIterator.prototype.constructor = MapIterator;

		MapIterator.prototype.next = function (iterationHandler) {
			var self = this;
			this.iterator.next(function (iteration) {
				if (!iteration.done) {
					iteration.value = iteration.value.then(self.resolveHandler, self.rejectHandler);
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

		FilterIterator.prototype = Object.create(Iterator.prototype);
		FilterIterator.prototype.constructor = FilterIterator;

		FilterIterator.prototype.next = function (iterationHandler) {
			var self = this;
			this.iterator.next(function nextHandler(iteration) {
				if (iteration.done) {
					iterationHandler(iteration);
				} else {
					iteration.value
						.then(self.resolveHandler, self.rejectHandler)
						.then(function (isApproved) {
							isApproved ? iterationHandler(iteration) : self.iterator.next(nextHandler);
						});
				}
			});
		};

		return FilterIterator;
	}());

	var ReduceIterator = (function () {

		function ReduceIterator(iterator, resolveHandler, initialValue) {
			this.iterator = iterator;
			this.resolveHandler = resolveHandler;
			this.lastValue = initialValue;
			this.done = false;
		}

		ReduceIterator.prototype = Object.create(Iterator.prototype);
		ReduceIterator.prototype.constructor = ReduceIterator;

		ReduceIterator.prototype.next = function (iterationHandler) {
			var self = this;

			if (this.done) {
				iterationHandler(Iteration.DONE);
			} else {
				this.iterator.next(function nextHandler(iteration) {
					if (iteration.done) {
						self.done = true;
						iterationHandler(Iteration.resolve(self.lastValue));
					} else if (_.isFunction(self.resolveHandler)) {
						iteration.value.then(function (val) {
							try {
								self.lastValue = self.resolveHandler(self.lastValue, val);
								self.iterator.next(nextHandler);
							} catch (e) {
								iterationHandler(Iteration.reject(e));
							}
						});
					} else {
						//dry run iterator
						self.iterator.next(nextHandler);
					}
				});
			}
		};

		ReduceIterator.prototype.visitor = function () {

		};

		return ReduceIterator;
	}());

	var FlattenIterator = (function () {

		function FlattenIterator(iterator) {
			this.iteratorStack = [Iterator(iterator)];
		}

		FlattenIterator.prototype = Object.create(Iterator.prototype);
		FlattenIterator.prototype.constructor = FlattenIterator;

		FlattenIterator.prototype.next = function (iterationHandler) {
			var self = this;

			this.iteratorStack[0].next(function nextHandler(iteration) {
				if (iteration.done) {
					self.iteratorStack.shift();
					self.iteratorStack.length ? self.next(iterationHandler) : iterationHandler(iteration);
				} else {
					iteration.value.then(function (val) {
						if (Iterator.can(val)) {
							self.iteratorStack.unshift(Iterator(val));
							self.next(iterationHandler);
						} else {
							iterationHandler(iteration);
						}
					});
				}
			});
		};

		return FlattenIterator;
	}());

	var CycleIterator = (function () {
		function CycleIterator(iterator, numCycles) {
			this.iterator = iterator;
			this.cycleIndex = 0;
			//base on zero iterations count, they are additional iterations
			this.count = isFinite(numCycles) ? _.max([0, numCycles - 1]) : 0;
			this.iterations = [];
			this.iterIndex = 0;
		}

		CycleIterator.prototype = Object.create(Iterator.prototype);
		CycleIterator.prototype.constructor = CycleIterator;

		CycleIterator.prototype.next = function (iterationHandler) {
			var self = this;

			this.iterator.next(function nextHandler(iteration) {
				if (iteration.done) {
					if (self.iterations) {
						if (self.iterIndex >= self.iterations.length) {
							if (++self.cycleIndex >= self.count) {
								//done
								//clear iterations
								self.iterations = null;
							} else {
								self.iterIndex = 0;
								self.next(iterationHandler);
								return;
							}
						} else {
							iteration = self.iterations[self.iterIndex++];
						}
					}
				} else {
					if (self.iterations) {
						self.iterations.push(iteration);
					}
				}
				iterationHandler(iteration);
			});
		};

		function getNextIteration(self) {
			if (self.iterIndex < self.iterations.length) {
				return self.iterations[self.iterIndex++];
			} else {
				if (++self.cycleIndex < self.count) {
					self.iterIndex = 0;
					return getNextIteration(self);
				} else {
					return Iteration.DONE;
				}
			}
		}

		return CycleIterator;
	}());

	var CatchIterator = (function () {

		function CatchIterator(iterator, handler) {
			this.iterator = iterator;
			this.handler = handler;
		}

		CatchIterator.prototype = Object.create(Iterator.prototype);
		CatchIterator.prototype.constructor = CatchIterator;

		CatchIterator.prototype.next = function (iterationHandler) {
			var self = this;
			this.iterator.next(function (iteration) {
				if (!iteration.done) {
					iteration.value = iteration.value.catch(function (e) {
						return _.isFunction(self.handler) ? self.handler(e) : void 0;
					});
				}
				iterationHandler(iteration);
			});
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
			this.end = isFinite(endIndex) ? _.min([iterable.length, endIndex < 0 ? _.max([0, iterable.length + endIndex]) : endIndex]) : iterable.length;
			this.index = isFinite(beginIndex) ? _.min([this.end, beginIndex < 0 ? _.max([0, iterable.length + beginIndex]) : beginIndex]) : 0;
		}

		IndexIteratorImpl.prototype = Object.create(IteratorImpl.prototype);
		IndexIteratorImpl.prototype.constructor = IndexIteratorImpl;

		IndexIteratorImpl.prototype.next = function (resolveHandler) {
			resolveHandler((this.index >= this.end) ? Iteration.DONE : Iteration.resolve(this.iterable[this.index++]));
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
			resolveHandler((this.index >= this.keys.length) ? Iteration.DONE : Iteration.resolve(this.iterable[this.keys[this.index++]]));
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
			var iteration = Iteration.DONE;

			if (_.isFunction(this.fn) && !this.invoked) {
				this.invoked = true;
				try {
					iteration = Iteration.resolve(this.fn());
				} catch (e) {
					iteration = Iteration.reject(e);
				}
			}

			iterationHandler(iteration);
		};

		return FunctionIteratorImpl;
	}());

	return Iterator;
}());

module.exports = Iterator;