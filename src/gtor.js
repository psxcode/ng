"use strict";

function SingularSync() {
	this.$$value = null;
	this.$$error = null;
}

SingularSync.prototype.$get = function (fn, errfn) {
	if (this.$$error) {
		if (errfn) errfn(this.$$error);
	} else {
		if(fn) fn(this.$$value);
	}
};

SingularSync.prototype.$set = function (val) {
	this.$$value = val;
	this.$error = null;
};

SingularSync.prototype.$error = function (val) {
	this.$$value = null;
	this.$$error = val;
};

function SingularAsync() {
	this.$$value = null;
	this.$$error = null;
	this.$$fn = [];
	this.$$errfn = [];
}

SingularAsync.prototype.$get = function (fn, errfn) {
	if(this.$$value !== null) {
		if(fn) setImmediate(fn, this.$$value);
	} else if(this.$$error !== null) {
		if(errfn) setImmediate(errfn, this.$$error);
	} else {
		if (fn) this.$$fn.push(fn);
		if (errfn) this.$$errfn.push(errfn);
	}
};

SingularAsync.prototype.$set = function (val) {
	var self = this;

	//resolve only once
	if(this.$$value !== null || this.$$error !== null) return;

	this.$$value = val;
	if(this.$$fn.length) {
		setImmediate(function () {
			for (var i = 0; i < self.$$fn.length; ++i) {
				self.$$fn[i](self.$$value);
			}
		});
	}
};

SingularAsync.prototype.$error = function(val) {
	var self = this;

	//resolve only once
	if(this.$$value !== null || this.$$error !== null) return;

	this.$$error = val;
	if(this.$$errfn.length) {
		setImmediate(function () {
			for (var i = 0; i < self.$$errfn.length; ++i) {
				self.$$errfn[i](self.$$error);
			}
		});
	}
};

function PluralSync() {

}

function PluralAsync() {

}