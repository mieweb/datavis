// Imports {{{1

import _ from 'underscore';
import sprintf from 'sprintf-js';
import numeral from 'numeral';

import {
	asyncEach,
	deepCopy,
	deepDefaults,
	getProp,
	getPropDef,
	I,
	makeSubclass,
	mixinEventHandling,
	setProp,
	uuid,
	walkObj,
} from './util/misc.js';

import OrdMap from './util/ordmap.js';
import Lock from './util/lock.js';

import { ComputedView } from './computed_view.js';
import { MirageView } from './mirage_view.js';
import { Perspective } from './perspective.js';
import { Grid } from './grid.js';
import { Graph } from './graph.js';

/**
 * @file
 * This file contains the implementation of the prefs system.
 *
 * ## Terminology
 *
 * - **Perspective**:
 *
 * - **Prefs Module**:
 *
 * - **Prefs Backend**:
 *
 * - **Prime**: Prepare the prefs system for interactive use.  See {@link Prefs#prime}.
 *
 * - **Reset**:
 *
 * ## Responsibilities
 *
 * - Take configuration from bound components and store it in a backend.
 * - Retrieve configuration from a backend and load it into bound components.
 * - Allow management of perspectives, e.g. create new, rename, and delete.
 * - Facilitate switching between perspectives, including via history stack.
 *
 * ## Classes
 *
 * - {@link Prefs}
 * - {@link PrefsBackend}
 *   - {@link PrefsBackendLocalStorage}
 *   - {@link PrefsBackendTemporary}
 * - {@link PrefsModule}
 *   - {@link PrefsModuleComputedView}
 *   - {@link PrefsModuleGrid}
 *   - {@link PrefsModuleGraph}
 */


// PrefsModule {{{1

/**
 * Superclass for prefs modules, which provide a way to:
 *
 *   1. Save the configuration from a bound object to a perspective.
 *   2. Load the configuration from a perspective to a bound object.
 *
 * Each prefs module subclass typically works on a single class for its bound object.
 *
 * @param {object} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {object} target
 * What bound object to interact with.
 *
 * @property {object} [defaultConfig]
 * If set, this is the default configuration to use in the `load` method if none is provided.
 */

var PrefsModule = makeSubclass('PrefsModule', Object, function (prefs, target) {
	var self = this;

	self.prefs = prefs;
	self.target = target;
});

// #load {{{2

/**
 * Applies the provided configuration to the target.
 */

PrefsModule.prototype.load = function (config) {
	throw new Error('Abstract method load() not implemented by subclass ' + this.constructor.name);
};

// #save {{{2

/**
 * Pulls configuration from the target and returns it as an object that can be stored by the
 * preferences backend.
 */

PrefsModule.prototype.save = function () {
	throw new Error('Abstract method save() not implemented by subclass ' + this.constructor.name);
};

// PrefsModuleComputedView {{{1

/**
 * Manages configuration of a view.
 *
 * @param {ComputedView} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {ComputedView} target
 * What bound object to interact with.
 */

var PrefsModuleComputedView = makeSubclass('PrefsModuleComputedView', PrefsModule, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super['PrefsModule'].ctor.apply(self, args);

	if (!(self.target instanceof ComputedView)) {
		throw new Error('Call Error: `target` must be an instance of ComputedView');
	}
}, {
	defaultConfig: {}
});

// #load {{{2

PrefsModuleComputedView.prototype.load = function (config) {
	var self = this;

	if (config.filter != null) {
		self.target.setFilter(config.filter, null, {
			updateData: false,
			savePrefs: false
		});
	}

	if (config.group != null) {
		self.target.setGroup(config.group, {
			updateData: false,
			savePrefs: false
		});
	}

	if (config.pivot != null) {
		self.target.setPivot(config.pivot, {
			updateData: false,
			savePrefs: false
		});
	}

	if (config.aggregate != null) {
		self.target.setAggregate(config.aggregate, {
			updateData: false,
			savePrefs: false
		});
	}

	if (config.sort != null) {
		self.target.setSort(config.sort, {
			updateData: false,
			savePrefs: false
		});
	}

	// For clearing items, go in reverse order.  This is because some of these validate their
	// configuration based on pre-requisites.  For example: you're not allowed to pivot without
	// grouping, so if you are loading a perspective that clears both, you need to clear the pivot
	// before clearing the group, or you'll trigger the "pivot w/o group" warning.

	if (config.sort == null) {
		self.target.clearSort({
			updateData: false,
			savePrefs: false
		});
	}

	if (config.aggregate == null) {
		self.target.clearAggregate({
			updateData: false,
			savePrefs: false
		});
	}

	if (config.pivot == null) {
		self.target.clearPivot({
			updateData: false,
			savePrefs: false
		});
	}

	if (config.group == null) {
		self.target.clearGroup({
			updateData: false,
			savePrefs: false
		});
	}

	if (config.filter == null) {
		self.target.clearFilter({
			updateData: false,
			savePrefs: false
		});
	}
};

