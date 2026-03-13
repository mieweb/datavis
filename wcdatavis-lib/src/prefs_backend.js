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
	mixinLogging,
	setProp,
	uuid,
	walkObj,
} from './util/misc.js';

import OrdMap from './util/ordmap.js';
import Lock from './util/lock.js';

import { ComputedView } from './computed_view.js';
import { Grid } from './grid.js';
import { Graph } from './graph.js';
import { Perspective } from './perspective.js';

// PrefsBackend {{{1

// Constructor {{{2

/**
 * Base class for all preference backends.  Almost all methods of this class are abstract, so you
 * will need to instantiate a subclass like PrefsBackendLocalStorage.
 *
 * Generally speaking, methods that gets data is asynchronous and therefore require a callback;
 * methods that set data support callbacks but don't require them.  In that case, omitting the
 * callback means you don't want to know if the operation succeeded or not.
 *
 * @class
 *
 * @param {string} id
 * @param {Prefs} prefs
 * @param {object} [opts]
 */

var PrefsBackend = makeSubclass('PrefsBackend', Object, function (id, prefs, opts) {
	var self = this;

	self.id = id;
	self.prefs = prefs;
	self.opts = opts;
});

mixinLogging(PrefsBackend);

// #load {{{2

/**
 * Loads the configuration for the specified perspective.  A subclass implementation need not
 * support loading perspectives individually, but that's how this function is called.  (For example,
 * an implementation could retrieve all available perspectives from somewhere and just give `cont`
 * the one that was requested.)
 *
 * @abstract
 *
 * @param {string} id
 * @param {function} cont
 */

PrefsBackend.prototype.load = function (id, cont) {
	throw new Error('Abstract method load() not implemented by subclass ' + this.constructor.name);
};

// #loadAll {{{2

/**
 * Loads all perspectives.
 *
 * @abstract
 *
 * @param {function} cont
 */

PrefsBackend.prototype.loadAll = function (cont) {
	throw new Error('Abstract method loadAll() not implemented by subclass ' + this.constructor.name);
};

// #save {{{2

/**
 * Callback for when the prefs are done being saved.
 *
 * @callback PrefsBackend~save_cont
 *
 * @param {boolean} ok
 * If true, then the operation was successful; if false, then an error occurred.
 *
 * @param {string} [errmsg]
 * If `ok` is false, this is the error that occurred.
 */

/**
 * Saves the configuration for the specified perspective.  A subclass implementation need not
 * support saving perspectives individually, but that's how this function is called.  (For example,
 * an implementation could update the `id` perspective in a big object containing all available
 * perspectives, and store the whole thing somewhere.)
 *
 * @abstract
 *
 * @param {Perspective} perspective
 * @param {PrefsBackend~save_cont} [cont]
 */

PrefsBackend.prototype.save = function (perspective, cont) {
	throw new Error('Abstract method save() not implemented by subclass ' + this.constructor.name);
};

// #getPerspectives {{{2

/**
 * @callback PrefsBackend~getPerspectives_cont
 * @param {string[]} ids
 * List of the IDs of all currently available perspectives.
 */

/**
 * Get the IDs of all the available perspectives.
 *
 * @abstract
 *
 * @param {PrefsBackend~getPerspectives_cont} cont
 * Callback function to receive the perspective IDs.
 */

PrefsBackend.prototype.getPerspectives = function (cont) {
	throw new Error('Abstract method getPerspectives() not implemented by subclass ' + this.constructor.name);
};

// #getCurrent {{{2

/**
 * Get the ID of the current perspective.
 *
 * @abstract
 *
 * @param {function} cont
 */

PrefsBackend.prototype.getCurrent = function (cont) {
	throw new Error('Abstract method getCurrent() not implemented by subclass ' + this.constructor.name);
};

// #setCurrent {{{2

/**
 * Set the ID of the current perspective.
 *
 * @abstract
 *
 * @param {string} id
 * @param {function} [cont]
 */

PrefsBackend.prototype.setCurrent = function (id, cont) {
	throw new Error('Abstract method setCurrent() not implemented by subclass ' + this.constructor.name);
};

// #rename {{{2

/**
 * Rename a perspective in the backend, i.e. store that the perspective previously known as
 * `oldName` is now called `newName`.
 *
 * @abstract
 *
 * @param {string} oldName Perspective's old name.
 * @param {string} newName Perspective's new name.
 * @param {function} [cont]
 */

PrefsBackend.prototype.rename = function (oldName, newName, cont) {
	throw new Error('Abstract method rename() not implemented by subclass ' + this.constructor.name);
};

