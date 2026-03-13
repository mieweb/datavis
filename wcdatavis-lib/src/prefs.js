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
	mixinNameSetting,
	setProp,
	uuid,
	walkObj,
} from './util/misc.js';

import OrdMap from './util/ordmap.js';
import Lock from './util/lock.js';

import { trans } from './trans.js';

import { Grid } from './grid.js';
import { Graph } from './graph.js';

import { Perspective } from './perspective.js';
import { PREFS_BACKEND_REGISTRY } from './prefs_backend.js';
import { PREFS_MODULE_REGISTRY } from './prefs_module.js';

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
 *   - {@link PrefsModuleMirageView}
 *   - {@link PrefsModuleGrid}
 *   - {@link PrefsModuleGraph}
 */

// Prefs {{{1

// Constructor {{{2

/**
 * Creates a new Prefs instance.
 *
 * @param {string} name
 *
 * @param {object} moduleBindings
 * Maps module names to the target instances those modules control.
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.autoSave=true]
 *
 * If true, save preferences automatically any time they change.
 *
 * @param {object} [opts.backend]
 *
 * @param {string} [opts.backend.type="localStorage"]
 * The type of the backend to use when saving prefs.  Must be a key in the `PREFS_BACKEND_REGISTRY`
 * object, which maps the type to a constructor.
 *
 * @class
 *
 * Represents the single entry point to the preferences system.  Preferences consist of:
 *
 *   - One backend, which stores preference data for retrieval in another session.
 *   - Multiple perspectives, which represent different ways of looking at the same data.
 *
 * @property {string} name
 * Unique identifier for this Prefs instance; used as the primary key by the backend.
 *
 * @property {boolean} isInitialized
 * If true, this Prefs instance has already been initialized.
 *
 * @property {boolean} isPrimed
 * If true, this Prefs instance has already been primed.
 *
 * @property {PrefsBackend} backend
 *
 * @property {object} moduleBindings
 * How perspectives know how to load/save their configurations to/from real things.  Keys are module
 * names, values are targets that are bound to the module.  The actual load/save functionality is
 * contained within PrefsModule subclasses.
 *
 * @property {string[]} availablePerspectives
 * List of all the perspective names that we know about.
 *
 * @property {Object.<string,Perspective>} perspectives
 *
 * @property {Perspective} currentPerspective
 * The current perspective.
 *
 * @property {Perspective[]} bardo
 * List of perspectives to be preserved when resetting prefs.  Any perspectives which are both
 * temporary and essential are saved here, and restored automatically after removing all other
 * perspectives.
 *
 * @property {Array.<Perspective>} history
 * List of perspectives in the history.
 *
 * @property {number} historyIndex
 * Pointer to where we currently are in the history list.
 */

var Prefs = makeSubclass('Prefs', Object, function (name, moduleBindings, opts) {
	var self = this;

	if (typeof name !== 'string') {
		throw new Error('Call Error: `name` must be a string');
	}
	if (moduleBindings != null && typeof moduleBindings !== 'object') {
		throw new Error('Call Error: `moduleBindings` must be null or an object');
	}
	if (opts != null && typeof opts !== 'object') {
		throw new Error('Call Error: `opts` must be null or an object');
	}

	self.setName(name);
	self.modules = {};
	self.bardo = {};
	self.primeLock = new Lock('Prefs Prime');

	self.opts = deepDefaults(opts, {
		autoSave: true,
		saveCurrent: true,
		savePerspectives: true,
		backend: {
			type: Prefs.DEFAULT_BACKEND_TYPE
		}
	});

	self.init();

	// Create the backend for saving preferences.

	if (!PREFS_BACKEND_REGISTRY.isSet(self.opts.backend.type)) {
		throw new Error('PREFS BACKEND IS NOT REGISTERED'); // XXX
	}

	var backendCtor = PREFS_BACKEND_REGISTRY.get(self.opts.backend.type);
	var backendCtorOpts = self.opts.backend[self.opts.backend.type];

	self.logDebug(self.makeLogTag() + ' Creating new preferences backend: name = "%s" ; type = %s ; opts = %O',
		self.name, self.opts.backend.type, backendCtorOpts);

	// If creating the backend fails for any reason (e.g. unable to access localStorage) then fall
	// back to a "temporary" prefs backend that doesn't actually save or load anything.

	//try {
		self.backend = new backendCtor(self.name, self, backendCtorOpts);
	//}
	//catch (e) {
	//	self.bakend = new PrefsBackendTemporary();
	//}

	if (moduleBindings != null) {
		_.each(moduleBindings, function (target, moduleName) {
			self.bind(moduleName, target);
		});
	}
});

