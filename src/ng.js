"use strict";

var _ = require('lodash');
var validPropertyName = require('./validPropertyName');

var Ng = (function () {
	function Ng() {
		if (!(this instanceof Ng)) {
			return new Ng();
		}

		this.$$phase = Ng.phaseEnum.SETUP;
		this.$$modules = {};
	}

	Ng.singleton = function () {
		if (!ng) {
			ng = new Ng();
		}
		return ng;
	};

	Ng.phaseEnum = {
		SETUP: 0,
		LOADING: 1,
		READY: 2
	};

	Ng.prototype.module = function (moduleName, requires) {
		//create module
		if (typeof requires !== 'undefined') {
			//create only when setup
			if (this.$$phase !== Ng.phaseEnum.SETUP) {
				throw new Error('Ng::module: Cannot create module. Phase is not SETUP, ' + this.$$phase);
			}

			this.$$modules[moduleName] = new Module(this, moduleName, requires);
		}

		//throw if not exist
		if (!this.$$modules.hasOwnProperty(moduleName)) {
			throw new Error('module ' + moduleName + ' does not exist');
		}

		return this.$$modules[moduleName];
	};

	Ng.prototype.init = function () {
		if (this.$$phase !== Ng.phaseEnum.SETUP) {
			throw new Error('Ng::init: phase is not SETUP, ' + this.$$phase);
		}

		this.$$phase = Ng.phaseEnum.LOADING;
		_.forEach(this.$$modules, function (mod) {
			mod.$$load();
		});

		this.$$phase = Ng.phaseEnum.READY;
	};

	Ng.prototype.isSetup = function () {
		return this.$$phase === Ng.phaseEnum.SETUP;
	};

	Ng.prototype.isReady = function () {
		return this.$$phase === Ng.phaseEnum.READY;
	};

	return Ng;
}());

var ng = null;

module.exports = Ng;


var Module = (function () {

	function Module(ngInstance, name, requires) {
		this.name = name;
		this.requires = requires;
		this.$$ng = ngInstance;
		this.$$services = [];
		this.$$constants = [];
		this.$$runs = [];
		this.$$cache = null;
	}

	Module.prototype.service = function (name, requires, constructor) {
		if (!this.$$ng.isSetup()) {
			throw new Error('Module(' + this.name + ')::service(' + name + '): phase is not SETUP');
		}

		this.$$services.push({
			name: name,
			requires: requires,
			constructor: constructor
		});
	};

	Module.prototype.constant = function (name, value) {
		if (!this.$$ng.isSetup()) {
			throw new Error('Module(' + this.name + ')::constant(' + name + '): phase is not SETUP');
		}

		var c = Object.create(null);
		c[name] = value;
		this.$$constants.push(c);
	};

	Module.prototype.run = function (requires, fn) {
		if (!this.$$ng.isSetup()) {
			throw new Error('Module(' + this.name + ')::run: phase is not SETUP');
		}

		this.$$runs.push({
			requires: requires,
			fn: fn
		});
	};

	Module.prototype.has = function (name) {
		return this.$$cache.hasOwnProperty(name);
	};

	Module.prototype.get = function (name) {
		return this.$$cache[name];
	};

	Module.prototype.$$load = function () {
		if (this.$$ng.isReady()) {
			throw new Error('cannot load module in READY state');
		}

		var self = this;

		if (!this.$$cache) {
			this.$$cache = {};

			//requires
			_.forEach(this.requires, function (item) {
				var module = self.$$ng.module(item);
				_.assign(self.$$cache, module.$$load());
			});

			//constants
			_.forEach(this.$$constants, function (item) {
				_.assign(self.$$cache, item);
			});
			this.$$constants = null;

			//services
			_.forEach(this.$$services, function (item) {
				//get requires instances
				var requires = self.$$getRequiredObjects(item.requires);

				//construct
				var instance = Object.create(item.constructor.prototype);
				item.constructor.apply(instance, requires);

				self.$$cache[item.name] = instance;
			});
			this.$$services = null;

			//runs
			_.forEach(this.$$runs, function (item) {
				//get requires instances
				var requires = self.$$getRequiredObjects(item.requires);

				item.fn.apply(null, requires);
			});
			this.$$runs = null;
		}

		return this.$$cache;
	};

	Module.prototype.$$getRequiredObjects = function (requires) {
		return _.map(requires, function (req) {
			return this.$$cache[req]
		});
	};

	return Module;
}());