'use strict';
var Scope = require('../src/scope').Scope;
var _ = require('lodash');

describe("Scope", function () {

    it('can be constructed and used as an object', function () {
        var scope = new Scope();
        scope.prop = 1;
        expect(scope.prop).toBe(1);
    });
});

describe("Digest", function () {
    var scope;

    beforeEach(function () {
        scope = new Scope();
    });

    it('calls a listener function', function () {
        var watch = function () {
            return 'watch';
        };
        var listener = jasmine.createSpy();
        scope.$watch(watch, listener);
        scope.$digest();
        expect(listener).toHaveBeenCalled();
    });

    it('calls a watch function with scope', function () {
        var watch = jasmine.createSpy();
        var listener = function () {
        };
        scope.$watch(watch, listener);
        scope.$digest();
        expect(watch).toHaveBeenCalledWith(scope);
    });

    it('calls the listener when watch value changed', function () {
        scope.val = 0;
        scope.counter = 0;

        scope.$watch(function (scope) {
            return scope.val;
        }, function (newValue, oldValue, scope) {
            ++scope.counter;
        });

        expect(scope.counter).toBe(0);
        scope.$digest();
        expect(scope.counter).toBe(1);
        scope.$digest();
        expect(scope.counter).toBe(1);
        scope.val = 1;
        expect(scope.counter).toBe(1);
        scope.$digest();
        expect(scope.counter).toBe(2);
    });

    it('calls listener if watch value is first undefined', function () {
        scope.counter = 0;

        scope.$watch(function (scope) {
            return scope.val;
        }, function (nv, ov, scope) {
            ++scope.counter;
        });

        expect(scope.counter).toBe(0);
        scope.$digest();
        expect(scope.counter).toBe(1);
    });

    it('calls listener with newValue as oldValue first time', function () {
        scope.val = 0;
        var oldVal = null;

        scope.$watch(function (scope) {
            return scope.val;
        }, function (nv, ov) {
            oldVal = ov;
        });

        scope.$digest();
        expect(oldVal).toBe(0);
    });

    it('may have watchers that omit listener function', function () {
        var watch = jasmine.createSpy().and.returnValue('something');
        scope.$watch(watch);
        scope.$digest();
        expect(watch).toHaveBeenCalled();
    });

    it('triggers chained watchers in the same digest', function () {
        scope.name = 'Jane';

        scope.$watch(
            function (scope) {
                return scope.nameUpper;
            },
            function (nv) {
                if (nv) {
                    scope.initial = nv.substring(0, 1) + '.';
                }
            }
        );
        scope.$watch(
            function (scope) {
                return scope.name;
            },
            function (nv) {
                if (nv) {
                    scope.nameUpper = nv.toUpperCase();
                }
            }
        );

        scope.$digest();
        expect(scope.initial).toBe('J.');

        scope.name = 'Bob';
        scope.$digest();
        expect(scope.initial).toBe('B.');
    });

    it('gives up on watches after 10 iterations', function () {
        scope.counterA = 0;
        scope.counterB = 0;

        scope.$watch(function (scope) {
                return scope.counterA;
            },
            function (nv) {
                if (nv) {
                    ++scope.counterB;
                }
            });

        scope.$watch(function (scope) {
                return scope.counterB;
            },
            function (nv) {
                if (nv) {
                    ++scope.counterA;
                }
            });

        expect(scope.$digest).toThrow();
    });

    it('ends the digest when last watch is clean', function () {
        scope.arr = _.range(100);
        var counter = 0;

        _.times(100, function (i) {
            scope.$watch(function (scope) {
                ++counter;
                return scope.arr[i];
            }, function (nv, ov, scope) {
            });
        });

        scope.$digest();
        expect(counter).toBe(200);

        scope.arr[0] = 1;
        scope.$digest();
        expect(counter).toBe(301);
    });

    it('does not end digest, new watcher are not run', function () {
        scope.val = 0;
        scope.counter = 0;

        scope.$watch(function (scope) {
            return scope.val;
        }, function (nv, ov, scope) {
            scope.$watch(function (scope) {
                return scope.val;
            }, function (nv, ov, scope) {
                ++scope.counter;
            });
        });

        scope.$digest();
        expect(scope.counter).toBe(1);
    });

    it('compares based on value if enabled', function () {
        scope.arr = [1, 2, 3];
        scope.counter = 0;

        scope.$watch(
            function (scope) {
                return scope.arr;
            },
            function (nv, ov, scope) {
                ++scope.counter;
            },
            true
        );

        scope.$digest();
        expect(scope.counter).toBe(1);

        scope.arr.push(4);
        scope.$digest();
        expect(scope.counter).toBe(2);

        scope.arr.push(5);
        scope.$digest();
        expect(scope.counter).toBe(3);
    });

    it('correctly handles NaNs', function () {
        scope.val = 0 / 0; //NaN
        scope.counter = 0;

        scope.$watch(
            function (scope) {
                return scope.val;
            },
            function (nv, ov, scope) {
                ++scope.counter;
            }
        );

        scope.$digest();
        expect(scope.counter).toBe(1);

        scope.$digest();
        expect(scope.counter).toBe(1);
    });

    it('executes $eval\'ed function and returns a result', function () {
        scope.val = 42;

        var result = scope.$eval(function (scope) {
            return scope.val;
        });

        expect(result).toBe(42);
    });

    it('passes second $eval argument straight through', function () {
        scope.val = 42;

        var result = scope.$eval(
            function (scope, arg) {
                return scope.val + arg;
            },
            2
        );

        expect(result).toBe(44);
    });

    it('executes apply\'ed function and starts a digest', function () {
        scope.val = 0;
        scope.counter = 0;

        scope.$watch(
            function (scope) {
                return scope.val;
            },
            function (nv, ov, scope) {
                ++scope.counter;
            }
        );

        scope.digest();
        expect(scope.counter).toBe(1);

        scope.$apply(function (scope) {
            scope.val = 42;
        });

        expect(scope.counter).toBe(2);
    });

    it('executes $evalAsync\'ed function later in the same cycle', function () {
        scope.val = 0;
        scope.evalComplete = false;
        scope.evalImmediateComplete = false;

        scope.$watch(
            function(scope) {
                return scope.val;
            },
            function(nv, ov, scope) {
                scope.$evalAsync(function (scope) {
                    scope.evalComplete = true;
                });
                scope.evalImmediateComplete = scope.evalComplete;
            }
        );

        scope.$digest();
        expect(scope.evalComplete).toBe(true);
        expect(scope.evalImmediateComplete).toBe(false);
    });
});