/**
 * Default backend type, for when none is specified.  Must be a valid key of something in {@link
 * PREFS_BACKEND_REGISTRY}.
 */

Prefs.DEFAULT_BACKEND_TYPE = 'localStorage';

// Mixins {{{2

mixinEventHandling(Prefs, [
	'perspectiveAdded'   // Fired when a perspective is added.
, 'perspectiveDeleted' // Fired when a perspective is deleted.
, 'perspectiveRenamed' // Fired when a perspective is renamed.
, 'perspectiveChanged' // Fired when the current perspective has changed.
, 'prefsHistoryStatus'
, 'prefsReset'
, 'prefsChanged'
, 'prefsSaved'
, 'moduleBound'
, 'primed'
]);

mixinLogging(Prefs);
mixinNameSetting(Prefs);

// Event JSDoc {{{3

/**
 * Fired when a new perspective is added.
 *
 * @event Prefs#perspectiveAdded
 *
 * @param {string} id
 * ID of the new perspective.
 */

/**
 * Fired when a perspective is deleted.
 *
 * @event Prefs#perspectiveDeleted
 *
 * @param {string} deletedId
 * ID of the perspective being deleted.
 *
 * @param {string} newCurrentId
 * ID of the new current perspective.
 */

/**
 * Fired when a perspective is renamed.
 *
 * @event Prefs#perspectiveRenamed
 *
 * @param {string} id
 * ID of the perspective being renamed.
 *
 * @param {string} newName
 * New name of the perspective.
 */

/**
 * Fired when the current perspective is changed.
 *
 * @event Prefs#perspectiveChanged
 *
 * @param {string} newCurrentId
 * ID of the new current perspective.
 *
 * @param {Perspective} newPerspective
 * The new perspective that was loaded.
 */

/**
 * Fired when the perspective history stack changes.
 *
 * @event Prefs#prefsHistoryStatus
 *
 * @param {boolean} canGoFoward
 * If true, there are history stack elements "after" this one.
 *
 * @param {boolean} canGoBack
 * If true, there are history stack elements "before" this one.
 */

/**
 * Fired when prefs are completely reset.
 *
 * @event Prefs#prefsReset
 */

/**
 * Fired when the prefs system binds a module.
 *
 * @event Prefs#moduleBound
 *
 * @param {string} moduleName
 * Name of the module being bound, e.g. "grid" or "computed_view."
 *
 * @param {PrefsModule} module
 * The instance configuring the target.
 *
 * @param {object} target
 * The target object, what is configured via the module.
 *
 * @param {object} opts
 * Any additional options passed by the target when it bound itself to a module in the prefs system.
 */

// #toString {{{2

Prefs.prototype.toString = function () {
	var self = this;
	return 'Prefs(' + self.name + ', ' + self.opts.backend.type + ')';
};

// #init {{{2

/**
 * Initialize internal data structures.
 */

Prefs.prototype.init = function () {
	var self = this;

	if (self.isInitialized) {
		return;
	}

	self.logDebug(self.makeLogTag() + ' Initializing prefs system');

	self.isInitialized = true;
	self.perspectives = {};
	self.availablePerspectives = [];
	self.currentPerspective = null;
	self.history = [];
	self.historyIndex = 0;
};

// #prime {{{2

/**
 * Prime the prefs system for first use.  This involves:
 *
 *   1. Retrieving the list of available perspectives from the backend.
 *   2. Determine the current perspective name, possibly from the backend.
 *   3. Load the current perspective from the backend.
 *   4. Switch to the current perspective (which loads it into bound modules).
 *
 * The prefs system is now ready for interactive use.
 *
 * TODO This should lock the prefs system so it can't be interacted with.
 *
 * @param {function} cont
 * What to do after the prefs system is primed.  Receives `false` if the prefs system was already
 * primed before this call.  Receives `true` if this was the first time the prefs system was primed.
 */