// #delete {{{2

/**
 * Delete a perspective in the backend.
 *
 * @abstract
 *
 * @param {string} id
 * @param {function} [cont]
 */

PrefsBackend.prototype.deletePerspective = function (id, cont) {
	throw new Error('Abstract method deletePerspective() not implemented by subclass ' + this.constructor.name);
};

// #reset {{{2

/**
 * Reset all preferences.
 *
 * @abstract
 *
 * @param {function} [cont]
 */

PrefsBackend.prototype.reset = function (cont) {
	throw new Error('Abstract method reset() not implemented by subclass ' + this.constructor.name);
};

// PrefsBackendLocalStorage {{{1

// Constructor {{{2

/**
 * @class
 * @extends PrefsBackend
 *
 *
 * @param {string} id
 * @param {object} [opts]
 * @param {string} [opts.key="WC_DataVis_Prefs"]
 */

var PrefsBackendLocalStorage = makeSubclass('PrefsBackendLocalStorage', PrefsBackend, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	try {
		var storage = window.localStorage;
	}
	catch (e) {
		self.logError(self.makeLogTag() + ' Access to localStorage is denied; prefs disabled');
		throw e;
	}

	self.super['PrefsBackend'].ctor.apply(self, args);

	self.opts = deepDefaults(self.opts, {
		key: 'WC_DataVis_Prefs'
	});

	self.localStorageKey = self.opts.key;
}, {
	version: 3
});

// #load {{{2

PrefsBackendLocalStorage.prototype.load = function (id, cont) {
	var self = this;
	var storedPrefStr, storedPrefObj;
	var version;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	storedPrefStr = localStorage.getItem(self.localStorageKey);

	if (storedPrefStr != null) {
		storedPrefObj = JSON.parse(storedPrefStr);
		version = getPropDef(0, storedPrefObj, self.id, 'version');

		if (version < self.version) {
			return self.migrate(version, function () {
				return self.loadAll(cont);
			});
		}
	}
	else {
		storedPrefObj = {};
	}

	var perspective = getProp(storedPrefObj, self.id, 'perspectives', id);

	if (perspective == null) {
		self.logDebug(self.makeLogTag() + ' Perspective does not exist: id = "%s"', id);
		return cont(null);
	}

	self.logDebug(self.makeLogTag() + ' Loaded perspective: id = "%s" ; name = "%s" ; config = %O',
		perspective.id, perspective.name, perspective.config);

	return cont(perspective);
};

// #loadAll {{{2

PrefsBackendLocalStorage.prototype.loadAll = function (cont) {
	var self = this;
	var storedPrefStr, storedPrefObj;
	var version;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	storedPrefStr = localStorage.getItem(self.localStorageKey);

	if (storedPrefStr != null) {
		storedPrefObj = JSON.parse(storedPrefStr);
		version = getPropDef(0, storedPrefObj, self.id, 'version');

		if (version < self.version) {
			return self.migrate(version, function () {
				return self.loadAll(cont);
			});
		}
	}
	else {
		storedPrefObj = {};
	}

	var perspectives = getPropDef({}, storedPrefObj, self.id, 'perspectives');
	self.logDebug(self.makeLogTag() + ' Loaded all perspectives: %O', perspectives);
	return cont(perspectives);
};

// #migrate {{{2

