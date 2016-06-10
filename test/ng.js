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
			ng.module(('mod' + i), []);
		}

		ng.init();

		for (i = 0; i < numMods; ++i) {
			expect(ng.module('mod' + i)).toBeDefined();
		}
	});

	it('registers value and finds module', function () {
		ng.module('mod', []).value('val', 42);

		ng.init();

		expect(ng.module('mod').find('val')).toBe(ng.module('mod'));
	});

	it('registers value and gets its value', function () {
		ng.module('mod', []).value('val', 42);

		ng.init();

		expect(ng.module('mod').get('val')).toEqual(42);
	});

	it('registers and gets service', function () {
		ng.module('mod', [])
			.service('srv', function () {
				this.val = 42;
			});

		ng.init();

		expect(ng.module('mod').get('srv')).toBeDefined();
		expect(ng.module('mod').get('srv').val).toEqual(42);
	});

	it('finds a value in dependent module', function () {
		ng.module('mod1', [])
			.value('val', 42);
		ng.module('mod2', ['mod1']);

		ng.init();

		expect(ng.module('mod2').find('val')).toBe(ng.module('mod1'));
	});

	it('gets a value from dependent module', function () {
		ng.module('mod1', [])
			.value('val', 42);
		ng.module('mod2', ['mod1']);

		ng.init();

		expect(ng.module('mod2').get('val')).toEqual(42);
	});

	it('finds a service in dependent module', function () {
		ng.module('mod1', [])
			.service('srv', function () {
				this.val = 42;
			});
		ng.module('mod2', ['mod1']);

		ng.init();

		expect(ng.module('mod2').find('srv')).toBe(ng.module('mod1'));
	});

	it('gets a service\'s value from dependent module', function () {
		ng.module('mod1', [])
			.service('srv', function () {
				this.val = 42;
			});
		ng.module('mod2', ['mod1']);

		ng.init();

		expect(ng.module('mod2').get('srv')).toBeDefined();
		expect(ng.module('mod2').get('srv').val).toEqual(42);
	});

	it('finds deep \'value\'s module', function () {
		ng.module('mod1', []);
		ng.module('mod2', ['mod1']);
		ng.module('mod3', ['mod2']);

		ng.module('mod1')
			.value('val', 42);

		ng.init();

		expect(ng.module('mod3').find('val')).toBe(ng.module('mod1'));
	});

	it('gets deep \'value\'', function () {
		ng.module('mod1', []);
		ng.module('mod2', ['mod1']);
		ng.module('mod3', ['mod2']);

		ng.module('mod1')
			.value('val', 42);

		ng.init();

		expect(ng.module('mod3').get('val')).toEqual(42);
	});

	it('finds deep \'service\'s module', function () {
		ng.module('mod1', []);
		ng.module('mod2', ['mod1']);
		ng.module('mod3', ['mod2']);

		ng.module('mod1')
			.service('srv', function () {
				this.val = 42;
			});

		ng.init();

		expect(ng.module('mod3').find('srv')).toBe(ng.module('mod1'));
	});

	it('gets deep \'service\'', function () {
		ng.module('mod1', []);
		ng.module('mod2', ['mod1']);
		ng.module('mod3', ['mod2']);

		ng.module('mod1')
			.service('srv', function () {
				this.val = 42;
			});

		ng.init();

		expect(ng.module('mod3').get('srv')).toBeDefined();
		expect(ng.module('mod3').get('srv').val).toEqual(42);
	});

	it('works with module circular \'value\' dependencies', function () {
		var mod1 = ng.module('mod1', ['mod2']);
		var mod2 = ng.module('mod2', ['mod1']);

		mod1.value('val1', 42);
		mod2.value('val2', 21);

		ng.init();

		expect(mod1.get('val2')).toEqual(21);
		expect(mod2.get('val1')).toEqual(42);
	});

	it('works with module circular \'service\' dependencies', function () {
		var mod1 = ng.module('mod1', ['mod2']);
		var mod2 = ng.module('mod2', ['mod1']);

		mod1.service('srv1', function () {
			this.val = 42;
		});
		mod2.service('srv2', function () {
			this.val = 21;
		});

		ng.init();

		expect(mod1.get('srv2')).toBeDefined();
		expect(mod2.get('srv1')).toBeDefined();
		expect(mod1.get('srv2').val).toEqual(21);
		expect(mod2.get('srv1').val).toEqual(42);
	});

	it('instantiates annotated function and returns it result', function () {
		ng.module('mod', [])
			.value('a', 1)
			.value('b', 2);

		ng.init();

		var result = ng.module('mod').invoke(['a', 'b'], function (a, b) {
			return a + b;
		});
		expect(result).toEqual(3);
	});

	it('instantiates annotated constructor function and returns its result', function () {
		ng.module('mod', [])
			.value('a', 1)
			.value('b', 2);

		ng.init();

		var test = ng.module('mod').instantiate(['a', 'b'], function (a, b) {
			this.result = a + b;
		});
		expect(test.result).toEqual(3);
	});

	it('works with service\'s value dependencies', function () {
		ng.module('mod', [])
			.service('srv', ['a', 'b'], function (a, b) {
				this.result = a + b;
			})
			.value('a', 42)
			.value('b', 4);

		ng.init();

		expect(ng.module('mod').get('srv').result).toEqual(46);
	});

	it('works with service\'s service dependencies', function () {
		ng.module('mod', [])
			.service('srv1', ['srv2', 'srv3'], function (a, b) {
				this.result = a.value + b.value;
			})
			.service('srv2', function () {
				this.value = 42;
			})
			.service('srv3', function () {
				this.value = 4;
			});

		ng.init();

		expect(ng.module('mod').get('srv1').result).toEqual(46);
	});

	it('works with deep service\'s service dependencies', function () {
		ng.module('mod', [])
			.service('srv1', ['srv2'], function (a) {
				this.result = a.value;
			})
			.service('srv2', ['srv3'], function (a) {
				this.value = 42 + a.value;
			})
			.service('srv3', function () {
				this.value = 4;
			});

		ng.init();

		expect(ng.module('mod').get('srv1').result).toEqual(46);
	});

	it('works with deep service\'s module and service dependencies', function () {
		ng.module('mod1', ['mod2'])
			.service('srv1', ['srv2'], function (a) {
				this.result = a.value;
			});
		ng.module('mod2', ['mod3'])
			.service('srv2', ['srv3'], function (a) {
				this.value = 42 + a.value;
			});
		ng.module('mod3', [])
			.service('srv3', function () {
				this.value = 4;
			});

		ng.init();

		expect(ng.module('mod1').get('srv1').result).toEqual(46);
	});

	it('works with deep service\'s module and service circular dependencies', function () {
		ng.module('mod1', ['mod2'])
			.service('srv1', ['srv2'], function (srv2) {
				this.result = srv2.value;
			});
		ng.module('mod2', ['mod3'])
			.service('srv2', ['srv3'], function (srv3) {
				this.value = 42 + srv3.value;
			});
		ng.module('mod3', ['mod1'])
			.service('srv3', ['srv1'], function (srv1) {
				this.value = 4;
				this.result = function () {
					return srv1.result;
				}
			});

		ng.init();

		expect(ng.module('mod3').get('srv3').result()).toEqual(46);
	});

	it('overrides values with services if name collides', function () {
		ng.module('mod1', [])
			.service('val1', function () {
				this.val = 42;
			})
			.value('val1', 21);

		ng.init();

		expect(ng.module('mod1').get('val1').val).toBeDefined();
		expect(ng.module('mod1').get('val1').val).toEqual(42);
	});

	it('overrides values with services on dependent levels if name collides', function () {
		ng.module('mod1', ['mod2']);
		ng.module('mod2', [])
			.service('val2', function () {
				this.val = 42;
			})
			.value('val2', 21);

		ng.init();

		expect(ng.module('mod1').get('val2').val).toBeDefined();
		expect(ng.module('mod1').get('val2').val).toEqual(42);
	});

	it('uses local values if dependent names collide', function () {
		ng.module('mod1', ['mod2'])
			.value('val', 42);
		ng.module('mod2', ['mod1'])
			.value('val', 21);

		ng.init();

		expect(ng.module('mod1').get('val')).toEqual(42);
		expect(ng.module('mod2').get('val')).toEqual(21);
	});

	it('uses local services if dependent names collide', function () {
		ng.module('mod1', ['mod2'])
			.service('val', function () {
				this.val = 42;
			});
		ng.module('mod2', ['mod1'])
			.service('val', function () {
				this.val = 21;
			});

		ng.init();

		expect(ng.module('mod1').get('val').val).toEqual(42);
		expect(ng.module('mod2').get('val').val).toEqual(21);
	});

	it('uses local values if dependent service names collide', function () {
		ng.module('mod1', ['mod2'])
			.value('val', 42);
		ng.module('mod2', ['mod1'])
			.service('val', function () {
				this.val = 21;
			});

		ng.init();

		expect(ng.module('mod1').get('val')).toEqual(42);
		expect(ng.module('mod2').get('val').val).toEqual(21);
	});

	it('uses first dependent value if dependent names collide', function () {
		ng.module('mod', ['mod1', 'mod2', 'mod3']);

		ng.module('mod3', []).value('val', 21);
		ng.module('mod2', []).value('val', 42);
		ng.module('mod1', []);

		ng.init();

		expect(ng.module('mod').get('val')).toEqual(42);
	});

	it('uses first dependent service if dependent names collide', function () {
		ng.module('mod', ['mod1', 'mod2', 'mod3']);

		ng.module('mod3', []).service('val', function () {
			this.val = 21;
		});
		ng.module('mod2', []).service('val', function () {
			this.val = 42;
		});
		ng.module('mod1', []);

		ng.init();

		expect(ng.module('mod').get('val').val).toEqual(42);
	});

	it('invokes annotated runs', function() {
		ng.module('mod', [])
			.run(['a'], function(a) {
				expect(a).toEqual(42);
			})
			.run(['srv'], function(srv) {
				expect(srv.val).toEqual(21);
			})
			.service('srv', ['a'], function(a) {
				this.val = a * 0.5;
			})
			.value('a', 42);

		ng.init();
	});
});