// #save {{{2

PrefsModuleComputedView.prototype.save = function () {
	var self = this;

	var prefs = {};

	var sortSpec = self.target.getSort();
	if (sortSpec) {
		prefs.sort = sortSpec;
	}

	var filterSpec = self.target.getFilter();
	if (filterSpec) {
		prefs.filter = deepCopy(filterSpec);
		walkObj(prefs.filter, function (x) {
			if (window.numeral && numeral.isNumeral(x)) {
				return x._value;
			}
			else {
				return x;
			}
		}, {
			callOnNodes: true,
			replace: true
		});
	}

	var groupSpec = self.target.getGroup();
	if (groupSpec) {
		prefs.group = groupSpec;
	}

	var pivotSpec = self.target.getPivot();
	if (pivotSpec) {
		prefs.pivot = pivotSpec;
	}

	var aggregateSpec = self.target.getAggregate();
	if (aggregateSpec) {
		prefs.aggregate = aggregateSpec;
	}

	return prefs;
};

// #reset {{{2

PrefsModuleComputedView.prototype.reset = function () {
	var self = this;

	self.target.reset({
		updateData: false,
		savePrefs: false
	});
};

// PrefsModuleMirageView {{{1

/**
 * Manages configuration of a view.
 *
 * @param {MirageView} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {MirageView} target
 * What bound object to interact with.
 */

var PrefsModuleMirageView = makeSubclass('PrefsModuleMirageView', PrefsModule, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super['PrefsModule'].ctor.apply(self, args);

	if (!(self.target instanceof MirageView)) {
		throw new Error('Call Error: `target` must be an instance of MirageView');
	}
}, {
	defaultConfig: {}
});

// #load {{{2

PrefsModuleMirageView.prototype.load = function (config) {
	var self = this;

	if (config.filter == null) {
		self.target.clearFilter({
			updateData: false,
			savePrefs: false
		});
	}
	else {
		self.target.setFilter(config.filter, null, {
			updateData: false,
			savePrefs: false
		});
	}

	if (config.sort == null) {
		self.target.clearSort({
			updateData: false,
			savePrefs: false
		});
	}
	else {
		self.target.setSort(config.sort, {
			updateData: false,
			savePrefs: false
		});
	}

	if (config.group == null) {
		self.target.clearGroup({
			updateData: false,
			savePrefs: false
		});
	}
	else {
		self.target.setGroup(config.group, {
			updateData: false,
			savePrefs: false
		});
	}

	if (config.pivot == null) {
		self.target.clearPivot({
			updateData: false,
			savePrefs: false
		});
	}
	else {
		self.target.setPivot(config.pivot, {
			updateData: false,
			savePrefs: false
		});
	}

	if (config.aggregate == null) {
		self.target.clearAggregate({
			updateData: false,
			savePrefs: false
		});
	}
	else {
		self.target.setAggregate(config.aggregate, {
			updateData: false,
			savePrefs: false
		});
	}

	// XXX What comes first, module initialization or setting the current perspective?
	self.target.initFromPrefs(self.prefs);
};

// #save {{{2

PrefsModuleMirageView.prototype.save = function () {
	var self = this;

	var prefs = {};

	var sortSpec = self.target.getSort();
	if (sortSpec) {
		prefs.sort = sortSpec;
	}

	var filterSpec = self.target.getFilter();
	if (filterSpec) {
		prefs.filter = deepCopy(filterSpec);
		walkObj(prefs.filter, function (x) {
			if (window.numeral && numeral.isNumeral(x)) {
				return x._value;
			}
			else {
				return x;
			}
		}, {
			callOnNodes: true,
			replace: true
		});
	}

	var groupSpec = self.target.getGroup();
	if (groupSpec) {
		prefs.group = groupSpec;
	}

	var pivotSpec = self.target.getPivot();
	if (pivotSpec) {
		prefs.pivot = pivotSpec;
	}

	var aggregateSpec = self.target.getAggregate();
	if (aggregateSpec) {
		prefs.aggregate = aggregateSpec;
	}

	return prefs;
};