Prefs.prototype.prime = function (cont) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	if (self.isPrimed) {
		return cont(false);
	}

	if (self.primeLock.isLocked()) {
		return self.primeLock.onUnlock(function () {
			self.prime.apply(self, args);
		});
	}

	self.primeLock.lock();

	var makeFinishCont = function (status) {
		return function () {
			self.logDebug(self.makeLogTag('prime') + ' End');
			self.isPrimed = true;
			self.primeLock.unlock();
			return cont(status);
		};
	};

	self.init();

	self.logDebug(self.makeLogTag('prime') + ' Begin');

	return self.backend.getPerspectives(function (ids) {
		self.availablePerspectives = _.union(self.availablePerspectives, ids);
		self.backend.loadAll(function (perspectives) {
			asyncEach(_.values(perspectives), function (x, i, next) {
				self.addPerspective(x.id, x.name, x.config, null, next, {
					switch: false
				});
			}, function () {
				// When there's already a current perspective (as would be the case when prefs have been
				// pre-configured), we don't have to do anything else.

				self.logDebug(self.makeLogTag('prime') + ' Finished adding all perspectives');

				self.fire('primed');

				if (self.currentPerspective != null) {
					return makeFinishCont(true)();
				}
				else if (self.availablePerspectives.length === 0) {
					// There are no perspectives available, so we need to make a basic one.

					self.logDebug(self.makeLogTag('prime') + ' No perspectives exist, creating one');

					return self.addMainPerspective(makeFinishCont(true));
				}
				else {
					// Otherwise, we need to figure out what the last current perspective was and load it.

					return self.backend.getCurrent(function (currentId) {
						if (currentId == null) {
							// There's no current perspective, somehow, so again just create one.

							self.logDebug(self.makeLogTag('prime') + ' No current perspective set, creating one');

							return self.addMainPerspective(makeFinishCont(true));
						}
						else {
							self.setCurrentPerspective(currentId, makeFinishCont(true));
						}
					}); // self.backend.getCurrent()
				}
			}); // asyncEach()
		}); // self.backend.loadAll()
	}); // self.backend.getPerspectives()
};

// #_firePrefsHistoryStatus {{{2

Prefs.prototype._firePrefsHistoryStatus = function () {
	var self = this;

	self.fire('prefsHistoryStatus', null, self.historyIndex < self.history.length - 1, self.historyIndex > 0);
};

// #back {{{2

/**
 * Navigate back in the perspective history stack.
 *
 * @fires Prefs#prefsHistoryStatus
 */

Prefs.prototype.back = function () {
	var self = this;

	if (self.historyIndex === self.history.length - 1) {
		// Already at beginning of history, can't go back anymore.
		return;
	}

	self.historyIndex += 1;
	//self._historyDebug();
	self._firePrefsHistoryStatus();
	self.setCurrentPerspective(self.history[self.historyIndex].id, null, {
		resetHistory: false
	});
};

// #forward {{{2

/**
 * Navigate forward in the perspective history stack.
 *
 * @fires Prefs#prefsHistoryStatus
 */

Prefs.prototype.forward = function () {
	var self = this;

	if (self.historyIndex === 0) {
		// Already at end of history, can't go back anymore.
		return;
	}

	self.historyIndex -= 1;
	//self._historyDebug();
	self._firePrefsHistoryStatus();
	self.setCurrentPerspective(self.history[self.historyIndex].id, null, {
		resetHistory: false
	});
};

// #_resetHistory {{{2

Prefs.prototype._resetHistory = function (p) {
	var self = this;

	// Example: self._resetHistory(x)
	//
	// BEFORE ----------------------------
	//   [ A B C D E ]
	//         ^ (history index)
	//
	// AFTER -----------------------------
	//   [ P C D E ]
	//     ^ (history index)

	self.history.splice(0, self.historyIndex);
	if (p != null) {
		self.history.unshift(p);
	}
	self.historyIndex = 0;
	//self._historyDebug();
	self._firePrefsHistoryStatus();
};

// #_historyDebug {{{2

Prefs.prototype._historyDebug = function () {
	var self = this;

	self.logInfo(self.makeLogTag() + ' ### HISTORY ### [%d] %O', self.historyIndex, self.history.map(function (x) { return x.name; }));
};

// #bind {{{2

/**
 * Binds a module and target to the prefs system.
 *
 * @param {string} moduleName
 * Name of the module to bind.  Corresponds to a key in {@link PREFS_MODULE_REGISTRY}.
 *
 * @param {object} target
 * The object that will be controlled by the module.
 *
 * @param {object} moduleBoundUserData
 * Userdata forwarded to the `moduleBound` event handler.
 *
 * @fires Prefs#moduleBound
 */

