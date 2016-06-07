"use strict";

var Ng = require('../src/ng');
var ng = null;

describe('setupModuleLoader', function () {

	beforeEach(function () {
		ng = new Ng();
	});

	it('exposes angular in window', function () {
		expect(ng).toBeDefined();
	});

	it('ng singleton', function () {
		var ng = Ng.singleton();
		expect(ng).toBe(Ng.singleton());
	});

	it('exposes the angular module method', function () {
		expect(ng.module).toBeDefined();
	});

	it('allows registering a module', function () {
		var mod = ng.module('mod', []);
		expect(mod).toBeDefined();
		expect(mod.name).toEqual('mod');
	});

	it('replaces a module when registered twice', function () {
		var mod1 = ng.module('mod', []);
		var mod2 = ng.module('mod', []);

		expect(mod1).not.toBe(mod2);
	});

	it('attaches requires array to new module', function () {
		var mod = ng.module('mod', ['otherMod']);

		expect(mod.requires).toEqual(['otherMod']);
	});

	it('allows getting a module', function () {
		var mod1 = ng.module('mod', []);
		var mod2 = ng.module('mod');

		expect(mod1).toBe(mod2);
	});

	it('throws when trying to get not existent module', function () {
		expect(function () {ng.module('mod')}).toThrow();
	});

	it('allows to register a constant', function() {
		var mod = ng.module('mod', []);
		mod.constant('val', 42);
		ng.init();
		expect(mod.has('val')).toEqual(true);
		expect(mod.get('val')).toEqual(42);
	});

	it('loads multiple modules', function() {
		var numMods = 3;
		for(var i = 0; i < numMods; ++i) {
			ng.module(('mod' + i), []).constant('const' + i, i);
		}

		ng.init();

		for(i = 0; i < numMods; ++i) {
			expect(ng.module('mod' + i).get('const' + i)).toEqual(i);
		}
	});

	it('loads required modules of module', function() {
		var mod1 = ng.module('mod1', []);
		var mod2 = ng.module('mod2', ['mod1']);
		var mod3 = ng.module('mod3', ['mod2']);

		mod1.constant('mod1val', 42);

		ng.init();

		expect(ng.module('mod3').get('mod1val')).toEqual(42);
	});
});