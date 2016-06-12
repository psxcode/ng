"use strict";

var _ = require('lodash');
var validNames = require('./validNames');

var Ng = (function () {

	var ng = null;

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
		_.forOwn(this.$$modules, function (mod) {
			mod.$$init();
		});
	};

	return Ng;
}());

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
		this.$$dependencyNames = _.uniq(_.filter(dependencyNames, function (name) {
			return name && _.isString(name);
		}));

		this.$$services = {};
		this.$$values = {};
	}

	Module.prototype.service = function (name, injectsOrContructor, constructorOptional) {
		var injects = arguments.length > 2 ? injectsOrContructor : null;
		var constructor = arguments.length > 2 ? constructorOptional : _.isFunction(injectsOrContructor) ? injectsOrContructor : null;
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

	Module.prototype.get = function (name) {
		//first search in services at own level
		if (this.$$services.hasOwnProperty(name)) {
			return this.$$services[name].instance || instantiateInjectable(this, this.$$services[name]);
		}

		//search in values at own level
		if (this.$$values.hasOwnProperty(name)) {
			return this.$$values[name];
		}
		//WARNING. infinite loop possible
		//if 'find' returns module and 'get' cannot find injectable at own level

		var foundInModule = this.find(name);
		return foundInModule ? foundInModule.get(name) : void 0;
	};

	Module.prototype.find = function (name) {
		var modulesCircularDependencyCheckArray = [];
		return function findOwnThenInDependencies(mod, findName) {
			if (!mod || modulesCircularDependencyCheckArray.indexOf(mod.name) >= 0) return void 0;
			modulesCircularDependencyCheckArray.push(mod.name);

			//first search in services at own level
			return (mod.$$services.hasOwnProperty(findName) ||
			//search in values at own level
			mod.$$values.hasOwnProperty(findName)) ?
				mod : findAndReturn(mod.$$dependencyNames, function (depName) {
				return findOwnThenInDependencies(mod.$$ng.module(depName), findName);
			});
		}(this, name);
	};

	Module.prototype.instantiate = function (injectNames, constructor) {
		var instance = Object.create(constructor.prototype);
		this.invoke(injectNames, constructor, instance);
		return instance;
	};

	Module.prototype.invoke = function (injectNames, fn, context) {
		return _.spread(_.bind(fn, context))(_.map(injectNames, _.bind(this.get, this)));
	};

	Module.prototype.$$init = function () {
		var self = this;
	};

	return Module;

	function findAndReturn(array, fn) {
		for (var i = 0; i < array.length; ++i) {
			var result = fn(array[i]);
			if (typeof result !== 'undefined')
				return result;
		}
		return void 0;
	}

	function instantiateInjectable(mod, injectable) {
		injectable.instance = Object.create(injectable.fn.prototype);
		mod.invoke(injectable.injects, injectable.fn, injectable.instance);
		return injectable.instance;
	}
}());