Prefs.prototype.bind = function (moduleName, target, moduleBoundUserData) {
	var self = this;

	if (typeof moduleName !== 'string') {
		throw new Error('Call Error: `moduleName` must be a string');
	}
	if (target == null) {
		throw new Error('Call Error: `target` is required');
	}

	// Make sure that the module is registered with a class, otherwise we obviously have no idea what
	// to do with it.

	if (!PREFS_MODULE_REGISTRY.isSet(moduleName)) {
		throw new Error('Module is not registered: ' + moduleName);
	}

	var moduleCtor = PREFS_MODULE_REGISTRY.get(moduleName);
	self.modules[moduleName] = new moduleCtor(self, target);

	self.logDebug(self.makeLogTag('bind') + ' Binding module %s to target %s', moduleName, target.toString());

	self.fire('moduleBound', null, moduleName, self.modules[moduleName], target, moduleBoundUserData);

	// When we're adding a binding with a perspective already loaded, reload it for the new binding.

	if (self.currentPerspective != null) {
		self.currentPerspective.load([moduleName]);
	}
};

// #getPerspectives {{{2

Prefs.prototype.getPerspectives = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	return cont(self.availablePerspectives);
};

// #getPerspective {{{2

/**
 * Queries for a perspective.
 *
 * @param {Object} [qry]
 * Query to determine what perspective to clone.  If missing, uses the current perspective.
 *
 * @param {string} [qry.id]
 * Clone perspective with this ID.
 *
 * @param {string} [qry.name]
 * Clone perspective with this name.  Currently, multiple perspectives with the same name are
 * allowed, so the one that gets returned is arbitrary.
 *
 * @returns {Perspective}
 * The perspective with the requested ID.
 */

Prefs.prototype.getPerspective = function (qry) {
	var self = this;

	if (!_.isObject(qry)) {
		throw new Error('Call Error: `qry` must be an object');
	}

	if (qry.id != null) {
		return self.perspectives[qry.id];
	}
	else if (qry.name != null) {
		return _.findWhere(self.perspectives, { name: qry.name });
	}
	else {
		return null;
	}
};

// #addPerspective {{{2

/**
 * Add a new perspective.
 *
 * @param {string} [id]
 *
 * @param {string} [name=id]
 *
 * @param {object} [config]
 * If missing, the configuration of the current perspective is used.
 *
 * @param {object} [perspectiveOpts]
 * Additional options to pass to the {@link Perspective} constructor.
 *
 * @param {function} [cont]
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.switch=true]
 * If true, automatically switch to the new perspective after creating it.
 *
 * @param {boolean} [opts.loadAfterSwitch=true]
 * Whether or not to load the perspective's configuration into the bound preference modules after
 * switching to it.  A good reason to set this to `false` is when you're cloning an existing
 * perspective (the view is already configured, so there's no reason to load it again).
 *
 * @param {boolean} [opts.sendEvent=true]
 *
 * @param {boolean} [opts.dontSendEventTo]
 *
 * @fires Prefs#perspectiveAdded
 */

Prefs.prototype.addPerspective = function (id, name, config, perspectiveOpts, cont, opts) {
	var self = this;

	if (id != null && typeof id !== 'string') {
		throw new Error('Call Error: `id` must be null or a string');
	}
	if (name != null && typeof name !== 'string') {
		throw new Error('Call Error: `name` must be null or a string');
	}
	if (config != null && typeof config !== 'object') {
		throw new Error('Call Error: `config` must be null or an object');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}
	if (opts != null && typeof opts !== 'object') {
		throw new Error('Call Error: `opts` must be null or an object');
	}

	if (name == null) {
		name = id;
	}

	cont = cont || I;

	opts = deepDefaults(opts, {
		switch: true,
		loadAfterSwitch: true,
		sendEvent: true,
		onDuplicate: 'nothing'
	});

	var needToLoad = opts.loadAfterSwitch; // Will need to load perspective after we add it.

	if (['error', 'nothing', 'replace'].indexOf(opts.onDuplicate) < 0) {
		throw new Error('Call Error: `opts.onDuplicate` must be one of: error, nothing, replace');
	}

	var maybeSwitch = function () {
		if (opts.switch) {
			return self.setCurrentPerspective(id, cont, {
				loadPerspective: needToLoad,
				sendEvent: opts.sendEvent
			});
		}

		return cont(true);
	};

	if (self.perspectives[id] != null) {
		switch (opts.onDuplicate) {
		case 'error':
			throw new Error('Perspective already exists: ' + id);
		case 'nothing':
			return maybeSwitch();
		}
	}

	var addPerspective = function () {
		var p = new Perspective(id, name, config, self.modules, perspectiveOpts);

		if (id == null) {
			id = p.id;
		}

		self.logDebug(self.makeLogTag() + ' Adding new perspective: id = "%s" ; name = "%s" ; config = %O', id, name, config);

		if (self.availablePerspectives.indexOf(id) < 0) {
			self.availablePerspectives.push(id);
		}

		self.perspectives[id] = p;

		if (opts.sendEvent) {
			self.fire('perspectiveAdded', {
				notTo: opts.dontSendEventTo
			}, id);
		}

		return maybeSwitch();
	};

	if (self.currentPerspective) {
		self.logDebug(self.makeLogTag('add') + ' Saving current perspective "%s" before adding new one "%s"', self.currentPerspective.name, name);
		self.save();
		if (config == null) {
			config = deepCopy(self.currentPerspective.config);
		}
		return addPerspective();
	}
	else if (config == null) {
		config = {};
	}

	return addPerspective();
};

