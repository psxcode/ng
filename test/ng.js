"use strict";

var Ng = require('../src/ng');
var ng = null;

describe('Ng and Modules', function () {

	beforeEach(function () {
		ng = new Ng();
	});

	it('ng singleton', function () {
		expect(Ng.singleton).toBeDefined();
		expect(Ng.singleton()).toBe(Ng.singleton());
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

	it('allows getting a module', function () {
		var mod1 = ng.module('mod', []);
		var mod2 = ng.module('mod');

		expect(mod1).toBe(mod2);
	});

	it('throws when trying to get not existent module', function () {
		expect(function () {ng.module('mod')}).toThrow();
	});

	it('loads multiple modules', function () {
		var numMods = 3;
		for (var i = 0; i < numMods; ++i) {
			ng.module(('mod' + i), []).constant(('const' + i), i);
		}

		ng.init();

		for (i = 0; i < numMods; ++i) {
			expect(ng.module('mod' + i).get('const' + i)).toEqual(i);
		}
	});

	it('loads required modules of module', function () {
		ng.module('mod1', []);
		ng.module('mod2', ['mod1']);
		ng.module('mod3', ['mod2']);

		ng.module('mod1').constant('val', 42);

		ng.init();

		expect(ng.module('mod3').get('val')).toEqual(42);
	});

	it('works with module circular dependencies', function () {
		var mod1 = ng.module('mod1', ['mod2']);
		var mod2 = ng.module('mod2', ['mod1']);

		mod1.constant('val1', 42);
		mod2.constant('val2', 21);

		ng.init();

		expect(mod1.get('val2')).toEqual(21);
		expect(mod2.get('val1')).toEqual(42);
	});

	it('instantiates annotated function', function () {
		ng.module('mod', [])
			.constant('a', 1)
			.constant('b', 2);

		function test(a, b) {
			return a + b;
		}

		ng.init();

		var result = ng.module('mod').$$invoke(test, ['a', 'b']);
		expect(result).toEqual(3);
	});

	it('instantiates annotated constructor function', function () {
		ng.module('mod', [])
			.constant('a', 1)
			.constant('b', 2);

		function Test(a, b) {
			this.result = a + b;
		}

		ng.init();

		var test = ng.module('mod').$$instantiate(Test, ['a', 'b']);
		expect(test.result).toEqual(3);
	});

	it('allows to register and get a constant', function () {
		ng.module('mod', []).constant('val', 42);

		ng.init();

		expect(ng.module('mod').has('val')).toEqual(true);
		expect(ng.module('mod').get('val')).toEqual(42);
	});

	it('allows to register and get service', function () {
		ng.module('mod', [])
			.service('srv', function () {
				this.val = 42;
			});

		ng.init();

		expect(ng.module('mod').get('srv').val).toEqual(42);
	});

	it('works with service\'s constant dependencies', function () {
		ng.module('mod', [])
			.service('srv', ['a', 'b'], function (a, b) {
				this.result = a + b;
			})
			.constant('a', 42)
			.constant('b', 4);

		ng.init();

		expect(ng.module('mod').get('srv').result).toEqual(46);
	});
	
	it('works with service\'s service dependencies', function() {
		ng.module('mod', [])
			.service('srv1', ['srv2', 'srv3'], function(a, b) {
				this.value = a.value + b.value;
			})
			.service('srv2', function() {
				this.value = 42;
			})
			.service('srv3', function() {
				this.value = 4;
			});

		ng.init();

		expect(ng.module('mod').get('srv1').value).toEqual(46);
	});
});