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
	if (this.$$value !== undefinedStub) {
		saInvokeSet(this);
	} else if (this.$$error !== undefinedStub) {
		saInvokeError(this);
	}
	
	return fns.sa;
};

SingularAsync.prototype.$set = function (val) {
	//resolve only once
	if (this.$$value !== undefinedStub || this.$$error !== undefinedStub) return;

	if(_.isFunction(val.$get)) {
		val.$get(_.bind(this.$set, this), _.bind(this.$error, this));
	} else {
		this.$$value = val;
		saInvokeSet(this);
	}
};

SingularAsync.prototype.$error = function (val) {
	//resolve only once
	if (this.$$value !== undefinedStub || this.$$error !== undefinedStub) return;

	this.$$error = val;
	saInvokeError(this);
};

function saInvokeSet(sa) {
	if(!sa.$$fns.length) return;

	setImmediate(function() {
		var fns;
		while(sa.$$fns.length) {
			fns = sa.$$fns.shift();
			if(_.isFunction(fns.fn)) {
				try {
					fns.sa.$set(fns.fn(sa.$$value));
				} catch (e) {
					fns.sa.$error(e);
				}
			} else {
				fns.sa.$set(sa.$$value);
			}
			if(_.isFunction(fns.donefn)) {
				fns.donefn(sa.$$value);
			}
		}
	});
}

function saInvokeError(sa) {
	if(!sa.$$fns.length) return;

	setImmediate(function() {
		var fns;
		while(sa.$$fns.length) {
			fns = sa.$$fns.shift();
			if(_.isFunction(fns.errfn)) {
				try {
					fns.sa.$set(fns.errfn(sa.$$error));
				} catch(e) {
					fns.sa.$error(e);
				}
			} else {
				fns.sa.$error(sa.$$error);
			}
			if(_.isFunction(fns.donefn)) {
				fns.donefn();
			}
		}
	});
}

function PluralSync() {

}

function PluralAsync() {

}

function undefinedStub() {

}