// #addMainPerspective {{{2

Prefs.prototype.addMainPerspective = function (cont) {
	var self = this;

	for (var i = 0; i < self.availablePerspectives.length; i += 1) {
		var id = self.availablePerspectives[i];
		if (self.perspectives[id].name === trans('PREFS.MAIN_PERSPECTIVE')) {
			return self.setCurrentPerspective(id, cont);
		}
	}

	self.addPerspective(null, trans('PREFS.MAIN_PERSPECTIVE'), {}, null, cont);
};

// #deletePerspective {{{2

/**
 * Delete a perspective.  Perspectives flagged "essential" cannot be deleted.
 *
 * @param {string} [id]
 * The ID of the perspective to delete.  If missing, the current perspective is deleted.
 *
 * @param {function} [cont]
 * Continuation callback.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.sendEvent=true]
 * @param {boolean} [opts.dontSendEventTo]
 *
 * @fires Prefs#perspectiveDeleted
 * @fires Prefs#prefsHistoryStatus
 */

Prefs.prototype.deletePerspective = function (id, cont, opts) {
	var self = this;

	if (id != null && typeof id !== 'string') {
		throw new Error('Call Error: `id` must be null or a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	opts = deepDefaults(opts, {
		sendEvent: true
	});

	// When the ID wasn't provided, use the current perspective.

	if (id == null) {
		id = self.currentPerspective.id;
	}

	// Make sure that we're not trying to delete an essential perspective.

	if (self.perspectives[id].opts.isEssential) {
		self.logError(self.makeLogTag('delete') + ' Not allowed to delete essential perspective: id = "%s" ; name = "%s"',
			id, self.perspectives[id].name);
		return cont(false);
	}

	// Delete the perspective in the backend.

	self.backend.deletePerspective(id, function (ok) {
		var newCurrent;
		var i;

		if (!ok) {
			return cont(false);
		}

		// Delete it from our internal data structures.

		delete self.perspectives[id];
		self.availablePerspectives = _.without(self.availablePerspectives, id);

		// Let everybody else know that it's been deleted.

		if (opts.sendEvent) {
			self.fire('perspectiveDeleted', {
				notTo: opts.dontSendEventTo
			}, id, newCurrent);
		}

		// When we've deleted all the perspectives, we need to make a new one.

		if (self.availablePerspectives.length === 0) {
			// We just deleted the last perspective, so reset the history stack.
			self.historyIndex = self.history.length;
			self._resetHistory();

			self.currentPerspective = null;
			return self.addMainPerspective(cont);
		}

		if (self.currentPerspective.id === id) {
			// CURRENT STATE ---------------------
			//   [ A B X B X A ]
			//         ^ (history index - deleted perspective)

			// Go forward in history until we find a perspective that isn't the one we just deleted.
			while (self.historyIndex > 0 && self.history[self.historyIndex].id === id) {
				self.historyIndex -= 1;
			}

			// CURRENT STATE ---------------------
			//   [ A B X B X A ]
			//       ^ (history index - deleted perspective)

			// Now delete all references to the deleted perspective from the history stack.
			self.history = _.reject(self.history, function (p) {
				return p.id === id;
			});

			if (self.history.length === 0) {
				// CURRENT STATE ---------------------
				//   [ ]

				// There are no perspectives on the history stack, but also there is no current perspective.
				// Pick a new perspective to be current.
				self.currentPerspective = null;
				return self.addMainPerspective(cont);
			}
			else {

				// CURRENT STATE ---------------------
				//   [ A B B A ]
				//       ^ (history index - deleted perspective)

				// Now delete all continuous sequences of the new current perspective.
				var newCurId = self.history[self.historyIndex].id;
				for (i = self.historyIndex + 1; i < self.history.length && self.history[i].id !== newCurId; i += 1) {
					self.history[i] = null;
				}
				self.history = _.without(self.history, null);

				// CURRENT STATE ---------------------
				//   [ A B A ]
				//       ^ (history index)

				self._firePrefsHistoryStatus();

				if (self.history.length > 0) {

					// We've stripped the future and all matching perspectives from history, so use the first
					// element of the new history stack as the current perspective.  Don't reset history because
					// we've already done that manually above.
					//
					// BEFORE -------------------------
					//   [ A B B B C D ]
					//       ^ (history index)
					//
					// AFTER --------------------------
					//   [ C D ]
					//     ^ (history index)

					self.setCurrentPerspective(self.history[0].id, null, {
						resetHistory: false
					});
				}
				else {

					// We've removed all items from history, so put something else back on the stack.  In this
					// example, even though there are different things in the future, everything in the past is
					// the same as what we're deleting, so you end up with empty history.
					//
					// BEFORE -------------------------
					//   [ A B B B ]
					//       ^ (history index)
					//
					// AFTER --------------------------
					//   [ Something ]
					//     ^ (history index)

					self.setCurrentPerspective(self.availablePerspectives[0]);
				}
			}

			//var currentIndex;
			//var historyOffset = 0;
			//for (i = 0; i < self.history.length; i += 1) {
			//	if (self.history[i].getName() === name) {
			//		if (i < self.historyIndex) {
			//			historyOffset += 1;
			//		}
			//	}
			//	else {
			//		// Update the old current index if:
			//		//   #1. There is no old one.
			//		//   #2. The new index is closer than the old one.
			//		//   #3. The new index is "back" and the old is "forward."
			//		if (currentIndex == null
			//				|| (self.historyIndex - i < self.historyIndex - currentIndex)
			//				|| (currentIndex < self.historyIndex && i >= self.historyIndex)) {
			//			currentIndex = i;
			//		}
			//	}
			//}
			//newCurrent = self.history[currentIndex].getName();
			//self.history = _.reject(self.history, function (p) {
			//	return p.getName() === name;
			//});
			//self.historyIndex -= historyOffset;
			//self._historyDebug();
			//self.setCurrentPerspective(newCurrent, null, {
			//	resetHistory: false
			//});
		}
	});
};

