"use strict";

var _ = require('lodash');
var validPropertyName = require('./validPropertyName');

var Ng = (function () {
	function Ng() {
		if (!(this instanceof Ng)) {
			return new Ng();
		}

		this.$$modules = {};

		this.module('ng', []);
	}

	Ng.singleton = function () {
		if (!ng) {
			ng = new Ng();
		}
		return ng;
	};

	Ng.prototype.module = function (moduleName, requires) {
		//create module
		if (typeof requires !== 'undefined') {
			this.$$modules[moduleName] = new Module(this, moduleName, requires);
		}

		//throw if not exist
		if (!this.$$modules.hasOwnProperty(moduleName)) {
			throw new Error('module ' + moduleName + ' does not exist');
		}

		return this.$$modules[moduleName];
	};

	Ng.prototype.init = function () {

		//prepare modules
		_.forEach(this.$$modules, function (mod) {
			mod.$$preload();
		});

		//load module services
		_.forEach(this.$$modules, function (mod) {
			mod.$$loadServices();
		});

		//module post load
		_.forEach(this.$$modules, function (mod) {
			mod.$$postload();
		})
	};

	return Ng;
}());

var ng = null;

module.exports = Ng;


var Module = (function () {

	function Injectable(name, fn, injectableDepNames) {
		this.name = name;
		this.fn = fn;
		this.injects = injectableDepNames;
		this.instance = null;
	}

	function Module(ngInstance, moduleName, dependencyNames) {
		this.name = moduleName;
		this.$$ng = ngInstance;

		this.$$services = {};
		this.$$values = {};
		this.$$runs = [];
		this.$$nowLoadingInjectableNames = [];

		this.$$injectablesCache = null;

		this.$$dependencyModules = {};
		for (var i = 0; i < dependencyNames.length; ++i) {
			this.$$dependencyModules[dependencyNames[i]] = null;
		}
	}

	Module.prototype.service = function (name, requiresOrContructor, constructorOpt) {
		var injects = arguments.length > 2 ? requiresOrContructor : null;
		var constructor = arguments.length > 2 ? constructorOpt : _.isFunction(requiresOrContructor) ? requiresOrContructor : null;
		if (!_.isFunction(constructor)) {
			throw new Error('Module(' + this.name + ')::service(' + name + '): constructor is not a Function');
		}

		this.$$services[name] = new Injectable(name, constructor, injects);
		return this;
	};

	Module.prototype.value = function (name, value) {
		this.$$values[name] = value;
		return this;
	};

	Module.prototype.run = function (injects, fn) {
		this.$$runs.push(new Injectable('', fn, injects));

		return this;
	};

	Module.prototype.get = function (name) {
		var mod = this.find(name);
		return mod ? mod.$$injectablesCache[name] : void 0;
	};

	Module.prototype.find = function (name) {
		modulesCircularDependencyCheckArray = [];
		return findOwnThenInDependencies(this, '$$injectablesCache', name);
	};

	Module.prototype.$$instantiate = function (constructor, injectNames) {
		var instance = Object.create(constructor.prototype);
		this.$$invoke(constructor, injectNames, instance);
		return instance;
	};

	Module.prototype.$$invoke = function (fn, injectNames, context) {
		var self = this;
		return fn.apply(context, _.map(injectNames, function (req) {
			return self.get(req);
		}));
	};

	Module.prototype.$$preload = function () {
		var self = this;

		this.$$injectablesCache = {};

		//dependency modules
		this.$$dependencyModules = _.mapValues(this.$$dependencyModules, function (value, key) {
			return self.$$ng.module(key);
		});

		//constants
		_.assign(this.$$injectablesCache, this.$$values);
		this.$$values = null;
	};

	Module.prototype.$$loadServices = function () {
		//prepare services
		for (var key in this.$$services) {
			//WARNING. loadService should remove loaded service from array
			if (this.$$services.hasOwnProperty(key)) {
				loadServiceByName(this, this.$$services[key].name);
			}
		}
		this.$$nowLoadingInjectableNames = null;
	};

	Module.prototype.$$postload = function () {
		var self = this;

		//runs
		_.forEach(this.$$runs, function (item) {
			self.$$invoke(item.fn, item.injects);
		});
		this.$$runs = null;
	};

	var modulesCircularDependencyCheckArray = null;

	function findOwnThenInDependencies(mod, lookInProp, findName) {
		if (modulesCircularDependencyCheckArray.indexOf(mod.name) >= 0) return void 0;
		modulesCircularDependencyCheckArray.push(mod.name);
		return mod[lookInProp] ?
			mod[lookInProp].hasOwnProperty(findName) ? mod : findInDependent(mod, lookInProp, findName) : void 0;
	}

	function findInDependent(mod, lookInProp, findName) {
		var foundInMod = void 0;
		for (var key in mod.$$dependencyModules) {
			if (mod.$$dependencyModules.hasOwnProperty(key)) {
				foundInMod = findOwnThenInDependencies(mod.$$dependencyModules[key], lookInProp, findName);
				if (foundInMod) break;
			}
		}
		return foundInMod;
	}

	function findInServices(mod, findServiceName) {
		modulesCircularDependencyCheckArray = [];
		return findOwnThenInDependencies(mod, '$$services', findServiceName);
	}

	function loadServiceByName(mod, serviceName) {
		//check if injectable dependency was already loaded
		if (mod.$$services.hasOwnProperty(serviceName) && mod.$$services[serviceName].instance) return;
		//check if injectable is not in loading phase right now
		if (mod.$$nowLoadingInjectableNames.indexOf(serviceName) >= 0) return;

		//check if injectable dependency was added on top level
		if (mod.$$services.hasOwnProperty(serviceName)) {
			loadService(mod, mod.$$services[serviceName]);
		} else {
			//check if injectable dependency was added on deeper levels
			var modNext = findInServices(mod, serviceName);
			if (modNext) {
				loadService(modNext, modNext.$$services[serviceName]);
			}

			//not found in services. skipping...
		}

	}

	function loadService(mod, serviceToLoad) {
		//current loading injectable
		mod.$$nowLoadingInjectableNames.push(serviceToLoad.name);
		//preconstruct service
		serviceToLoad.instance = mod.$$injectablesCache[serviceToLoad.name] = Object.create(serviceToLoad.fn.prototype);

		//check all injectable dependencies ready
		if (_.isArray(serviceToLoad.injects)) {
			for (var i = 0; i < serviceToLoad.injects.length; ++i) {
				loadServiceByName(mod, serviceToLoad.injects[i]);
			}
		}

		//construct service
		mod.$$invoke(serviceToLoad.fn, serviceToLoad.injects, mod.$$injectablesCache[serviceToLoad.name]);
		//release loading guard
		mod.$$nowLoadingInjectableNames.pop();
	}

	return Module;
}());