"use strict";

var _ = require('lodash');

module.exports.SS = SingularSync;
module.exports.SA = SingularAsync;

function SingularSync() {
	this.$$value = undefinedStub;
	this.$$error = undefinedStub;
}

SingularSync.prototype.$get = function (fn, errfn) {
	try {
		if (this.$$error) {
			if (errfn) return new SingularSync().$set(errfn(this.$$error));
		} else {
			if (fn) return new SingularSync().$set(fn(this.$$value));
		}
	} catch (e) {
		return new SingularSync().$error(e);
	}
	return new SingularSync();
};

SingularSync.prototype.$set = function (val) {
	this.$$value = val;
	this.$error = undefinedStub;
	return this;
};

SingularSync.prototype.$error = function (val) {
	this.$$value = undefinedStub;
	this.$$error = val;
	return this;
};

function SAFn(fn, errfn, donefn) {
	this.fn = fn;
	this.errfn = errfn;
	this.donefn = donefn;
	this.sa = new SingularAsync();
}

function SingularAsync() {
	this.$$value = undefinedStub;
	this.$$error = undefinedStub;
	this.$$fns = [];
}

SingularAsync.prototype.$get = function (fn, errfn, donefn) {
	var fns = new SAFn(fn, errfn, donefn);
	this.$$fns.push(fns);
	//check if resolved
	if (this.$$value !== undefinedStub || this.$$error !== undefinedStub) {
		singularAsyncInvoke(this);
	}
	return fns.sa;
};

SingularAsync.prototype.$set = function (val) {
	//resolve only once
	if (this.$$value !== undefinedStub || this.$$error !== undefinedStub) return;

	this.$$value = val;
	singularAsyncInvoke(this);
};

SingularAsync.prototype.$error = function (val) {
	//resolve only once
	if (this.$$value !== undefinedStub || this.$$error !== undefinedStub) return;

	this.$$error = val;
	singularAsyncInvoke(this);
};

function singularAsyncInvoke(sa) {
	var fn, val, noError = true;
	if (sa.$$value !== undefinedStub) {
		fn = 'fn';
		val = sa.$$value;
	} else if (sa.$$error !== undefinedStub) {
		fn = 'errfn';
		val = sa.$$error;
		noError = false;
	} else {
		return;
	}

	if (sa.$$fns.length) {
		setImmediate(function () {
			var fns;
			while (sa.$$fns.length) {
				fns = sa.$$fns.shift();
				if (_.isFunction(fns[fn])) {
					try {
						fns.sa.$set(fns[fn](val));
					} catch (e) {
						fns.sa.$error(e);
					}
				} else {
					noError ? fns.sa.$set(val) : fns.sa.$error(val);
				}
				if (_.isFunction(fns.donefn)) {
					fns.donefn(noError ? val : void 0);
				}
			}
		});
	}
}

function PluralSync() {

}

function PluralAsync() {

}

function undefinedStub() {

}