// #renamePerspective {{{2

/**
 * Rename a perspective.
 *
 * @param {string} [id]
 * When null or undefined, uses the current perspective.
 *
 * @param {string} newName
 *
 * @param {function} [cont]
 *
 * @param {object} [opts]
 * @param {boolean} [opts.sendEvent=true]
 * @param {boolean} [opts.dontSendEventTo]
 *
 * @fires Prefs#perspectiveRenamed
 */

Prefs.prototype.renamePerspective = function (id, newName, cont, opts) {
	var self = this;

	var isCurrent = false;

	opts = deepDefaults(opts, {
		sendEvent: true
	});

	if (id != null && typeof id !== 'string') {
		throw new Error('Call Error: `id` must be null or a string');
	}
	if (typeof newName !== 'string') {
		throw new Error('Call Error: `newName` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	// When the `id` is missing, use the current perspective's name.

	if (id == null) {
		id = self.currentPerspective.id;
	}

	cont = cont || I;

	if (id === self.currentPerspective.id) {
		isCurrent = true;
	}

	// Make sure a perspective with the old name exists.

	if (self.perspectives[id] == null) {
		throw new Error(sprintf.sprintf('Perspective does not exist: id = "%s"', id));
	}

	// Check to see if there are any other perspectives with the same name.

	_.each(self.perspectives, function (p) {
		if (p.name === newName) {
			self.logWarning(sprintf.sprintf('Renaming perspective (id = "%s") now shares the name "%s" with a different perspective (id = "%s")',
				id, newName, p.id));
		}
	});

	self.perspectives[id].name = newName;
	self.perspectives[id].save(function () {
		self.backend.save(self.currentPerspective, function () {
			if (opts.sendEvent) {
				self.fire('perspectiveRenamed', {
					notTo: opts.dontSendEventTo
				}, id, newName);
			}

			return cont(true);
		});
	});

	/*
	// Rename the perspective in the backend.

	self.backend.rename(oldName, newName, function (ok) {
		if (!ok) {
			// Error renaming the perspective in the backend.
			return typeof cont === 'function' ? cont(false) : false;
		}

		// Change the name in the perspective itself.
		self.perspectives[oldName].setName(newName);

		// Rename the perspective in our lookup table.
		self.perspectives[newName] = self.perspectives[oldName];
		delete self.perspectives[oldName];

		// Remove the old name from the list of available perspectives.
		self.availablePerspectives = _.without(self.availablePerspectives, oldName);

		if (opts.sendEvent) {
			self.fire('perspectiveRenamed', {
				notTo: opts.dontSendEventTo
			}, oldName, newName);
		}

		return isCurrent
			? self.setCurrentPerspective(newName, cont)
			: typeof cont === 'function'
				? cont(true)
				: true;
	});
	*/
};

// #setCurrentPerspective {{{2

/**
 * Switch to a different perspective.
 *
 * @param {string} id
 * ID of the perspective to switch to.
 *
 * @param {function} [cont]
 * Continuation callback.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.loadPerspective=true]
 * If true, automatically load the perspective after we've switched to it.
 *
 * @param {boolean} [opts.sendEvent=true]
 * @param {boolean} [opts.dontSendEventTo]
 *
 * @fires Prefs#perspectiveChanged
 */

Prefs.prototype.setCurrentPerspective = function (id, cont, opts) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	opts = deepDefaults(opts, {
		loadPerspective: true,
		sendEvent: true,
		resetHistory: true
	});

	if (self.perspectives[id] == null) {
		if (self.availablePerspectives.indexOf(id) < 0) {
			self.logWarning(self.makeLogTag('setCurrentPerspective') + ' Perspective does not exist: id = "%s"', id);
			if (self.availablePerspectives.length === 0) {
				return self.addMainPerspective(cont);
			}
			else {
				id = self.availablePerspectives[0];
			}
		}

		// Try to load the perspective config from the backend, and create a new Perspective from it.
		// Adding in this way will cause it to be switched to immediately, so there's no need for us to
		// do it again here.

		return self.backend.load(id, function (config) {
			return self.addPerspective(id, null, config, null, cont);
		});
	}

	self.logDebug(self.makeLogTag() + ' Switching to perspective: id = "%s"', id);

	self.currentPerspective = self.perspectives[id];

	if (opts.resetHistory) {
		self._resetHistory(self.currentPerspective);
	}

	// FIXME: Firing `perspectiveChanged` causes the grid to be redrawn, which isn't necessary when
	// we're not loading the perspective (e.g. because we've just created a new one).

	var afterLoad = function () {
		if (opts.sendEvent) {
			self.fire('perspectiveChanged', {
				notTo: opts.dontSendEventTo
			}, id, self.currentPerspective);
		}
		self.backend.setCurrent(id, function (ok) {
			return cont(ok);
		});
	};

	if (opts.loadPerspective) {
		return self.currentPerspective.load(null, afterLoad);
	}
	else {
		return afterLoad();
	}
};

// #setCurrentPerspectiveByName {{{2

Prefs.prototype.setCurrentPerspectiveByName = function (name, cont, opts) {
	var self = this;
	var p = _.findWhere(self.perspectives, {name: name});

	if (p != null) {
		return self.setCurrentPerspective(p.id, cont, opts);
	}

	throw new Error('No such perspective: "' + name + '"');
};

// #clonePerspective {{{2

/**
 * Clone an existing perspective while prompting for a new name.
 *
 * @param {Object} [qry]
 * Query to determine what perspective to clone.  If missing, uses the current perspective.
 *
 * @param {string} [qry.id]
 * Clone perspective with this ID.
 *
 * @param {string} [qry.name]
 * Clone perspective with this name.
 *
 * @param {function} ok
 * Continuation function for successful clone.
 *
 * @param {function} fail
 * Continuation function for failed clone.  There *may* be an error string passed as an argument,
 * but not always.
 *
 * @param {Object} [opts]
 * Additional options.
 *
 * @param {string} [opts.message]
 * The prompt displayed in the input to get the new name.
 *
 * @param {boolean} [opts.switch=true]
 * Whether or not to switch to the new perspective.
 *
 * @param {boolean} [opts.sendEvent=true]
 * Whether or not to send the `perspectiveChanged` event when switching to the new perspective.
 */

Prefs.prototype.clonePerspective = function (qry, name, configMutator, ok, fail, opts) {
	var self = this;
	var src;

	if (name != null && !_.isString(name)) {
		throw new Error('Call Error: `name` must be null or a string');
	}

	if (configMutator != null && typeof configMutator !== 'function') {
		throw new Error('Call Error: `configMutator` must be null or a function');
	}

	opts = deepCopy(opts, {
		message: 'Enter new perspective name',
		switch: true,
		sendEvent: true
	});

	if (fail == null || typeof fail !== 'function') {
		fail = I;
	}

	// Lookup the perspective to clone.

	if (qry == null) {
		src = self.currentPerspective;
	}
	else {
		src = self.getPerspective(qry);
		if (src == null) {
			return fail('Perspective "' + JSON.stringify(qry) + '" does not exist');
		}
	}

	var newConfig = (configMutator || I)(deepCopy(src.config));
	var newName = name || prompt(opts.message, src.name);
	if (newName != null) {
		self.logDebug(self.makeLogTag('clonePerspective') + 'Creating new perspective "%s" with config = %O', newName, newConfig);
		self.addPerspective(null, newName, newConfig, null, function (isOk) {
			if (isOk) {
				return self.save(ok);
			}
			else {
				return fail('Error cloning perspective');
			}
		}, {
			switch: opts.switch,
			loadAfterSwitch: false,
			sendEvent: opts.sendEvent
		});
	}
	else {
		return fail('Operation cancelled');
	}
};

// #save {{{2

/**
 * Saves the current perspective using the backend.
 *
 * @param {PrefsBackend~save_cont} [cont]
 * Called when the backend has finished saving preferences.
 */

Prefs.prototype.save = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	if (self.currentPerspective.opts.isTemporary) {
		return cont(false);
	}

	if (self.opts.autoSave) {
		self.reallySave(cont);
	}
	else {
		self.currentPerspective.isUnsaved = true;
		self.fire('prefsChanged');
	}
};