// #reset {{{2

PrefsModuleMirageView.prototype.reset = function () {
	var self = this;

	self.target.reset({
		updateData: false,
		savePrefs: false
	});
};

// PrefsModuleGrid {{{1

/**
 * Manages configuration of a grid.
 *
 * @param {Grid} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {Grid} target
 * What bound object to interact with.
 */

var PrefsModuleGrid = makeSubclass('PrefsModuleGrid', PrefsModule, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super['PrefsModule'].ctor.apply(self, args);

	if (!(self.target instanceof Grid)) {
		throw new Error('Call Error: `target` must be an instance of Grid');
	}
});

// #load {{{2

PrefsModuleGrid.prototype.load = function (config) {
	var self = this;

	if (config == null) {
		return;
	}

	if (config.colConfig != null) {
		self.target.setColConfig(OrdMap.deserialize(config.colConfig), {
			from: 'prefs',
			redraw: false,
			savePrefs: false
		});
	}
};

// #save {{{2

PrefsModuleGrid.prototype.save = function () {
	var self = this;

	var prefs = {};

	var colConfig = self.target.getColConfig();
	if (colConfig != null) {
		prefs.colConfig = colConfig.serialize();
	}

	return prefs;
};

// #reset {{{2

PrefsModuleGrid.prototype.reset = function () {
	var self = this;

	self.target.resetColConfig();
};

// PrefsModuleGraph {{{1

/**
 * Manages configuration of a graph.
 *
 * @param {Graph} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {Graph} target
 * What bound object to interact with.
 */

var PrefsModuleGraph = makeSubclass('PrefsModuleGraph', PrefsModule, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super['PrefsModule'].ctor.apply(self, args);

	if (!(self.target instanceof Graph)) {
		throw new Error('Call Error: `target` must be an instance of Graph');
	}
});

// #load {{{2

PrefsModuleGraph.prototype.load = function (config) {
	var self = this;

	if (config == null) {
		return;
	}

	self.target.setUserConfig(config);
};

// #save {{{2

PrefsModuleGraph.prototype.save = function () {
	var self = this;

	var prefs = deepDefaults(self.target.userConfig, {
		plain: {},
		group: {},
		pivot: {}
	});



	return prefs;
};

// #reset {{{2

PrefsModuleGraph.prototype.reset = function () {
	var self = this;
};

// PrefsModuleMeta {{{1

/**
 * Manages configuration of a perspective.  It sounds really weird, but this is a way to store
 * additional information on the perspective which must be serialized.
 *
 * @param {Perspective} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {Perspective} target
 * What bound object to interact with.
 */

var PrefsModuleMeta = makeSubclass('PrefsModuleMeta', PrefsModule, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super['PrefsModule'].ctor.apply(self, args);

	if (!(self.target instanceof Perspective)) {
		throw new Error('Call Error: `target` must be an instance of Perspective');
	}
});

// #load {{{2

PrefsModuleMeta.prototype.load = function (config) {
	var self = this;

	if (config != null) {
		self.target.meta = config;
	}
};

// #save {{{2

PrefsModuleMeta.prototype.save = function () {
	var self = this;

	return self.target.meta;
};

// #reset {{{2

PrefsModuleMeta.prototype.reset = function () {
	var self = this;
};

// Registries {{{1

/**
 * Associates module names with classes implementing those modules.
 */
var PREFS_MODULE_REGISTRY = new OrdMap();

PREFS_MODULE_REGISTRY.set('view', PrefsModuleComputedView);
PREFS_MODULE_REGISTRY.set('mirage', PrefsModuleMirageView);
PREFS_MODULE_REGISTRY.set('grid', PrefsModuleGrid);
PREFS_MODULE_REGISTRY.set('graph', PrefsModuleGraph);
PREFS_MODULE_REGISTRY.set('meta', PrefsModuleMeta);

// Exports {{{1

export {
	PrefsModule,
	PrefsModuleGrid,
	PrefsModuleGraph,
	PrefsModuleMeta,
	PrefsModuleComputedView,
	PREFS_MODULE_REGISTRY,
};
