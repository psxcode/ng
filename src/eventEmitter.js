"use strict";

var _ = require('lodash');

function EventEmitter() {
	this.$$events = {};
	this.$$eventsOnce = {};
}

EventEmitter.prototype.on = function (name, fn) {
	var self = this;

	if (!_.isArray(this.$$events[name])) {
		this.$$events[name] = [];
	}
	this.$$events[name].push(fn);

	return this;
};

EventEmitter.prototype.once = function (name, fn) {
	var self = this;

	if (!this.$$eventsOnce.hasOwnProperty(name)) {
		this.$$eventsOnce[name] = [];
	}
	this.$$eventsOnce[name].push(fn);

	return this;
};

EventEmitter.prototype.off = function(name, fn) {
	if (_.isArray(self.$$events[name])) {
		var index = self.$$events[name].indexOf(fn);
		if (index >= 0) {
			self.$$events[name].splice(index, 1);
		}
	}

	if (_.isArray(self.$$eventsOnce[name])) {
		index = self.$$eventsOnce[name].indexOf(fn);
		if (index >= 0) {
			self.$$eventsOnce[name].splice(index, 1);
		}
	}

	return this;
};

EventEmitter.prototype.emit = function (name) {
	if(arguments.length === 0) return;

	var args = new Array(arguments.length - 1);
	for(var i = 0; i < arguments.length; ++i) {
		args[i] = arguments[i + 1];
	}

	if(_.isArray(this.$$events[name])) {
		_.forEach(this.$$events[name], function(fn) {
			fn.apply(null, args);
		});
	}

	if(_.isArray(this.$$eventsOnce[name])) {
		_.forEach(this.$$eventsOnce[name], function(fn) {
			fn.apply(null, args);
		});
		delete this.$$eventsOnce[name];
	}

	return this;
};

module.exports = EventEmitter;