// #reallySave {{{2

/**
 * Saves the current perspective using the backend.
 *
 * @param {PrefsBackend~save_cont} [cont]
 * Called when the backend has finished saving preferences.
 */

Prefs.prototype.reallySave = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	if (self.currentPerspective.opts.isTemporary) {
		return cont(false);
	}

	self.currentPerspective.save(function () {
		self.backend.save(self.currentPerspective, function (ok) {
			if (ok) {
				self.currentPerspective.isUnsaved = false;
				self.fire('prefsSaved');
			}
			return cont(ok);
		});
	});
};

// #reset {{{2

/**
 * Reset the prefs system.  This involves:
 *
 *   1. Reset the backend.
 *   2. Flush internal data structures.
 *   3. Prime the prefs system.
 *
 * TODO This should lock the prefs system so it can't be interacted with.
 *
 * @param {function} cont
 * What to do when the prefs system is ready for use again.
 *
 * @fires Prefs#prefsReset
 */

Prefs.prototype.reset = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	// Save some info for all perspectives that are both temporary and essential, so we can restore
	// them after everything else has been cleared.  The main use case for this is for pre-configured
	// perspectives to survive when destroying stuff the user created.

	_.each(self.perspectives, function (p) {
		if (p.opts.isTemporary && p.opts.isEssential) {
			self.logDebug(self.makeLogTag() + ' Saving temporary essential perspective: %s', p.id);
			self.bardo[p.id] = {
				id: p.id,
				name: p.name,
				config: p.config,
				opts: p.opts
			};
		}
	});

	var current = self.currentPerspective.id;

	self.backend.reset(function () {
		self.isInitialized = false;
		self.init();

		self.fire('prefsReset');

		_.each(self.modules, function (module, moduleName) {
			if (typeof module.reset === 'function') {
				self.logDebug(self.makeLogTag() + ' Resetting module: moduleName = %s', moduleName);
				module.reset();
			}
		});

		self.logDebug(self.makeLogTag() + ' Restoring temporary essential perspectives: %s', JSON.stringify(_.keys(self.bardo)));

		_.each(self.bardo, function (p) {
			self.addPerspective(p.id, p.name, p.config, p.opts, null, { switch: false });
		});

		if (self.perspectives[current]) {
			self.setCurrentPerspective(current);
		}

		self.isPrimed = false;
		self.prime(function () {
			return cont(true);
		});
	});
};

// #inspect {{{2

Prefs.prototype.inspect = function () {
	var self = this;
	var paths = Array.prototype.slice.call(arguments);
	var fmtRe = new RegExp('^(.*)/(\\w+)$');

	console.group('INSPECT RESULTS');

	_.each(self.perspectives, function (perspective, uuid) {
		var s = '', x = [];
		_.each(paths, function (path) {
			var m = path.match(fmtRe);
			var f = m && m[2].length > 0 ? m[2] : 'string';
			path = m ? m[1].split('.') : path.split('.');

			if (s.length > 0) {
				s += ', ';
			}

			s += path[path.length - 1] + ' = ';

			var y = getProp(perspective, path);

			if (typeof(y) === 'string' || typeof(y) === 'number') {
				s += y;
			}
			else if (f === 'json') {
				s += JSON.stringify(y);
			}
			else {
				s += '%O';
				x.push(deepCopy(y));
			}
		});
		console.log.apply(null, [s].concat(x));
	});

	console.groupEnd();
};

// Exports {{{1

export {
	Prefs,
};