PrefsBackendLocalStorage.prototype.migrate = function (version, cont) {
	var self = this;

	self.logDebug(self.makeLogTag() + ' Migrating prefs: v%d -> v%d', version, self.version);

	var readConfig = function () {
		var localStorageStr = localStorage.getItem(self.localStorageKey);

		if (localStorageStr == null) {
			throw new Error('Found no prefs to migrate');
		}

		try {
			var localStorageObj = JSON.parse(localStorageStr);
		}
		catch (e) {
			throw new Error('Prefs stored are not valid JSON');
		}

		if (localStorageObj[self.id] == null) {
			throw new Error('No prefs registered for this system ("' + self.id + '")');
		}

		if (localStorageObj[self.id].perspectives == null) {
			localStorageObj[self.id].perspectives = {};
		}

		return localStorageObj;
	};

	var writeConfig = function (localStorageObj) {
		localStorageObj[self.id].version += 1;
		localStorage.setItem(self.localStorageKey, JSON.stringify(localStorageObj));
	};

	var localStorageObj;

	for (var i = version; i < self.version; i += 1) {
		switch (i) {
		case 0:
			var oldPrefs = JSON.parse(localStorage.getItem('WC_DataVis_Prefs') || '{}');
			var oldCurrent = JSON.parse(localStorage.getItem('WC_DataVis_Prefs_Current') || '{}');
			var newPrefs = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');

			newPrefs[self.id] = {
				version: i + 1,
				current: oldCurrent[self.id],
				perspectives: _.mapObject(oldPrefs[self.id], function (config, id) {
					return {
						view: config
					};
				})
			};

			// We can delete the "current" storage item completely if it's not being used anymore.

			delete oldCurrent[self.id];

			if (_.isEmpty(oldCurrent)) {
				localStorage.removeItem('WC_DataVis_Prefs_Current');
			}
			else {
				localStorage.setItem('WC_DataVis_Prefs_Current', JSON.stringify(oldCurrent));
			}

			// We can delete the "prefs" storage item completely if it's not being used anymore.
			// Only bother with this if the storage key is different from the old hard-coded key.
			// If it's the same, there's no point because we're just going to overwrite it.

			delete oldPrefs[self.id];

			if (self.localStorageKey !== 'WC_DataVis_Prefs') {
				if (_.isEmpty(oldPrefs)) {
					localStorage.removeItem('WC_DataVis_Prefs');
				}
				else {
					localStorage.setItem('WC_DataVis_Prefs', JSON.stringify(oldPrefs));
				}
			}

			localStorage.setItem(self.localStorageKey, JSON.stringify(newPrefs));
			break;
		case 1:
			localStorageObj = readConfig();

			// Perspectives now store module configuration in a property called `config` with some new
			// information added at the toplevel.

			_.each(localStorageObj[self.id].perspectives, function (p, id) {
				var config = {};
				_.each(p, function (v, k) {
					config[k] = v;
					p[k] = null;
				});
				p.config = config;
				p.id = id;
				p.name = id;
			});

			writeConfig(localStorageObj);
			break;
		case 2:
			localStorageObj = readConfig();

			// The configuration for `view` is now known as `computedView` since we now have multiple
			// types of view which are configured separately.

			_.each(localStorageObj[self.id].perspectives, function (p) {
				if (getProp(p, 'config', 'view') != null) {
					p.config.computedView = p.config.view;
					delete p.config.view;
				}
			});

			writeConfig(localStorageObj);
			break;
		}
	}

	return typeof cont === 'function' ? cont(true) : true;
};

// #save {{{2

PrefsBackendLocalStorage.prototype.save = function (perspective, cont) {
	var self = this;

	if (!(perspective instanceof Perspective)) {
		throw new Error('Call Error: `perspective` must be a Perspective');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.logDebug(self.makeLogTag() + ' Saving perspective: id = "%s" ; name = "%s" ; config = %O',
		perspective.id, perspective.name, perspective.config);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	setProp(self.version, storedPrefData, self.id, 'version');
	setProp({
		id: perspective.id,
		name: perspective.name,
		config: perspective.config
	}, storedPrefData, self.id, 'perspectives', perspective.id);
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return cont(true);
};

// #getPerspectives {{{2

PrefsBackendLocalStorage.prototype.getPerspectives = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	var perspectives = _.keys(getPropDef({}, storedPrefData, self.id, 'perspectives'));

	self.logDebug(self.makeLogTag() + ' Found %d perspectives: %s', perspectives.length, JSON.stringify(perspectives));

	return cont(perspectives);
};

// #getCurrent {{{2

PrefsBackendLocalStorage.prototype.getCurrent = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	var current = getProp(storedPrefData, self.id, 'current');

	self.logDebug(self.makeLogTag() + ' Current perspective is "%s"', current);

	return cont(current);
};

// #setCurrent {{{2

PrefsBackendLocalStorage.prototype.setCurrent = function (id, cont) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.logDebug(self.makeLogTag() + ' Setting current perspective to "%s"', id);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	setProp(self.version, storedPrefData, self.id, 'version');
	setProp(id, storedPrefData, self.id, 'current');
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return cont(true);
};

// #rename {{{2

PrefsBackendLocalStorage.prototype.rename = function (oldName, newName, cont) {
	var self = this;

	if (typeof oldName !== 'string') {
		throw new Error('Call Error: `oldName` must be a string');
	}
	if (typeof newName !== 'string') {
		throw new Error('Call Error: `newName` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.logDebug(self.makeLogTag() + ' Renaming perspective: "%s" -> "%s"', oldName, newName);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	storedPrefData[self.id]['perspectives'][newName] = storedPrefData[self.id]['perspectives'][oldName];
	delete storedPrefData[self.id]['perspectives'][oldName];
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return cont(true);
};

// #delete {{{2

PrefsBackendLocalStorage.prototype.deletePerspective = function (id, cont) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.logDebug(self.makeLogTag() + ' Deleting perspective: "%s"', id);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	delete storedPrefData[self.id]['perspectives'][id];
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return cont(true);
};

// #reset {{{2

PrefsBackendLocalStorage.prototype.reset = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.logDebug(self.makeLogTag() + ' Resetting perspectives');

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	delete storedPrefData[self.id];
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return cont(true);
};

