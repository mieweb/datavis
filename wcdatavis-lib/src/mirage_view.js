// Imports {{{1

import _ from 'underscore';
import {
	deepCopy,
	deepDefaults,
	getProp,
	I,
	makeSubclass,
	mixinNameSetting,
} from './util/misc.js';
import { MirageSource } from './mirage_source.js';
import { View } from './view.js';
import { Source } from './source.js';
import { Prefs } from './prefs.js';

// MirageView {{{1

// Constructor {{{2

/**
 * @param {View} view
 *
 * @param {Object} [opts]
 *
 * @param {Object} [opts.backend]
 * This configuration is mirage data backend.
 *
 * @param {string} [opts.name]
 * Name of this instance used for logging messages; if omitted, one will be generated automatically.
 *
 * @class
 *
 * @property {string} name
 *
 * @property {ComputedView~Data} data
 *
 * @property {MirageSource} source
 */

var MirageView = makeSubclass('MirageView', View, function (opts) {
	var self = this;

	self.opts = deepDefaults(opts, {});

	self.setName(self.opts.name);

	self.source = new MirageSource(self.opts);
}, {
	prefsModule: 'mirage'
});

// #initFromView {{{2

MirageView.prototype.initFromView = function (prefs, view, source, ok, fail) {
	var self = this;

	if (!(prefs instanceof Prefs)) {
		throw new Error('Call Error: `prefs` must be an instance of Prefs');
	}
	if (!(view instanceof View)) {
		throw new Error('Call Error: `view` must be an instance of View');
	}
	if (!(source instanceof Source)) {
		throw new Error('Call Error: `source` must be an instance of Source');
	}
	if (ok != null && typeof ok !== 'function') {
		throw new Error('Call Error: `ok` must be null or a function');
	}
	if (fail != null && typeof fail !== 'function') {
		throw new Error('Call Error: `fail` must be null or a function');
	}

	ok = ok || I;
	fail = fail || I;

	self.setFilter(view.getFilter());
	self.setGroup(view.getGroup());
	self.setPivot(view.getPivot());
	self.setAggregate(view.getAggregate());
	self.setSort(view.getSort());

	// Copy data from the original view.

	view.getTypeInfo(function (isOk, typeInfo) {
		if (isOk) {
			self.typeInfo = typeInfo;
			view.getData(function (isOk, data) {
				if (isOk) {
					self.data = data;
					self.source.initFromView(prefs, view, source);
					return ok();
				}
				else {
					return fail();
				}
			});
		}
		else {
			return fail();
		}
	});
};

// #initFromPrefs {{{2

MirageView.prototype.initFromPrefs = function (prefs, config) {
	var self = this;

	self.opts = config;
	self.source.initFromPrefs(prefs);
};

// Delegation, Mixins, Events {{{2

mixinNameSetting(MirageView);

// #toString {{{2

MirageView.prototype.toString = function () {
	var self = this;
	return 'MirageView(' + self.name + ')';
};

// #prime {{{2

MirageView.prototype.prime = function (cont) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	if (self.isPrimed) {
		return cont(false);
	}

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.prime.apply(self, args);
		}, 'Waiting to prime');
	}

	self.lock.lock('Priming!');

	self.prefs.prime(function () {
		self.source.getData(function () {
			self.prefs.bind('mirage_view', self);
			self.isPrimed = true;
			self.lock.unlock();
			cont(true);
		});
	});
};

// #getData {{{2

MirageView.prototype.getData = function (cont, reason) {
	var self = this;

	if (self.data) {
		return cont(true, self.data);
	}

	self.load(function (typeInfo, data, viewConfig, sourceConfig) {
		var setConfigOpts = {
			updateData: false,
			savePrefs: false
		};

		self.typeInfo = typeInfo;
		self.data = data;

		self.setFilter(viewConfig.filterSpec, null, setConfigOpts);
		self.setGroup(viewConfig.groupSpec, setConfigOpts);
		self.setPivot(viewConfig.pivotSpec, setConfigOpts);
		self.setAggregate(viewConfig.aggregateSpec, setConfigOpts);
		self.setSort(viewConfig.sortSpec, setConfigOpts);

		return cont(true, self.data);
	}, function (msg) {
		self.logError(self.makeLogTag() + ' GET DATA', msg);
		return cont(false);
	});
};

// #getTypeInfo {{{2

MirageView.prototype.getTypeInfo = function (cont) {
	var self = this;

	if (self.typeInfo) {
		return cont(true, self.typeInfo);
	}

	self.load(function (typeInfo, data) {
		self.typeInfo = typeInfo;
		self.data = data;
		return cont(true, self.typeInfo);
	}, function () {
		return cont(false);
	});
};

// #refresh {{{2

MirageView.prototype.refresh = function () {
	var self = this;
};

// #save {{{2

MirageView.prototype.save = function (ok, fail) {
	var self = this;
	return self.source.save(self.data, self.typeInfo, ok, fail);
};

// #load {{{2

MirageView.prototype.load = function (ok, fail) {
	var self = this;
	return self.source.load(ok, fail);
};

// #setPerspectiveName {{{2

MirageView.prototype.setPerspectiveName = function (perspectiveName) {
	var self = this;

	self.source.setPerspectiveName(perspectiveName);
	self.perspectiveName = perspectiveName;
};

// Exports {{{1

export {
	MirageView
};
