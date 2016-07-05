var _ = require('lodash');

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
		this.iterator = iterator;
		this.cycleIndex = 0;
		//base on zero iterations count, they are additional iterations
		this.count = isFinite(numCycles) ? _.max([0, numCycles - 1]) : 0;
		this.iterations = [];
		this.iterIndex = 0;
		this.done = false;
	}

	CycleIterator.prototype = Object.create(Iterator.prototype);
	CycleIterator.prototype.constructor = CycleIterator;

	CycleIterator.prototype.next = function () {
		var iteration = this.iterator.next();
		if (iteration.done) {
			//check if iterations are cleared
			if (this.iterations) {
				if (this.iterIndex >= this.iterations.length) {
					if (++this.cycleIndex >= this.count) {
						//done
						//clear iterations
						this.iterations = null;
					} else {
						this.iterIndex = 0;
						return this.next();
					}
				} else {
					iteration = this.iterations[this.iterIndex++];
				}
			}
		} else {
			//check if iterations are cleared
			if (this.iterations) {
				this.iterations.push(iteration);
			}
		}

		return iteration;
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

module.exports = Iterator;