"use strict";

var _ = require('lodash');
var validNames = require('./validNames');

var Ng = (function () {
	function Ng() {
		if (!(this instanceof Ng)) {
			return new Ng();
		}

		this.$$modules = {};

		//create default module
		this.module('ng', []);
	}

	Ng.singleton = function () {
		if (!ng) {
			ng = new Ng();
		}
		return ng;
	};

	Ng.prototype.module = function (moduleName, dependentModuleNames) {
		if (!moduleName || !_.isString(moduleName)) {
			throw new Error('module name is invalid, ' + moduleName);
		}

		//create module
		if (_.isArray(dependentModuleNames)) {
			if (!validNames.validPropertyName(moduleName)) {
				throw new Error('cannot create module with name ' + moduleName);
			}

			_.filter(dependentModuleNames, function (name) {
				return name && _.isString(name);
			});
			//add default module dependency
			dependentModuleNames.push('ng');
			this.$$modules[moduleName] = new Module(this, moduleName, dependentModuleNames);
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
		this.$$decorators = [];
		this.$$runs = [];

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

	Module.prototype.decorator = function (name, fn) {
		this.$$decorators.push(new Injectable('', fn, [name]));
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

	Module.prototype.instantiate = function (injectNames, constructor) {
		var instance = Object.create(constructor.prototype);
		this.invoke(injectNames, constructor, instance);
		return instance;
	};

	Module.prototype.invoke = function (injectNames, fn, context) {
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
	};

	Module.prototype.$$postload = function () {
		var self = this;

		//runs
		_.forEach(this.$$runs, function (item) {
			self.invoke(item.injects, item.fn);
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

	function loadServiceByName(mod, injectableName) {
		//check if service dependency was already loaded on local level
		if (mod.$$services.hasOwnProperty(injectableName) && mod.$$services[injectableName].instance) return;

		//check if service dependency was added on local level
		//this overrides local constants with local services
		if (mod.$$services.hasOwnProperty(injectableName)) {
			return loadService(mod, mod.$$services[injectableName]);
		}

		//check if injectable already loaded on local level or deeper
		if (!mod.find(injectableName)) {
			//check if injectable dependency was added on deeper levels
			var modNext = findInServices(mod, injectableName);
			//'modNext' should not be 'mod'
			if (modNext) {
				loadService(modNext, modNext.$$services[injectableName]);
				return checkDecorateApplyInjectable(mod, injectableName);
			}
		}

		//not found in services. skipping...
	}

	function loadService(mod, serviceToLoad) {
		//preconstruct service
		serviceToLoad.instance = mod.$$injectablesCache[serviceToLoad.name] = Object.create(serviceToLoad.fn.prototype);

		//check all injectable dependencies ready
		if (_.isArray(serviceToLoad.injects)) {
			for (var i = 0; i < serviceToLoad.injects.length; ++i) {
				loadServiceByName(mod, serviceToLoad.injects[i]);
			}
		}

		//construct service
		mod.invoke(serviceToLoad.injects, serviceToLoad.fn, mod.$$injectablesCache[serviceToLoad.name]);
		//check and decorate in place
		checkDecorateApplyInjectable(mod, serviceToLoad.name);

		//return decorated service instance
		return mod.$$injectablesCache[serviceToLoad.name];
	}

	function checkDecorateApplyAllInstances(mod) {
		var decorated = void 0;
		_.forOwn(mod.$$injectablesCache, function (injectableInstance, injectableName) {
			decorated = checkAndDecorateInjectable(mod, injectableName, injectableInstance);
			//apply if decorated
			if (decorated) mod.$$injectablesCache[injectableName] = decorated;
		});
	}

	function checkDecorateApplyInjectable(mod, injectableName) {
		var decorated = checkAndDecorateInjectable(mod, injectableName, mod.$$injectablesCache[injectableName]);
		//apply if decorated
		if (decorated) mod.$$injectablesCache[injectableName] = decorated;
		//return instance
		return mod.$$injectablesCache[injectableName];
	}

	function checkAndDecorateInjectable(mod, injectableName, injectableInstance) {
		var decorators = _.remove(mod.$$decorators, function (dec) {
			return injectableName === dec.name;
		});

		return decorators.length ? _.reduce(decorators, function (injectable, dec) {
			return typeof injectable === 'object' ? dec.fn(Object.create(injectable)) : dec.fn(injectable);
		}, injectableInstance) : void 0;
	}

	return Module;
}());