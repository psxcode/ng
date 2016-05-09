'use strict';
var _ = require('lodash');

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    this.$$asyncQueue = [];
}

Scope.prototype.$watch = function (watch, listener, byValue) {
    this.$$watchers.push({
        watch: watch,
        listener: listener || noop,
        last: noop,
        byValue: !!byValue
    });
    this.$$lastDirtyWatch = null;
};

Scope.prototype.$$digestOnce = function () {
    var self = this;
    var newValue, oldValue, dirty = false;
    _.forEach(this.$$watchers, function (watcher) {
        newValue = watcher.watch(self);
        oldValue = watcher.last;
        if (!self.$$areEqual(newValue, oldValue, watcher.byValue)) {
            self.$$lastDirtyWatch = watcher;
            dirty = true;
            watcher.last = watcher.byValue ? _.cloneDeep(newValue) : newValue;
            watcher.listener(newValue, (oldValue === noop) ? newValue : oldValue, self);
        } else if (self.$$lastDirtyWatch === watcher) {
            return false;
        }
    });
    return dirty;
};

Scope.prototype.$digest = function () {
    var dirty = false;
    var ttl = 10;
    var asyncTask = null;

    this.$$lastDirtyWatch = null;
    do {
        while(this.$$asyncQueue.length) {
            asyncTask = this.$$asyncQueue.shift();
            asyncTask.scope.$eval(asyncTask.expr);
        }

        dirty = this.$$digestOnce();
        if (dirty && !(--ttl)) {
            throw(new Error('digest iterations maxed'));
        }
    } while (dirty);
};

Scope.prototype.$$areEqual = function (newValue, oldValue, byValue) {
    if (byValue) {
        return _.isEqual(newValue, oldValue);
    } else {
        return newValue === oldValue || (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
    }
};

Scope.prototype.$eval = function (expr, arg) {
    return expr(this, arg);
};

Scope.prototype.$evalAsync = function(expr) {
    this.$$asyncQueue.push({
        scope: this,
        expr: expr
    });
};

Scope.prototype.$apply = function (expr) {
    try {
        this.$eval(expr);
    } finally {
        this.$digest();
    }
};

function noop() {
}

module.exports.Scope = Scope;