// PrefsBackendTemporary {{{1

// Constructor {{{2

/**
 * @class
 * @extends PrefsBackend
 *
 * @param {string} id
 */

var PrefsBackendTemporary = makeSubclass('PrefsBackendTemporary', PrefsBackend, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super['PrefsBackend'].ctor.apply(self, args);
	self.storage = {
		perspectives: {}
	};
});

// #load {{{2

PrefsBackendTemporary.prototype.load = function (id, cont) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var perspective = self.storage.perspectives[id];

	if (perspective == null) {
		self.logDebug(self.makeLogTag() + ' Perspective does not exist: id = "%s"', id);
		return cont(null);
	}

	self.logDebug(self.makeLogTag() + ' Loaded perspective: id = "%s" ; name = "%s" ; config = %O',
		perspective.id, perspective.name, perspective.config);

	return cont(perspective);
};

// #loadAll {{{2

PrefsBackendTemporary.prototype.loadAll = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var perspectives = self.storage.perspectives;
	self.logDebug(self.makeLogTag() + ' Loaded all perspectives: %O', perspectives);
	return cont(perspectives);
};

// #save {{{2

PrefsBackendTemporary.prototype.save = function (perspective, cont) {
	var self = this;

	if (!(perspective instanceof Perspective)) {
		throw new Error('Call Error: `perspective` must be a Perspective');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.logDebug(self.makeLogTag() + ' Saving perspective: id = "%s" ; name = "%s" ; config = %O',
		perspective.id, perspective.name, perspective.config);

	self.storage.perspectives[perspective.id] = {
		id: perspective.id,
		name: perspective.name,
		config: perspective.config
	};

	return cont(true);
};

// #getPerspectives {{{2

PrefsBackendTemporary.prototype.getPerspectives = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var perspectives = _.keys(self.storage.perspectives);

	self.logDebug(self.makeLogTag() + ' Found %d perspectives: %s', perspectives.length, JSON.stringify(perspectives));

	return cont(perspectives);
};

// #getCurrent {{{2

PrefsBackendTemporary.prototype.getCurrent = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var current = self.storage.current;

	self.logDebug(self.makeLogTag() + ' Current perspective is "%s"', current);

	return cont(current);
};

// #setCurrent {{{2

PrefsBackendTemporary.prototype.setCurrent = function (id, cont) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.logDebug(self.makeLogTag() + ' Setting current perspective to "%s"', id);

	self.storage.current = id;

	return cont(true);
};

// #rename {{{2

PrefsBackendTemporary.prototype.rename = function (oldName, newName, cont) {
	var self = this;

	if (typeof oldName !== 'string') {
		throw new Error('Call Error: `oldName` must be a string');
	}
	if (typeof newName !== 'string') {
		throw new Error('Call Error: `newName` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.logDebug(self.makeLogTag() + ' Renaming perspective: "%s" -> "%s"', oldName, newName);

	self.storage.perspectives[newName] = self.storage.perspectives[oldName];
	delete self.storage.perspectives[oldName];

	return cont(true);
};

// #delete {{{2

PrefsBackendTemporary.prototype.deletePerspective = function (id, cont) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.logDebug(self.makeLogTag() + ' Deleting perspective: "%s"', id);

	delete self.storage.perspectives[id];

	return cont(true);
};

// #reset {{{2

PrefsBackendTemporary.prototype.reset = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.logDebug(self.makeLogTag() + ' Resetting perspectives');

	self.storage = {
		perspectives: {}
	};

	return cont(true);
};

// Registries {{{1

/**
 * Associates backend names with classes implementing those modules.
 */
var PREFS_BACKEND_REGISTRY = new OrdMap();

PREFS_BACKEND_REGISTRY.set('localStorage', PrefsBackendLocalStorage);
PREFS_BACKEND_REGISTRY.set('temporary', PrefsBackendTemporary);

// Exports {{{1

export {
	PrefsBackend,
	PrefsBackendLocalStorage,
	PrefsBackendTemporary,
	PREFS_BACKEND_REGISTRY,
};
