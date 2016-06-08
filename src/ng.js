"use strict";

var _ = require('lodash');
var validPropertyName = require('./validPropertyName');
var EventEmitter = require('./eventEmitter');

var Ng = (function () {
	function Ng() {
		if (!(this instanceof Ng)) {
			return new Ng();
		}

		EventEmitter.call(this);

		this.$$phase = Ng.phaseEnum.SETUP;
		this.$$modules = {};

		this.module('ng', []);
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

	Ng.phaseEventNames = {
		SETUP: '$phase.SETUP',
		LOADING: '$phase.LOADING',
		READY: '$phase.READY'
	};

	Ng.prototype.on = EventEmitter.prototype.on;
	Ng.prototype.once = EventEmitter.prototype.once;
	Ng.prototype.off = EventEmitter.prototype.off;
	Ng.prototype.$$emit = EventEmitter.prototype.emit;

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
		this.$$emit(Ng.phaseEventNames.LOADING);

		this.$$phase = Ng.phaseEnum.READY;
		this.$$emit(Ng.phaseEventNames.READY);
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

	function Module(ngInstance, name, dependencies) {
		this.name = name;
		this.dependencies = dependencies;
		this.$$ng = ngInstance;

		this.$$services = [];
		this.$$runs = [];
		this.$$nowLoadingService = null;

		this.$$serviceCache = null;
		this.$$dependencyModules = [];

		this.$$ng
			.once(Ng.phaseEventNames.LOADING, this.$$onload.bind(this))
			.once(Ng.phaseEventNames.READY, this.$$onready.bind(this));
	}

	Module.prototype.service = function (name, requiresOrContructor, constructorOpt) {
		if (!this.$$ng.isSetup()) {
			throw new Error('Module(' + this.name + ')::service(' + name + '): phase is not SETUP');
		}

		var injects = arguments.length > 2 ? requiresOrContructor : null;
		var constructor = arguments.length > 2 ? constructorOpt : _.isFunction(requiresOrContructor) ? requiresOrContructor : null;
		if (!_.isFunction(constructor)) {
			throw new Error('Module(' + this.name + ')::service(' + name + '): constructor is not a Function');
		}

		this.$$services.push({
			name: name,
			inject: injects,
			constructor: constructor
		});

		return this;
	};

	Module.prototype.run = function (injects, fn) {
		if (!this.$$ng.isSetup()) {
			throw new Error('Module(' + this.name + ')::run: phase is not SETUP');
		}

		this.$$runs.push({
			inject: injects,
			fn: fn
		});

		return this;
	};

	Module.prototype.get = function (name) {
		var mod = this.find(name);
		return mod ? mod.$$serviceCache[name] : void 0;
	};

	Module.prototype.find = function (name) {
		return this.$$serviceCache.hasOwnProperty(name) ? this : this.$$findInDependencyModules(name);
	};

	Module.prototype.$$findInDependencyModules = function (name) {
		_.forEach(this.$$dependencyModules, function (mod) {
			if (mod.find(name)) {
				return mod;
			}
		});
		return void 0;
	};

	Module.prototype.$$findInServices = function (name) {
		return _.find(this.$$services, function (srv) {
			return srv.name === name;
		}) ? this : this.$$findInDependencyModulesServices(name);
	};

	Module.prototype.$$findInDependencyModulesServices = function (name) {
		_.forEach(this.$$dependencyModules, function (mod) {
			if (mod.$$findInServices(name)) {
				return mod;
			}
		});
		return void 0;
	};

	Module.prototype.$$instantiate = function (constructor, requires) {
		var instance = Object.create(constructor.prototype);
		this.$$invoke(constructor, requires, instance);
		return instance;
	};

	Module.prototype.$$invoke = function (fn, requires, context) {
		var self = this;
		return fn.apply(context, _.map(requires, function (req) {
			return self.get(req);
		}));
	};

	Module.prototype.$$loadService = function (item) {
		var self = this;

		//current loading service
		this.$$nowLoadingService = item.name;

		//preconstruct service
		this.$$serviceCache[item.name] = Object.create(item.constructor.prototype);

		//check all injectable dependencies ready
		_.forEach(item.inject, function (req) {
			//check if already initialized
			var mod = self.find(req);
			if (!mod) {
				//check if was added
				mod = self.$$findInServices(req);
				if (mod) {
					//added but not loaded
					if (mod.$$nowLoadingService) {
						//module is now initializing
						if (mod.$$nowLoadingService !== req) {
							mod.$$loadService(req);
						}
					} else {
						//module is not initializing
						mod.$$onload();
					}
				} else {
					//could not find
					throw new Error('Module(' + self.name + ')::$$loadService: could not find injected dependency ' + req);
				}
			}
		});

		//construct service
		this.$$invoke(item.constructor, item.inject, this.$$serviceCache[item.name]);

		//release loading guard
		this.$$nowLoadingService = null;
	};

	Module.prototype.$$onload = function () {
		var self = this;

		if (!this.$$serviceCache) {
			this.$$serviceCache = {};

			//requires
			this.$$dependencyModules = _.map(this.inject, function (moduleName) {
				return self.$$ng.module(moduleName);
			});

			//prepare services
			_.forEach(this.$$services, function (item) {
				self.$$loadService(item);
			});
			this.$$services = null;
		}

		return this;
	};

	Module.prototype.$$onready = function () {
		var self = this;

		//runs
		_.forEach(this.$$runs, function (item) {
			self.$$invoke(item.fn, item.inject);
		});
		this.$$runs = null;
	};

	return Module;
}());