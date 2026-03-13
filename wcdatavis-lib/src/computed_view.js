// Imports {{{1

import _ from 'underscore';
import BigNumber from 'bignumber.js';
import numeral from 'numeral';
import moment from 'moment';

import jQuery from 'jquery';

import {
	arrayCompare,
	arrayEqual,
	car,
	cdr,
	copyProps,
	deepCopy,
	deepDefaults,
	delegate,
	eachUntilObj,
	gensym,
	getComparisonFn,
	getElement,
	getNatRep,
	getProp,
	getPropDef,
	I,
	interleaveWith,
	isElement,
	logAsync,
	makeSubclass,
	mergeSort4,
	mixinEventHandling,
	mixinLogging,
	mixinNameSetting,
	objFromArray,
	pigeonHoleSort,
	setProp,
	Timing,
} from './util/misc.js';
import OrdMap from './util/ordmap.js';
import Lock from './util/lock.js';
import {Source} from './source.js';
import {Prefs} from './prefs.js';
import {AGGREGATE_REGISTRY, AggregateInfo} from './aggregates.js';
import {View} from './view.js';
import {GROUP_FUNCTION_REGISTRY} from './group_fun.js';
import types from './types.js';

// ComputedView {{{1
// Constructor {{{2

/**
 * This represents a view of the data obtained by a data source.  While the pool of available data
 * is the same, the way its represented to the user (filtered, sorted, grouped, or pivotted)
 * changes.
 *
 * @param {Source} source
 *
 * @param {object} [opts]
 * Additional options.
 *
 * @param {string} [opts.name]
 * Name of this instance used for logging messages; if omitted, one will be generated automatically.
 *
 * @class
 *
 * @property {Source} source
 *
 * @property {ComputedView~FilterSpec} filterSpec
 *
 * @property {ComputedView~SortSpec} sortSpec
 *
 * @property {ComputedView~GroupSpec} groupSpec
 *
 * @property {ComputedView~PivotSpec} pivotSpec
 *
 * @property {Timing} timing For keeping track of how long it takes to do things in the view.
 */

var ComputedView = makeSubclass('ComputedView', View, function (source, opts) {
	var self = this;

	if (!(source instanceof Source) && !(source instanceof ComputedView)) {
		throw new Error('Call Error: `source` must be an instance of MIE.WC_DataVis.Source or MIE.WC_DataVis.ComputedView');
	}

	opts = deepDefaults(opts, {
		prefs: null,
		saveViewConfig: true,
		groupIsPivot: false
	});

	if (opts.prefs != null && !(opts.prefs instanceof Prefs)) {
		throw new Error('Call Error: `opts.prefs` must be null or an instance of MIE.WC_DataVis.Prefs');
	}

	self.source = source;
	self.opts = opts;

	self.source.on('dataUpdated', function () {
		self.clearCache();
		self.fire('dataUpdated');
	});

	self.source.on('fetchDataCancel', function () {
		self.lock.clear();
	});

	self.echo(self.source, ['fetchDataBegin', 'fetchDataEnd']);

	self.setName(opts.name);

	self.colConfig = new OrdMap();

	self.timing = new Timing();

	self.lock = new Lock(self.toString());

	// Set the default configuration for a new ComputedView.  Setting explicit defaults is a good practice to
	// maintain, but it also makes sure that when prefs are loaded later, any `null` values they set
	// compare correctly to what we already have, and not make it look like something has changed.

	self.sortSpec = null;
	self.filterSpec = null;
	self.groupSpec = null;
	self.pivotSpec = null;
	self.aggregateSpec = objFromArray(['group', 'pivot', 'cell', 'all'], [[{fun: 'count'}]]);

	if (opts.prefs != null) {
		self.setPrefs(opts.prefs);
	}

	self.isBoundToPrefs = false;
}, {
	prefsModule: 'view'
});

// Mixins {{{2

mixinEventHandling(ComputedView, [
	'fetchDataBegin'      // Started fetching data from the source.
, 'fetchDataEnd'        // Done fetching data from the source.
, 'getTypeInfo'         // Type information has been retrieved from the source.
, 'dataUpdated'         // The data has changed in the source.
, 'workBegin'           // The view has started operating on the data.
, 'workEnd'             // The view has finished operating on the data.

, 'sortSet'             // When the sort has been set.  Args: (field, direction)
, 'filterSet'           // When the filter has been set.  Args: (spec)
, 'groupSet'            // When the grouping has been set.  Args: (spec)
, 'pivotSet'            // When the pivot config has been set.  Args: (spec)
, 'aggregateSet'        // When the aggregate config has been set.  Args: (spec)

, 'sortBegin'           // A sort operation has started.
, 'sort'                // Sort information for a row is available.
, 'sortEnd'             // A sort operation has finished.
, 'filterBegin'         // A filter operation has started.
, 'filter'              // Filter information for a row is available.
, 'filterEnd'           // A filter operation has finished.

, 'invalidFilterField'  // A filtered field does not exist in the source data.
, 'invalidGroupField'   // A grouped field does not exist in the source data.
, 'invalidPivotField'   // A pivotted field does not exist in the source data.
, 'invalidSortField'    // A sorted field does not exist in the source data.
, 'invalidAggregate'    // An aggregate function is invalid.
]);

delegate(ComputedView, 'source', ['getUniqueVals', 'decodeAll', 'setToolbar']);

mixinLogging(ComputedView);
mixinNameSetting(ComputedView);

// Event JSDoc {{{3

/**
 * Fired when the view has started getting data from the source.
 *
 * @event ComputedView#fetchDataBegin
 */

/**
 * Fired when the view has finished getting data from the source.
 *
 * @event ComputedView#fetchDataEnd
 */

/**
 * Fired when new type information is available from the source.
 *
 * @event ComputedView#getTypeInfo
 */

/**
 * Fired when new data is available from the source.
 *
 * @event ComputedView#dataUpdated
 */

/**
 * Fired when the view has started doing work with data.
 *
 * @event ComputedView#workBegin
 */

/**
 * Fired when the view has finished doing work with data.
 *
 * @event ComputedView#workEnd
 *
 * @param {ComputedView~OperationsPerformed} ops
 * An object identifying what operations were performed.
 */

/**
 * Fired when the sort configuration is set in the view.
 *
 * @event ComputedView#sortSet
 */

/**
 * Fired when the filter configuration is set in the view.
 *
 * @event ComputedView#filterSet
 */

/**
 * Fired when the group configuration is set in the view.
 *
 * @event ComputedView#groupSet
 */

/**
 * Fired when the pivot configuration is set in the view.
 *
 * @event ComputedView#pivotSet
 */

/**
 * Fired when the aggregate configuration is set in the view.
 *
 * @event ComputedView#aggregateSet
 */

/**
 * Fired when the view starts a sort operation.
 *
 * @event ComputedView#sortBegin
 */

/**
 * Fired when the view has determined the final sort position of a record.  One place this is used
 * is by GridTable to update itself without having to completely redraw from scratch after sorting.
 *
 * @event ComputedView#sort
 *
 * @param {number} rowNum
 * The unique ID of the row.
 *
 * @param {number} index
 * The index of the row in the sorted output.
 */

/**
 * Fired when the view finishes a sort operation.
 *
 * @event ComputedView#sortEnd
 */

/**
 * Fired when the view starts a filter operation.
 *
 * @event ComputedView#filterBegin
 */

/**
 * Fired when the view has determined whether a record should be shown or hidden.  One place this is
 * used is by GridTable to update itself without having to completely redraw from scratch after
 * filtering.
 *
 * @event ComputedView#filter
 *
 * @param {number} rowNum
 * The unique ID of the row.
 *
 * @param {boolean} isHidden
 * If true, the row should be hidden; if false, it should be shown.
 */

/**
 * Fired when the view finishes a filter operation.
 *
 * @event ComputedView#filterEnd
 */

/**
 * Fired when attempting to filter by an invalid field.
 *
 * @event ComputedView#invalidFilterField
 */

/**
 * Fired when attempting to group by an invalid field.
 *
 * @event ComputedView#invalidGroupField
 */

/**
 * Fired when attempting to pivot by an invalid field.
 *
 * @event ComputedView#invalidPivotField
 */

/**
 * Fired when attempting to sort by an invalid field.
 *
 * @event ComputedView#invalidSortField
 */

/**
 * Fired when attempting to set an invalid aggregate.
 *
 * @event ComputedView#invalidAggregate
 */

// #unlimit {{{2

ComputedView.prototype.unlimit = function () {
	var self = this;
	this.source.unlimit();
};

// #toString {{{2

ComputedView.prototype.toString = function () {
	var self = this;
	return 'ComputedView(' + self.name + ')';
};

// #addClient {{{2

/**
 * Keep track of the clients that are using this view.  The only reason we have this is so that we
 * can tell if a graph is watching this view or not.
 */

ComputedView.prototype.addClient = function (client, kind) {
	var self = this;

	self.clients = self.clients || {};
	self.clients[kind] = self.clients[kind] || [];
	self.clients[kind].push(client);
};

// #hasClientKind {{{2

/**
 * Check to see if we have a client of the specified kind.
 */

ComputedView.prototype.hasClientKind = function (kind) {
	var self = this;

	return getPropDef(0, self.clients, kind, 'length') > 0;
};

// #getRowCount {{{2

/**
 * Get the number of rows currently being shown by the view.
 *
 * @return {number} The number of rows shown in the table output.
 */

ComputedView.prototype.getRowCount = function () {
	var self = this;

	if (self.data.isPlain) {
		return self.data.data.length;
	}
	else if (self.data.isGroup) {
		return _.reduce(self.data.data, function (prev1, groupedData, rowValNum) {
			return prev1 + groupedData.length;
		}, 0);
	}
	else if (self.data.isPivot) {
		return _.reduce(self.data.data, function (prev1, groupedData, rowValNum) {
			return prev1 + _.reduce(groupedData, function (prev2, pivottedData, colValNum) {
				return prev2 + pivottedData.length;
			}, 0);
		}, 0);
	}
	else {
		throw new Error('Unable to determine row count when data is not plain, but also not grouped.');
	}
};

// #getTotalRowCount {{{2

/**
 * Get the number of rows that could be shown by the view.
 *
 * @return {number} The total number of rows in the data, including those which aren't currently
 * being sorted (e.g. because they have been filtered out).
 */

ComputedView.prototype.getTotalRowCount = function () {
	return this.source.cache.data.length;
};

// #setSort {{{2

/**
 * Set the sorting spec for the view.
 *
 * @param {ComputedView~SortSpec} spec
 * @param {object} [opts]
 */

ComputedView.prototype.setSort = function (spec, opts) {
	var self = this
		, args = Array.prototype.slice.call(arguments)
		, isDifferent = false;

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setSort.apply(self, args);
		}, 'Waiting to set sort: ' + JSON.stringify(spec));
	}

	opts = deepDefaults(opts, {
		sendEvent: true,
		dontSendEventTo: [],
		updateData: true,
		savePrefs: true
	});

	self.logDebug(self.makeLogTag('setSort') + ' spec = %O', spec);

	isDifferent = !_.isEqual(self.sortSpec, spec);

	self.super['View'].setSort(spec, opts);

	if (isDifferent && self.prefs != null && opts.savePrefs) {
		self.prefs.save();
	}

	self.clearCache();

	if (opts.updateData) {
		self.getData();
	}

	return true;
};

// #getSort {{{2

ComputedView.prototype.getSort = function () {
	var self = this;

	return self.sortSpec;
};

// #clearSort {{{2

/**
 * Clear the sort spec for the view.
 */

ComputedView.prototype.clearSort = function (opts) {
	return this.setSort(null, opts);
};

// #sort {{{2

/**
 * Sort this view of the data by the specified column name, in the specified direction.  This is
 * asynchronous because long running sorts need to keep the user interface responsive.
 *
 * @param {function} cont Continuation function to which the sorted data is passed.
 */

ComputedView.prototype.sort = function (cont) {
	var self = this
		, timingEvt = ['Data Source "' + self.source.name + '" : ' + self.name, 'Sorting']
		, conv = I
		, aggInfo = getProp(self.data, 'agg', 'info');

	if (self.sortSpec == null) {
		return cont(false);
	}

	self.logDebug(self.makeLogTag('sort') + ' Beginning sort: %s', JSON.stringify(self.sortSpec));

	/**
	 * Determine the comparison function that should be used to perform the sort operation.
	 *
	 * @param {object} spec
	 * The sort specification; only used for log messages.
	 *
	 * @param {Source~TypeInfo} fti
	 * The type information for the field to sort by.
	 *
	 * @returns {function}
	 * A function that is used to perform the sort.  The comparison function returns -1 when A < B, 0
	 * when A = B, and +1 when A > B.  Returns null when the sort cannot be performed (e.g. because no
	 * comparison function could be found).
	 */

	var determineCmp = function (spec, fti) {
		var cmp;

		if (fti == null) {
			self.logError(self.makeLogTag() + ' Unable to sort: no type information {spec = %O}', spec);
			return null;
		}

		if (typeof fti === 'string' || fti instanceof String) {
			fti = {
				type: fti
			};
		}

		if (fti.type == null) {
			self.logError(self.makeLogTag() + ' Unable to sort: type unknown {spec = %O, fti = %O}', spec, fti);
			return null;
		}

		// FIXME Should this be based on the internal type?

		cmp = getComparisonFn.byType(fti.type);

		if (cmp == null) {
			self.logError(self.makeLogTag() + ' Unable to sort: no comparison function for type {spec = %O, type = %s}', spec, fti.type);
			return null;
		}

		// This should never happen, because that would imply that getComparisonFn.byType() is broken.

		if (typeof cmp !== 'function') {
			self.logError(self.makeLogTag() + ' Unable to sort: invalid comparison function for type {spec = %O, type = %s}', spec, fti.type);
			return null;
		}

		// Make sure that all the data is decoded first before we try to sort it.  This makes things a
		// lot simpler (i.e. no need to compare a Moment object --- which has already been decoded ---
		// with a string containing a date).

		if (fti.field != null) {
			Source.decodeAll(self.data.dataByRowId, fti.field, self.typeInfo);
		}

		return cmp;
	};



	// A "bundle" is an array of the values that need to be sorted.  We store the value to sort, plus
	// the index that maps back (somehow) to the corresponding rows.  After sorting is complete, we
	// "unpack" the bundle: going through the bundle in sorted order, moving the data rows around
	// based on the `oldIndex` we store here.

	var packBundle = function (spec, orientation, sortSourceFn) {
		var bundle, len;

		if (sortSourceFn == null) {
			self.logError(self.makeLogTag() + ' Unable to sort: no sort source function given {spec = %O}', spec);
			return null;
		}

		switch (orientation) {
		case 'vertical':
			len = self.data.isPlain ? self.data.data.length : self.data.rowVals.length;
			break;
		case 'horizontal':
			len = self.data.isPlain ? self.data.data.length : self.data.colVals.length;
			break;
		default:
			return null;
		}

		bundle = new Array(len);

		for (var i = 0; i < len; i += 1) {
			bundle[i] = {
				oldIndex: i,
				sortSource: sortSourceFn(i)
			};
		}

		return bundle;
	};



	// Unpack the bundle, going through each item in the bundle and using its `oldIndex` to reorder
	// the data and aggregates to match the new sort order.  For vertical orientation, we reorder
	// row-related stuff (groups, i.e. rowvals and group aggregates).  For horizontal orientation, we
	// reorder column-related stuff (pivots, i.e. colvals and pivot aggregates).

	var unpackBundle = function (orientation) {
		return function (sorted) {
			self.logDebug(self.makeLogTag() + ' SORT // UNPACK',
				'Unpacking bundle of %d sorted chunks in %s orientation',
				sorted.length, orientation);

			var origData = self.data.data;
			var origRowVals = getProp(self.data, 'rowVals');
			var origColVals = getProp(self.data, 'colVals');
			var origCellAgg = getProp(self.data, 'agg', 'results', 'cell');
			var origGroupAgg = getProp(self.data, 'agg', 'results', 'group');
			var origPivotAgg = getProp(self.data, 'agg', 'results', 'pivot');

			var ai // Aggregate Index
				, rvi // Row Value Index
			;

			switch (orientation) {
			case 'vertical':
				self.data.data = [];

				if (origRowVals != null) {
					self.data.rowVals = [];
				}

				if (origCellAgg != null) {
					self.data.agg.results.cell = [];
				}

				if (origGroupAgg != null) {
					self.data.agg.results.group = [];
				}

				// Reorder data and rowvals.

				var rowValIdxMap = {};

				_.each(sorted, function (s, newIndex) {
					// For plain output, fire the "sort" event so that the rows (if the grid table is showing
					// all of them) can just be shuffled around, and the table doesn't have to be recreated.

					if (self.data.isPlain) {
						self.fire('sort', {
							silent: true
						}, origData[s.oldIndex].rowNum, newIndex);
					}

					self.data.data[newIndex] = origData[s.oldIndex];
					if (origRowVals != null) {
						self.data.rowVals[newIndex] = origRowVals[s.oldIndex];
					}

					rowValIdxMap[s.oldIndex] = newIndex;
				});

				if (self.data.isGroup || self.data.isPivot) {
					// Update the groupMetadata tree's use of rowValIndex to correspond to the new ordering of
					// rowvals.  This means both the `rowValIndex` property of each node in the tree, and the
					// lookup object.  If this isn't done, then some parts of the UI (like the rowvals in group
					// and pivot output) will not change to reflect the new ordering.

					var postorder = function (node, depth) {
						if (node.children == null) {
							node.rowValIndex = rowValIdxMap[node.rowValIndex];
							self.data.groupMetadata.lookup.byRowValIndex[node.rowValIndex] = node;
						}
						else {
							_.each(node.children, function (child) {
								postorder(child, depth + 1);
							});
							if (depth > 0) {
								// FIXME Assumes that node.children.length > 0.
								node.rowValIndex = node.children[_.keys(node.children)[0]].rowValIndex;
							}
						}
					};

					postorder(self.data.groupMetadata, 0);
				}

				// Reorder cell aggregates.

				if (origCellAgg != null) {
					for (ai = 0; ai < origCellAgg.length; ai += 1) {
						self.data.agg.results.cell[ai] = [];
						_.each(sorted, function (s, newIndex) {
							self.data.agg.results.cell[ai][newIndex] = origCellAgg[ai][s.oldIndex];
						});
					}
				}

				// Reorder group aggregates.

				if (origGroupAgg != null) {
					for (ai = 0; ai < origGroupAgg.length; ai += 1) {
						self.data.agg.results.group[ai] = [];
						_.each(sorted, function (s, newIndex) {
							self.data.agg.results.group[ai][newIndex] = origGroupAgg[ai][s.oldIndex];
						});
					}
				}

				break;
			case 'horizontal':
				self.data.data = [];

				if (origColVals != null) {
					self.data.colVals = [];
				}

				if (origCellAgg != null) {
					self.data.agg.results.cell = [];
				}

				if (origPivotAgg != null) {
					self.data.agg.results.pivot = [];
				}

				// Reorder data and colvals.

				_.each(sorted, function (s, newIndex) {
					self.data.colVals[newIndex] = origColVals[s.oldIndex];
					if (origColVals != null) {
						for (var rvi = 0; rvi < self.data.rowVals.length; rvi += 1) {
							if (self.data.data[rvi] === undefined) {
								self.data.data[rvi] = [];
							}
							self.data.data[rvi][newIndex] = origData[rvi][s.oldIndex];
						}
					}
				});

				// Reorder cell aggregates.

				if (origCellAgg != null) {
					for (ai = 0; ai < origCellAgg.length; ai += 1) {
						self.data.agg.results.cell[ai] = new Array(self.data.rowVals.length);
						for (rvi = 0; rvi < self.data.rowVals.length; rvi += 1) {
							self.data.agg.results.cell[ai][rvi] = new Array(self.data.colVals.length);
							_.each(sorted, function (s, newIndex) {
								self.data.agg.results.cell[ai][rvi][newIndex] = origCellAgg[ai][rvi][s.oldIndex];
							});
						}
					}
				}

				// Reorder pivot aggregates.

				if (origPivotAgg != null) {
					for (ai = 0; ai < origPivotAgg.length; ai += 1) {
						self.data.agg.results.pivot[ai] = new Array(self.data.colVals.length);
						_.each(sorted, function (s, newIndex) {
							self.data.agg.results.pivot[ai][newIndex] = origPivotAgg[ai][s.oldIndex];
						});
					}
				}

				break;
			}
		};
	};



	var makeFinishCb = function (postProcess, next) {
		return function (sorted) {
			// Run any function that might've been specified to manipulate the data after the fact.

			if (typeof postProcess === 'function') {
				postProcess(sorted);
			}
			else {
				self.data.data = sorted;
			}

			return next(true);
		};
	};



	var performSort = function (orientation, next) {

		// sortSourceFn(index) -> value
		//
		//   The value that we're interested in sorting by, for the element specified by `index`.  It's
		//   a way of abstracting away the differences in how we're sorting (this function yields the
		//   "right thing" whether we're sorting by a cell value, a group aggregate function result, or
		//   something else altogether).

		var fti
			, sortSourceFn
			, spec = getProp(self, 'sortSpec', orientation)
			, sortAlgorithm = 'mergeSort';

		var rvi, cvi, gfi;

		if (spec == null) {
			return next(true);
		}

		spec = deepCopy(spec);

		if (self.data.isPlain) {
			if (orientation === 'horizontal') {
				self.logError(self.makeLogTag() + ' Unable to sort: cannot perform horizontal sort on plain data');
				return next(false);
			}
			if (spec.field) {
				if (spec.values) {
					sortAlgorithm = 'pigeonHole';
				}
				else {
					fti = self.typeInfo.get(spec.field);
				}

				// The sort source function accesses the value of the field in the indexed row.  This is as
				// simple as it can get.

				sortSourceFn = function (i) {
					return self.data.data[i].rowData[spec.field].value;
				};
			}
		}
		else if (self.data.isGroup) {
			if (orientation === 'horizontal') {
				self.logError(self.makeLogTag() + ' Unable to sort: cannot perform horizontal sort on grouped data');
				return next(false);
			}
			if (spec.field != null) {
				gfi = self.data.groupFields.indexOf(spec.field);

				if (gfi < 0) {
					self.logError(self.makeLogTag() + ' Unable to sort: `field` property does not refer to a grouped field ' +
						'{field = "%s", groupFields = %s}', spec.field, self.data.groupFields);
				}
				else {
					spec.groupFieldIndex = gfi;
				}
			}

			if (spec.groupFieldIndex != null) {

				// SORT GROUPS BY GROUP FIELD VALUE
				// ================================
				//
				// SPEC
				//   { groupFieldIndex: number }
				//
				// DESCRIPTION
				//   This sorts groups by the value of one group field.

				if (spec.groupFieldIndex < 0 || spec.groupFieldIndex >= self.data.groupFields.length) {
					self.logError(self.makeLogTag() + ' Unable to sort: groupFieldIndex out of range {spec = %O, range = [0,%d]}',
										spec, self.data.groupFields.length);
					return next(false);
				}

				if (spec.values) {
					sortAlgorithm = 'pigeonHole';
				}
				else if (self.data.groupSpec[spec.groupFieldIndex].fun != null) {
					// The values that we're sorting came from a function applied to the value of the group
					// field in the row, e.g. "Day of Week."  Therefore, we can't sort them based on the type
					// of the group field, e.g. date.

					fti = {
						type: GROUP_FUNCTION_REGISTRY.get(self.data.groupSpec[spec.groupFieldIndex].fun).sortType
					};
				}
				else {
					fti = self.typeInfo.get(self.data.groupFields[spec.groupFieldIndex]);
				}

				sortSourceFn = function (i) {
					return self.data.rowVals[i][spec.groupFieldIndex];
				};
			}
			else if (spec.aggType === 'group' && spec.aggNum != null) {

				// SORT GROUPS BY AGGREGATE FUNCTION RESULT
				// ========================================
				//
				// SPEC
				//   { aggType: "group", aggNum: number }
				//
				// DESCRIPTION
				//   This sorts groups by the result of an aggregate function applied to a group.

				if (spec.aggNum < 0 || spec.aggNum >= aggInfo.group.length) {
					self.logError(self.makeLogTag() + ' Unable to sort: aggNum out of range {spec = %O, range = [0,%d]}',
										spec, aggInfo.group.length);
					return next(false);
				}

				fti = aggInfo.group[spec.aggNum].instance.getType();
				sortSourceFn = function (i) {
					return self.data.agg.results.group[spec.aggNum][i];
				};
			}
		}
		else if (self.data.isPivot) {
			// See https://1drv.ms/u/s!AuF9WqjL0lB2erNc2Ld6sOCscAs for a diagram showing what all these
			// different sorting options are.
			//
			// #1 - Sort groups by the value of a group field
			// #2 - Sort pivots by the result of a cell aggregate, for a specific group
			// #3 - Sort pivots by the value of a pivot field
			// #4 - Sort groups by the result of a cell aggregate, for a specific pivot
			// #5 - Sort pivots by the result of a pivot aggregate
			// #6 - Sort groups by the result of a group aggregate

			if (spec.field != null) {
				switch (orientation) {
				case 'vertical':
					gfi = self.data.groupFields.indexOf(spec.field);

					if (gfi < 0) {
						self.logError(self.makeLogTag() + ' Unable to sort: `field` property does not refer to a grouped field ' +
							'{field = "%s", groupFields = %s}', spec.field, self.data.groupFields);
					}
					else {
						spec.groupFieldIndex = gfi;
					}
					break;

				case 'horizontal':
					var pfi = self.data.pivotFields.indexOf(spec.field);

					if (pfi < 0) {
						self.logError(self.makeLogTag() + ' Unable to sort: `field` property does not refer to a pivotted field ' +
							'{field = "%s", pivotFields = %s}', spec.field, self.data.pivotFields);
					}
					else {
						spec.pivotFieldIndex = pfi;
					}
					break;
				}
			}

			if (spec.groupFieldIndex != null) { // #1

				// SORT GROUPS BY GROUP FIELD VALUE
				// ================================
				//
				//   * groupFieldIndex: number

				if (spec.groupFieldIndex < 0 || spec.groupFieldIndex >= self.data.groupFields.length) {
					self.logError(self.makeLogTag() + ' Unable to sort: groupFieldIndex out of range {spec = %O, range = [0,%d]}',
										spec, self.data.groupFields.length);
					return next(false);
				}

				if (spec.values) {
					sortAlgorithm = 'pigeonHole';
				}
				else if (self.data.groupSpec[spec.groupFieldIndex].fun != null) {
					// The values that we're sorting came from a function applied to the value of the group
					// field in the row, e.g. "Day of Week."  Therefore, we can't sort them based on the type
					// of the group field, e.g. date.

					fti = {
						type: GROUP_FUNCTION_REGISTRY.get(self.data.groupSpec[spec.groupFieldIndex].fun).sortType
					};
				}
				else {
					fti = self.typeInfo.get(self.data.groupFields[spec.groupFieldIndex]);
				}

				sortSourceFn = function (i) {
					return self.data.rowVals[i][spec.groupFieldIndex];
				};
			}
			else if ((spec.rowVal || spec.rowValIndex != null) && spec.aggNum != null) { // #2

				// SORT PIVOTS BY CELL AGGREGATE RESULT (FOR CERTAIN ROWVAL)
				// =========================================================
				//
				//   * rowVal: [string] -OR- rowValIndex: number
				//   * aggNum: number

				if (spec.rowVal) {
					spec.rowValIndex = -1;
					for (rvi = 0; rvi < self.data.rowVals.length; rvi += 1) {
						if (_.isEqual(self.data.rowVals[rvi], spec.rowVal)) {
							spec.rowValIndex = rvi;
							break;
						}
					}
					if (spec.rowValIndex === -1) {
						self.logError(self.makeLogTag() + ' Unable to sort: invalid rowVal {spec = %O}', spec);
						return next(false);
					}
				}

				if (spec.rowValIndex < 0 || spec.rowValIndex >= self.data.rowVals.length) {
					self.logError(self.makeLogTag() + ' Unable to sort: rowValIndex out of range {spec = %O, range = [0,%d]}',
										spec, self.data.rowVals.length);
					return next(false);
				}

				if (spec.aggNum < 0 || spec.aggNum >= aggInfo.cell.length) {
					self.logError(self.makeLogTag() + ' Unable to sort: aggNum out of range {spec = %O, range = [0,%d]}',
										spec, aggInfo.cell.length);
					return next(false);
				}

				fti = aggInfo.cell[spec.aggNum].instance.getType();
				sortSourceFn = function (i) {
					return self.data.agg.results.cell[spec.aggNum][spec.rowValIndex][i];
				};
			}
			else if (spec.pivotFieldIndex != null) { // #3

				// SORT PIVOTS BY PIVOT FIELD VALUE
				// ================================
				//
				//   * pivotFieldIndex: number

				if (spec.pivotFieldIndex < 0 || spec.pivotFieldIndex >= self.data.pivotFields.length) {
					self.logError(self.makeLogTag() + ' Unable to sort: pivotFieldIndex out of range {spec = %O, range = [0,%d]}',
										spec, self.data.pivotFields.length);
					return next(false);
				}

				if (spec.values) {
					sortAlgorithm = 'pigeonHole';
				}
				else if (self.data.pivotSpec[spec.pivotFieldIndex].fun != null) {
					// The values that we're sorting came from a function applied to the value of the pivot
					// field in the row, e.g. "Day of Week."  Therefore, we can't sort them based on the type
					// of the pivot field, e.g. date.

					fti = {
						type: GROUP_FUNCTION_REGISTRY.get(self.data.pivotSpec[spec.pivotFieldIndex].fun).sortType
					};
				}
				else {
					fti = self.typeInfo.get(self.data.pivotFields[spec.pivotFieldIndex]);
				}

				sortSourceFn = function (i) {
					return self.data.colVals[i][spec.pivotFieldIndex];
				};
			}
			else if ((spec.colVal || spec.colValIndex != null) && spec.aggNum != null) { // #4

				// SORT GROUPS BY CELL AGGREGATE RESULT (FOR CERTAIN COLVAL)
				// =========================================================
				//
				//   * colVal: [string] -OR- colValIndex: number
				//   * aggNum: number

				if (spec.colVal) {
					spec.colValIndex = -1;
					for (cvi = 0; cvi < self.data.colVals.length; cvi += 1) {
						if (_.isEqual(self.data.colVals[cvi], spec.colVal)) {
							spec.colValIndex = cvi;
							break;
						}
					}
					if (spec.colValIndex === -1) {
						self.logError(self.makeLogTag() + ' Unable to sort: invalid colVal {spec = %O}', spec);
						return next(false);
					}
				}

				if (spec.colValIndex < 0 || spec.colValIndex >= self.data.colVals.length) {
					self.logError(self.makeLogTag() + ' Unable to sort: colValIndex out of range {spec = %O, range = [0,%d]}',
										spec, self.data.colVals.length);
					return next(false);
				}

				if (spec.aggNum < 0 || spec.aggNum >= aggInfo.cell.length) {
					self.logError(self.makeLogTag() + ' Unable to sort: aggNum out of range {spec = %O, range = [0,%d]}',
										spec, aggInfo.cell.length);
					return next(false);
				}

				fti = aggInfo.cell[spec.aggNum].instance.getType();
				sortSourceFn = function (i) {
					return self.data.agg.results.cell[spec.aggNum][i][spec.colValIndex];
				};
			}
			else if (spec.aggType === 'pivot' && spec.aggNum != null) { // #5

				// SORT PIVOTS BY PIVOT AGGREGATE RESULT
				// =====================================
				//
				//   * aggType: "pivot"
				//   * aggNum: number

				if (spec.aggNum < 0 || spec.aggNum >= aggInfo.pivot.length) {
					self.logError(self.makeLogTag() + ' Unable to sort: aggNum out of range {spec = %O, range = [0,%d]}',
										spec, aggInfo.pivot.length);
					return next(false);
				}

				fti = aggInfo.pivot[spec.aggNum].instance.getType();
				sortSourceFn = function (i) {
					return self.data.agg.results.pivot[spec.aggNum][i];
				};
			}
			else if (spec.aggType === 'group' && spec.aggNum != null) { // #6

				// SORT GROUPS BY GROUP AGGREGATE RESULT
				// =====================================
				//
				//   * aggType: "group"
				//   * aggNum: number

				if (spec.aggNum < 0 || spec.aggNum >= aggInfo.group.length) {
					self.logError(self.makeLogTag() + ' Unable to sort: aggNum out of range {spec = %O, range = [0,%d]}',
										spec, aggInfo.group.length);
					return next(false);
				}

				fti = aggInfo.group[spec.aggNum].instance.getType();
				sortSourceFn = function (i) {
					return self.data.agg.results.group[spec.aggNum][i];
				};
			}
			else {
				self.logError(self.makeLogTag() + ' Invalid sort spec for pivotted data: ' + JSON.stringify(spec));
				return next(false);
			}
		}

		//console.log(self.typeInfo.asMap());
		//console.log(self.data.agg);

		var cmp, comparison;

		if (sortAlgorithm === 'mergeSort') {
			cmp = determineCmp(spec, fti);
			if (cmp == null) {
				return next(false);
			}

			// NOTE We're intentionally making the sort stable only when sorting ascending.
			//
			// When sorting rowvals/colvals:
			//
			// Since we're always starting from the same set of data (which is sorted asc by each element
			// of the rowval/colval in turn), no matter which direction we sort, this has the effect of
			// making the following work:
			//
			//   X,Y             X,Y            X,Y
			//  -----           -----          -----
			//   A,A             C,C            A,A
			//   A,B             C,B            A,B
			//   A,C             C,A            A,C
			//   B,A  ========>  B,C  =======>  B,A
			//   B,B   X, DESC   B,B   X, ASC   B,B
			//   B,C  ========>  B,A  =======>  B,C
			//   C,A             A,C            C,A
			//   C,B             A,B            C,B
			//   C,C             A,A            C,C
			//
			// This magickally does the expected thing, in every scenario.  Fields other than the one
			// sorted by (in the example above, Y) end up sorted in the same direction, left to right.
			//
			// FIXME This will need to be adjusted when we support multiple sorts.  Both directions should
			// be stable when we do that, or else it won't work as expected.

			comparison = function (a, b) {
				if (spec.dir.toUpperCase() === 'ASC') {
					return cmp(a.sortSource, b.sortSource) <= 0;
				}
				else if (spec.dir.toUpperCase() === 'DESC') {
					return cmp(a.sortSource, b.sortSource) > 0;
				}
				else {
					throw new Error('Invalid sort spec: `dir` must be either "ASC" or "DESC"');
				}
			};
		}

		var bundle = packBundle(spec, orientation, sortSourceFn);
		if (bundle == null) {
			return next(false);
		}

		//console.log(fti);
		//console.log(cmp);
		//console.log(bundle);

		var finish = makeFinishCb(unpackBundle(orientation), next);

		self.logDebug(self.makeLogTag('sort') + ' Performing sort using %s algorithm', sortAlgorithm);

		switch (sortAlgorithm) {
		case 'mergeSort':
			return mergeSort4(bundle, comparison, finish, self.sortProgress && self.sortProgress.update);
		case 'pigeonHole':
			return pigeonHoleSort(bundle, spec.values, finish);
		default:
			throw new Error('Internal Error: Invalid sort algorithm: ' + sortAlgorithm);
		}
	};



	var start = function () {
		self.fire('sortBegin');
		self.timing.start(timingEvt);

		if (self.sortProgress
				&& typeof self.sortProgress.begin === 'function') {
			self.sortProgress.begin();
		}
	};

	var end = function (ok) {
		if (self.sortProgress
				&& typeof self.sortProgress.end === 'function') {
			self.sortProgress.end();
		}

		self.timing.stop(timingEvt);
		self.fire('sortEnd');

		return cont(ok);
	};

	start();
	performSort('horizontal', function (didHorizontal) {
		if (!didHorizontal) {
			return end(false);
		}

		performSort('vertical', function (didVertical) {
			return end(didVertical);
		});
	});
};

// #setFilter {{{2

/**
 * Set the filtering that will be used by this view.  The object spec is the same as we support for
 * server-side filtering using JSON.  It's based on MongoDB.  Every key is the name of a column to
 * filter.  Every value is either a string (the column must be equal to that value), or an object
 * --- in which every key is an operator and every value an operand.  Operators are:
 *
 *   - $eq, $ne, $gt, $gte, $lt, $lte, $contains, $notcontains
 *   - $in, $nin
 *
 * @method
 * @memberof ComputedView
 *
 * @param {ComputedView~FilterSpec} spec How to perform filtering.
 *
 * @param {object} progress
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.sendEvent=true]
 * If true, issue an event indicating the filter has been changed.
 *
 * @param {Array.<Object>} [opts.dontSendEventTo]
 * Don't send events to these subscribers.
 *
 * @param {boolean} [opts.updateData=true]
 * If true, automatically update data to match new filter.
 */

ComputedView.prototype.setFilter = function (spec, progress, opts) {
	var self = this
		, args = Array.prototype.slice.call(arguments)
		, isDifferent = false;

	opts = deepCopy(opts) || {};

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setFilter.apply(self, args);
		}, 'Waiting to set filter: ' + JSON.stringify(spec));
	}

	opts = deepDefaults(opts, {
		sendEvent: true,
		dontSendEventTo: [],
		updateData: true,
		savePrefs: true
	});

	self.logDebug(self.makeLogTag('setFilter') + ' spec = %O ; options = %O', spec, opts);

	isDifferent = !_.isEqual(self.filterSpec, spec);

	if (self.filterSpec != null && spec == null) {
		self.wasPreviouslyFiltered = true;
	}

	/*
	if (spec != null) {
		if (self.typeInfo == null) {
			return self.getTypeInfo(function () {
				self.setFilter.apply(self, args);
			});
		}

		_.each(spec, function (fieldSpec, field) {
			if (self.typeInfo.get(field) == null) {
				self.logError(self.makeLogTag() + ' Ignoring filter on field "' + field + '" because it doesn\'t exist in the data');
				delete spec[field];
			}
		});
	}
	*/

	self.filterSpec = spec;
	self.filterProgress = progress;

	self.super['View'].setFilter(spec, opts);

	if (isDifferent && self.prefs != null && opts.savePrefs) {
		self.prefs.save();
	}

	self.clearCache();

	if (opts.updateData) {
		self.getData();
	}

	return true;
};

// #getFilter {{{2

ComputedView.prototype.getFilter = function () {
	var self = this;

	return self.filterSpec;
};

// #clearFilter {{{2

/**
 * Clear the spec used to filter this view.
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.sendEvent=true]
 * If true, issue an event indicating the filter has been changed.
 *
 * @param {Array.<Object>} [opts.dontSendEventTo]
 * Don't send events to these subscribers.
 *
 * @param {boolean} [opts.updateData=true]
 * If true, automatically update data to match new filter.
 */

ComputedView.prototype.clearFilter = function (opts) {
	this.setFilter(null, null, opts);
};

// #isFiltered {{{2

/**
 * Tell if this view has been filtered.
 *
 * @returns {boolean} True if the view has been filtered.
 */

ComputedView.prototype.isFiltered = function () {
	return this.filterSpec != null;
};

// #filter {{{2

/**
 * Apply the filter previously set.
 *
 * @param {function} cont Continuation function to which the filtered data is passed.
 */

ComputedView.prototype.filter = function (cont) {
	var self = this
		, timingEvt = ['Data Source "' + self.source.name + '" : ' + self.name, 'Filtering']
		, now = moment(getProp(window, 'MIE', 'WC_DataVis', 'CURRENT_DATE'));

	if (self.filterSpec == null) {
		if (!self.wasPreviouslyFiltered) {
			return cont(false, self.data.data);
		}
		else {
			self.wasPreviouslyFiltered = false;
		}
	}

	// Make sure that each column that we're filtering has been type decoded, if necessary.

	_.each(self.filterSpec, function (fieldSpec, field) {
		var fti = self.typeInfo.get(field);

		// Check to make sure we have enough information about the type of the field that the user wants
		// us to filter.

		if (fti === undefined) {
			self.logError(self.makeLogTag() + ' Filter field "' + field + '" does not exist in the source');
			self.fire('invalidFilterField', null, field);
			delete self.filterSpec[field];
			return;
		}

		if (fti.type === undefined) {
			self.logError(self.makeLogTag() + ' Unable to filter field "' + field + '", type is unknown');
			self.fire('invalidFilterField', null, field);
			delete self.filterSpec[field];
			return;
		}

		// For dates and datetimes, if the data is stored in moment objects, convert filters serialized
		// as strings into moment objects before continuing.

		if (['date', 'datetime'].indexOf(fti.type) >= 0 && fti.internalType === 'moment') {
			_.each(fieldSpec, function (val, op) {
				if (typeof val === 'string') {
					fieldSpec[op] = moment(val);
				}
			});
		}

		Source.decodeAll(self.data.dataByRowId, fti.field, self.typeInfo);
	});

	// Checks to see if the given filter passes for the given row.

	function passesFilter(fltr, field, row) {
		var fti = self.typeInfo.get(field);
		var datum = row[field].value
			, d;

		// When there's no such column, automatically fail.

		if (datum === undefined) {
			self.logDebug(self.makeLogTag() + ' VIEW (' + self.name + ') // FILTER',
				'Attempted to filter by non-existent column: ' + field);
			return false;
		}

		var isMoment = moment.isMoment(datum);
		var isNumeral = numeral.isNumeral(datum);
		var isString = typeof datum === 'string';
		var isNumber = typeof datum === 'number';

		var pred = {};

		//var cmp = getComparisonFn.byValue(datum);
		var cmp = getComparisonFn.byType(fti.type);

		pred['$eq'] = function (operand) {
			return cmp(datum, operand) === 0;
		};

		pred['$ne'] = function (operand) {
			return !pred['$eq'](operand);
		};

		pred['$contains'] = function (operand) {
			return isString && datum.indexOf(operand.toString().toLowerCase()) >= 0;
		};

		pred['$notcontains'] = function (operand) {
			return !pred['$contains'](operand);
		};

		pred['$gt'] = function (operand) {
			return cmp(datum, operand) > 0;
		};

		pred['$gte'] = function (operand) {
			return pred['$gt'](operand) || pred['$eq'](operand);
		};

		pred['$lt'] = function (operand) {
			return cmp(datum, operand) < 0;
		};

		pred['$lte'] = function (operand) {
			return pred['$lt'](operand) || pred['$eq'](operand);
		};

		pred['$exists'] = function (operand) {
			return operand ? (
				datum != null && ( isString ? datum !== '' : true )
			) : (
				datum == null || ( isString ? datum === '' : false )
			);
		};

		pred['$notexists'] = function (operand) {
			return !pred['$exists'](operand);
		};

		if (_.isArray(fltr)) {
			fltr = { '$in': fltr };
		}
		else if (!_.isObject(fltr)) {
			fltr = { '$eq': fltr };
		}

		for (var operator in fltr) {
			if (!Object.prototype.hasOwnProperty.call(fltr, operator)) {
				continue;
			}

			var operand = fltr[operator];
			//self.debug('FILTER', 'field = ' + field + ' ; Datum = ' + datum + ' ; Operator = ' + operator + ' ; Operand = ' + operand);

			if (pred[operator] !== undefined) {
				if (_.isArray(operand)) {
					if (_.every(operand, pred[operator]) === false) {
						return false;
					}
				}
				else if (pred[operator](operand) === false) {
					return false;
				}
			}
			else {
				switch (operator) {
				case '$in':
					if (!_.isArray(operand)) {
						throw new Error('Invalid filter spec, operator "$in" for column "' + field + '" requires array value');
					}

					if (_.map(operand, function (elt) { return elt.toString().toLowerCase(); }).indexOf(datum.toString().toLowerCase()) < 0) {
						return false;
					}
					break;

				case '$nin':
					if (!_.isArray(operand)) {
						throw new Error('Invalid filter spec, operator "$nin" for column "' + field + '" requires array value');
					}

					if (_.map(operand, function (elt) { return elt.toString().toLowerCase(); }).indexOf(datum.toString().toLowerCase()) >= 0) {
						return false;
					}
					break;

				case '$every':
					var days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
					var months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

					if (fti.type !== 'date' && fti.type !== 'datetime') {
						self.logError(self.makeLogTag() + ' Invalid operator "$every" for field "' + field + '" of type "' + fti.type + '"');
						return false;
					}
					var dayIdx = days.indexOf(operand);
					var monthIdx = months.indexOf(operand);
					d = isString ? moment(datum) : isMoment ? datum : null;
					if (d == null) {
						self.logError(self.makeLogTag() + ' Operator "$every" cannot be applied to data in field "' + field + '" of type "' + fti.type + '" and internal type "' + fti.internalType + '"');
						return false;
					}

					if (dayIdx >= 0) {
						return d.day() === dayIdx;
					}
					else if (monthIdx >= 0) {
						return d.month() === monthIdx;
					}
					else {
						self.logError(self.makeLogTag() + ' Invalid "$every" operand "' + operand + '" for field "' + field + '"');
						return false;
					}
					break;

				case '$this':
					if (fti.type !== 'date' && fti.type !== 'datetime') {
						self.logError(self.makeLogTag() + ' Invalid operator "$this" for field "' + field + '" of type "' + fti.type + '"');
						return false;
					}
					d = isString ? moment(datum) : isMoment ? datum : null;
					if (d == null) {
						self.logError(self.makeLogTag() + ' Operator "$this" cannot be applied to data in field "' + field + '" of type "' + fti.type + '" and internal type "' + fti.internalType + '"');
						return false;
					}
					switch (operand) {
					case 'DATE':
						return d.format('YYYY-MM-DD') === now.format('YYYY-MM-DD');
					case 'WEEK':
						return d.format('YYYY-WW') === now.format('YYYY-WW');
					case 'MONTH':
						return d.format('YYYY-MM') === now.format('YYYY-MM');
					case 'QUARTER':
						return d.format('YYYY-Q') === now.format('YYYY-Q');
					case 'YEAR':
						return d.format('YYYY') === now.format('YYYY');
					default:
						self.logError(self.makeLogTag() + ' Invalid "$this" operand "' + operand + '" for field "' + field + '"');
						return false;
					}
					break;

				case '$last':
					if (fti.type !== 'date' && fti.type !== 'datetime') {
						self.logError(self.makeLogTag() + ' Invalid operator "$last" for field "' + field + '" of type "' + fti.type + '"');
						return false;
					}
					d = isString ? moment(datum) : isMoment ? datum : null;
					if (d == null) {
						self.logError(self.makeLogTag() + ' Operator "$last" cannot be applied to data in field "' + field + '" of type "' + fti.type + '" and internal type "' + fti.internalType + '"');
						return false;
					}
					switch (operand) {
					case 'DATE':
						return d.format('YYYY-MM-DD') === now.clone().subtract(1, 'days').format('YYYY-MM-DD');
					case 'WEEK':
						return d.format('YYYY-WW') === now.clone().subtract(1, 'weeks').format('YYYY-WW');
					case 'MONTH':
						return d.format('YYYY-MM') === now.clone().subtract(1, 'months').format('YYYY-MM');
					case 'QUARTER':
						return d.format('YYYY-Q') === now.clone().subtract(1, 'quarters').format('YYYY-Q');
					case 'YEAR':
						return d.format('YYYY') === now.clone().subtract(1, 'years').format('YYYY');
					default:
						self.logError(self.makeLogTag() + ' Invalid "$last" operand "' + operand + '" for field "' + field + '"');
						return false;
					}
					break;

				default:
					throw new Error('Invalid operator "' + operator + '" for column "' + field + '"');
				}
			}
		}

		return true;
	}

	// Checks to see if all filters from the spec pass on the given row.

	function passesAllFilters(row) {
		// Iterate over all elements in the filter spec, testing each in turn, until one fails.  Pass
		// the row along as "extra data" because that's what the predicate is actually testing.

		var passes = self.filterSpec == null ? true : eachUntilObj(self.filterSpec, passesFilter, false, row.rowData);

		self.fire('filter', {
			silent: true
		}, row.rowNum, !passes);

		return passes;
	}

	/*
	if (self.data === undefined) {
		return self.getData(function () {
			return self.filter();
		});
	}
	else if (self.typeInfo === undefined) {
		return self.getTypeInfo(function () {
			return self.filter();
		});
	}
	else {
		self.timing.start(timingEvt);
		self.data = _.filter(self.data, passesAllFilters);
		self.timing.stop(timingEvt);
	}
	*/

	var i0 = {
		val: 0
	}, i_step = self.filterProgress ? 100 : self.data.data.length;
	var newData = [];

	var doFilter = function () {
		var i;

		//self.debug('FILTER',
		//					 'Filtering rows ' + i0.val + ' through ' + (i0.val + i_step));

		for (i = i0.val; i < self.data.data.length && i < i0.val + i_step; i += 1) {
			if (passesAllFilters(self.data.data[i])) {
				newData.push(self.data.data[i]);
			}
		}

		if (i < self.data.data.length) {
			i0.val = i;

			if (self.filterProgress
					&& typeof self.filterProgress.update === 'function') {
				self.filterProgress.update(i, self.data.data.length);
			}

			logAsync('ComputedView#filter');
			return window.setTimeout(doFilter);
		}
		else {
			// If there's a progress callback, perform its done event.
			if (self.filterProgress
					&& typeof self.filterProgress.end === 'function') {
				self.filterProgress.end();
			}

			// Fire the event for finishing the filter.
			self.fire('filterEnd');

			// Stop the timer for the filter.
			self.timing.stop(timingEvt);

			// Pass the filtered data to the continuation.
			return cont(true, newData);
		}
	};

	// Start the timer for the filter operation.
	self.timing.start(timingEvt);

	// If there's a progress callback, perform its start event.
	if (self.filterProgress
			&& typeof self.filterProgress.begin === 'function') {
		self.filterProgress.begin();
	}

	// Fire the event for starting the filter.
	self.fire('filterBegin');

	return doFilter();
};

// #setGroup {{{2

/**
 * Set the specification for how the data will be grouped.
 *
 * @param {ComputedView~GroupSpec} spec
 * The grouping configuration.
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.sendEvent=true]
 * If true, issue an event indicating the grouping has been changed.
 *
 * @param {Array.<Object>} [opts.dontSendEventTo]
 * Don't send events to these subscribers.
 *
 * @param {boolean} [opts.updateData=true]
 * If true, automatically update data to match new grouping.
 */

ComputedView.prototype.setGroup = function (spec, opts, cont) {
	var self = this
		, args = Array.prototype.slice.call(arguments)
		, isDifferent = false;

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setGroup.apply(self, args);
		}, 'Waiting to set group: ' + JSON.stringify(spec));
	}

	opts = deepDefaults(opts, {
		sendEvent: true,
		dontSendEventTo: [],
		updateData: true,
		savePrefs: true
	});

	self.logDebug(self.makeLogTag('setGroup') + ' spec = %O', spec);

	if (spec == null && self.pivotSpec != null) {
		self.logWarning(self.makeLogTag('setGroup') + ' Having a pivot without a group is not allowed');
		self.clearPivot(opts);
	}

	if (spec != null) {
		if (!_.isArray(spec.fieldNames)) {
			self.logWarning(self.makeLogTag('setGroup') + ' `spec.fieldNames` is not an array');
			spec.fieldNames = [];
		}

		// Convert the `fieldNames` property elements from strings to objects.

		for (var i = 0; i < spec.fieldNames.length; i += 1) {
			if (typeof spec.fieldNames[i] === 'string') {
				spec.fieldNames[i] = { field: spec.fieldNames[i] };
			}
		}
	}

	/*
	if (spec != null) {
		// Make sure we have typeInfo so we can perform the next check.

		if (self.typeInfo == null) {
			return self.getTypeInfo(function () {
				self.setGroup.apply(self, args);
			});
		}

		// Remove any fields that don't exist in the data (according to typeInfo).

		spec.fieldNames = _.filter(spec.fieldNames, function (field) {
			if (self.typeInfo.get(field) == null) {
				self.logError(self.makeLogTag() + ' Ignoring group on field "' + field + '" because it doesn\'t exist in the data');
				return false;
			}
			return true;
		});

		// Don't do anything if we're not grouping by any fields.

		if (spec.fieldNames.length === 0) {
			return false;
		}
	}
	*/

	isDifferent = !_.isEqual(self.groupSpec, spec);

	self.super['View'].setGroup(spec, opts);

	if (isDifferent && self.prefs != null && opts.savePrefs) {
		self.prefs.save();
	}

	self.clearCache();

	if (!opts.updateData) {
		return true;
	}

	self.getData();

	return true;
};

// #getGroup {{{2

/**
 * Get the grouping configuration.
 *
 * @returns {ComputedView~GroupSpec}
 * The grouping config currently being used by this view.
 */

ComputedView.prototype.getGroup = function () {
	var self = this;

	return self.groupSpec;
};

// #clearGroup {{{2

/**
 * Reset the grouping config so the data is not grouped.
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.sendEvent=true]
 * If true, issue an event indicating the grouping has been changed.
 *
 * @param {Array.<Object>} [opts.dontSendEventTo]
 * Don't send events to these subscribers.
 *
 * @param {boolean} [opts.updateData=true]
 * If true, automatically update data to match new grouping.
 */

ComputedView.prototype.clearGroup = function (opts) {
	return this.setGroup(null, opts);
};

// #group {{{2

/**
 * Perform grouping on the data.  This modifies the data in place; it's not asynchronous and there's
 * no return value.
 */

ComputedView.prototype.group = function () {
	var self = this
		, finalGroupSpec = []
		, newData
		, rowVals;

	// Make sure that grouping has been asked for.

	if (self.groupSpec == null) {
		return false;
	}

	// We need `typeInfo` to verify that the group fields requested actually exist in the source data.
	// It's not possible to just use the data, because there may be no rows.

	if (self.typeInfo == null) {
		self.logError(self.makeLogTag() + ' Source type information is missing');
		return false;
	}

	// Go through every group field and make sure it exists in the source.  If it doesn't, we use an
	// event to notify the user interface about it so a warning can be shown.

	_.each(self.groupSpec.fieldNames, function (fieldObj) {
		var fti = self.typeInfo.get(fieldObj.field);
		if (fti == null) {
			self.logError(self.makeLogTag() + ' Group field does not exist in the source: ' + fieldObj.field);
			self.fire('invalidGroupField', null, fieldObj.field);
		}
		else if (fti.type == null) {
			self.logError(self.makeLogTag() + ' Unable to group by field "%s": type is undefined');
		}
		else {
			Source.decodeAll(self.data.dataByRowId, fti.field, self.typeInfo);
			finalGroupSpec.push(fieldObj);
		}
	});

	// It's possible now that we've eliminated *all* the group fields because they're invalid; if
	// that's the case, we just abort as if no grouping was requested at all.

	if (finalGroupSpec.length === 0) {
		return false;
	}

	// natRep --
	//
	//   Short for "native representation."  A string version of the value that is safe to use as the
	//   key in an object, and which also sorts the same as the value it represents.
	//
	//     sort(values) = map(natRep->val, sort(map(val->natRep, values)))

	var origKeys = []; // groupFieldIndex[] → natRep → value

	// buildRowVals {{{3
	//
	//   Create the list of the native representations of all combinations of the values of the group
	//   fields.  Here's a simple example with strings, where the natrep transform is identity.
	//
	//   buildRowVals(['Last Name', 'First Name'])
	//     => [['Roosevelt', 'Franklin'], ['Roosevelt', 'Theodore'], ['Kennedy', 'John'], ...]
	//
	//   Here's an example with dates, where the natrep transform is to convert to UNIX time.
	//
	//   buildRowVals(['Create Date'])
	//     => [[1526346077 /* 2018-05-14 21:01:17 GMT-4 */, ...]]
	//
	//   As a side effect, the `origKeys[groupFieldIndex]` object is updated with how to reverse the
	//   natrep transform.  This will be used later.

	var buildRowVals = function (addRowVals) {
		var rowVals = []
			, rowVal
			, row
			, rowIndex
			, groupSpecElt
			, groupFieldIndex
			, cell
			, value
			, natRep
			, groupFun
			, groupFunResult
			, fti;

		for (rowIndex = 0; rowIndex < self.data.data.length; rowIndex += 1) {
			row = self.data.data[rowIndex];
			rowVal = [];
			for (groupFieldIndex = 0; groupFieldIndex < finalGroupSpec.length; groupFieldIndex += 1) {
				groupSpecElt = finalGroupSpec[groupFieldIndex];
				fti = self.typeInfo.get(groupSpecElt.field);
				cell = row.rowData[groupSpecElt.field];
				value = cell.value;
				if (groupSpecElt.fun == null) {
					natRep = types.registry.isSet(fti.type) ?
						types.registry.get(fti.type).natRep(value) :
						getNatRep(value);
					origKeys[groupFieldIndex][natRep] = value;
				}
				else {
					groupFun = GROUP_FUNCTION_REGISTRY.get(groupSpecElt.fun);
					groupFunResult = groupFun.applyValueFun(value, self.typeInfo.get(groupSpecElt.field));
					natRep = getNatRep(groupFunResult);
					origKeys[groupFieldIndex][natRep] = groupFunResult;
				}
				rowVal[groupFieldIndex] = natRep;
				// Cache the natRep in the cell for improved performance in buildData().
				setProp(natRep, cell, 'natRep', 'group', groupFieldIndex);
			}
			if (_.findIndex(rowVals, function (x) {
				return arrayEqual(rowVal, x);
			}) === -1) {
				rowVals.push(rowVal);
			}
		}

		if (addRowVals != null) {
			for (var arvIndex = 0; arvIndex < addRowVals.length; arvIndex += 1) {
				rowVal = addRowVals[arvIndex];

				if (rowVal.length != finalGroupSpec.length) {
					self.logError(self.makeLogTag() + ' Unable to add rowVal %s when grouping by %s: the lengths must be the same',
						JSON.stringify(rowVal), JSON.stringify(finalGroupSpec));
					continue;
				}

				for (groupFieldIndex = 0; groupFieldIndex < rowVal.length; groupFieldIndex += 1) {
					groupSpecElt = finalGroupSpec[groupFieldIndex];
					fti = self.typeInfo.get(groupSpecElt.field);
					value = rowVal[groupFieldIndex];
					natRep = types.registry.isSet(fti.type) ?
						types.registry.get(fti.type).natRep(value) :
						getNatRep(value);
					origKeys[groupFieldIndex][natRep] = value;
					rowVal[groupFieldIndex] = natRep;
				}

				if (_.findIndex(rowVals, function (x) {
					return arrayEqual(rowVal, x);
				}) === -1) {
					rowVals.push(rowVal);
				}
			}
		}

		rowVals.sort(function (a, b) {
			return arrayCompare(a, b);
		});

		return rowVals;
	};

	// buildData {{{3

	var buildData = function (data, rowVals) {
		var rowVal
			, rowValIndex
			, metadataLeaf
			, row
			, rowIndex
			, groupSpecElt
			, groupFieldIndex
			, value
			, groupFun;

		var result = new Array(rowVals.length);
		var metadataTree = {
			lookup: {
				byRowNum: new Array(data.length),
				byRowValIndex: new Array(rowVals.length),
				byId: [],
			}
		};

		// Build the metadata tree leaves.  Each path through the metadata tree from root to leaf
		// represents a group, with each step along the way being an element of the rowval.

		for (rowValIndex = 0; rowValIndex < rowVals.length; rowValIndex += 1) {
			rowVal = rowVals[rowValIndex];
			metadataLeaf = {
				rowValIndex: rowValIndex,
				rowValElt: rowVal[rowVal.length - 1],
				parent: null,
				numRows: 0,
				rows: []
			};

			result[rowValIndex] = metadataLeaf.rows;

			setProp(metadataLeaf, metadataTree, 'children', interleaveWith(rowVal, 'children'));
			metadataTree.lookup.byRowValIndex[rowValIndex] = metadataLeaf;
		}

		// Build the `rows` property of each metadata tree leaf.  These are the rows that belong in each
		// group.  Here's how it works:
		//
		//   1. Construct the rowval from the data in the row.
		//   2. Use the rowval as a path to walk the tree to the leaf.
		//   3. Append the row to the leaf's collection.

		for (rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
			row = data[rowIndex];
			rowVal = new Array(finalGroupSpec.length);

			for (groupFieldIndex = 0; groupFieldIndex < finalGroupSpec.length; groupFieldIndex += 1) {
				groupSpecElt = finalGroupSpec[groupFieldIndex];
				// Use the cached natRep from the cell to quickly build the path to the metadata node.
				rowVal[groupFieldIndex] = row.rowData[groupSpecElt.field].natRep.group[groupFieldIndex];
			}

			metadataLeaf = getProp(metadataTree, 'children', interleaveWith(rowVal, 'children'));
			metadataTree.lookup.byRowNum[row.rowNum] = metadataLeaf;

			metadataLeaf.rows.push(row);
		}

		// A post-order traversal is used to build the info in the metadata tree from the leaves up.

		var metadataId = 0;
		var postorder = function (node, depth) {
			node.id = metadataId++;
			node.numRows = 0;

			metadataTree.lookup.byId[node.id] = node;

			// NOTE When there are no rows in the data, the root of the tree has no children, but also no
			// rows (because it's not a rowVal leaf).  This case is handled by setting numRows = 0 above.

			if (node.children == null) {
				// We're not in the middle of the metadata tree, this is a leaf node.

				if (node.rows != null) {
					node.numRows = node.rows.length;
				}
			}
			else {
				node.numChildren = _.keys(node.children).length;
				node.rows = [];

				// Update the parent node in each child, continue the post-order traversal in each, and then
				// after the metadata is fully constructed in each child, build this node's metadata.

				_.each(node.children, function (child) {
					child.parent = node;
					postorder(child, depth + 1);
					node.numRows += child.numRows;
					node.rows = node.rows.concat(child.rows);
				});

				// Depth 0 is for the root, it doesn't actually represent any data (i.e. it's not part of a
				// rowval), it's just a structural container of everything else.

				if (depth > 0) {
					// FIXME Assumes that node.children.length > 0.

					// Copy the `rowValIndex` from the first child.  I actually can't remember why we do it
					// this way, because this node within the tree has children from multiple rowVals.

					node.rowValIndex = node.children[_.keys(node.children)[0]].rowValIndex;

					// We only have to set `rowValElt` here in non-leaves because it's already been set in the
					// leaves when we created them.  We're just filling in the upper levels of the tree now.

					node.rowValElt = rowVals[node.rowValIndex][depth - 1];
				}
			}

			// Depth 0 is for the root, it doesn't actually represent any data (i.e. it's not part of a
			// rowval), it's just a structural container of everything else.

			if (depth > 0) {
				node.groupFieldIndex = depth - 1;
				node.groupField = finalGroupSpec[node.groupFieldIndex].field;
				node.groupSpec = finalGroupSpec[node.groupFieldIndex];
				if (node.rows != null && node.rows.length > 0) {
					node.rowValCell = node.rows[0].rowData[node.groupField];
				}
			}
		};

		postorder(metadataTree, 0);

		return {
			data: result,
			metadata: metadataTree
		};
	};

	// convertRowVals {{{3

	var convertRowVals = function (rowVals) {
		var result = [];

		for (var rowValIndex = 0; rowValIndex < rowVals.length; rowValIndex += 1) {
			var rowVal = rowVals[rowValIndex];
			result[rowValIndex] = [];
			for (var groupFieldIndex = 0; groupFieldIndex < finalGroupSpec.length; groupFieldIndex += 1) {
				result[rowValIndex][groupFieldIndex] = origKeys[groupFieldIndex][rowVal[groupFieldIndex]];
			}
		}

		return result;
	};

	// }}}3

	for (var groupFieldIndex = 0; groupFieldIndex < finalGroupSpec.length; groupFieldIndex += 1) {
		origKeys[groupFieldIndex] = {};
	}

	rowVals = buildRowVals(self.groupSpec.addRowVals);
	newData = buildData(self.data.data, rowVals);
	rowVals = convertRowVals(rowVals);

	self.logDebug(self.makeLogTag('group') + ' Group Spec: %O', finalGroupSpec);
	self.logDebug(self.makeLogTag('group') + ' Row Vals: %O', rowVals);
	self.logDebug(self.makeLogTag('group') + ' New Data: %O', newData.data);

	self.data.isPlain = false;
	self.data.isGroup = true;
	self.data.groupFields = _.pluck(finalGroupSpec, 'field');
	self.data.groupSpec = finalGroupSpec;
	self.data.rowVals = rowVals;
	self.data.data = newData.data;
	self.data.groupMetadata = newData.metadata;

	self.logDebug(self.makeLogTag('group') + ' Final Data: %O', self.data);

	return true;
};

// #setPivot {{{2

/**
 * Set the pivot configuration.
 *
 * @param {ComputedView~PivotSpec} spec
 * The pivot configuration.
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.sendEvent=true]
 * If true, issue an event indicating the pivot config has been changed.
 *
 * @param {Array.<Object>} [opts.dontSendEventTo]
 * Don't send events to these subscribers.
 *
 * @param {boolean} [opts.updateData=true]
 * If true, automatically update data to match new pivot config.
 */

ComputedView.prototype.setPivot = function (spec, opts) {
	var self = this
		, args = Array.prototype.slice.call(arguments)
		, isDifferent = false;

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setPivot.apply(self, args);
		}, 'Waiting to set pivot: ' + JSON.stringify(spec));
	}

	opts = deepDefaults(opts, {
		sendEvent: true,
		dontSendEventTo: [],
		updateData: true,
		savePrefs: true
	});

	self.logDebug(self.makeLogTag('setPivot') + ' spec = %O', spec);

	if (self.groupSpec == null && spec != null) {
		self.logWarning(self.makeLogTag('setPivot') + ' Having a pivot without a group is not allowed');
		self.clearPivot(opts);
		return false;
	}

	if (spec != null) {
		if (!_.isArray(spec.fieldNames)) {
			self.logWarning(self.makeLogTag('setPivot') + ' `spec.fieldNames` is not an array');
			spec.fieldNames = [];
		}

		// Convert the `fieldNames` property elements from strings to objects.

		for (var i = 0; i < spec.fieldNames.length; i += 1) {
			if (typeof spec.fieldNames[i] === 'string') {
				spec.fieldNames[i] = { field: spec.fieldNames[i] };
			}
		}
	}

	/*
	if (spec != null) {
		// Make sure we have typeInfo so we can perform the next check.

		if (self.typeInfo == null) {
			return self.getTypeInfo(function () {
				self.setPivot.apply(self, args);
			});
		}

		// Remove any fields that don't exist in the data (according to typeInfo).

		spec.fieldNames = _.filter(spec.fieldNames, function (field) {
			if (self.typeInfo.get(field) == null) {
				self.logError(self.makeLogTag() + ' Ignoring pivot on field "' + field + '" because it doesn\'t exist in the data');
				return false;
			}
			return true;
		});

		// Don't do anything if we're not grouping by any fields.

		if (spec.fieldNames.length === 0) {
			return false;
		}
	}
	*/

	isDifferent = !_.isEqual(self.pivotSpec, spec);

	self.super['View'].setPivot(spec, opts);

	if (isDifferent) {
		// If we've removed the pivot completely, make sure that we also get rid of any horizontal
		// sorting, since that can't be done without pivotting.

		if (self.pivotSpec == null || self.pivotSpec.fieldNames.length === 0) {
			var sortSpec = self.getSort();
			if (sortSpec != null && sortSpec.horizontal != null) {
				delete sortSpec.horizontal;

				// Don't update data when removing the horizontal sort because we're already in the middle
				// of a possibly-data-updating operation.

				self.logWarning(self.makeLogTag('setPivot') + ' Removing horizontal sort configuration since pivot was cleared');
				self.setSort(sortSpec, { updateData: false });
			}
		}

		if (self.prefs != null && opts.savePrefs) {
			self.prefs.save();
		}
	}

	self.clearCache();

	if (!opts.updateData) {
		return true;
	}

	self.getData();

	return true;
};

// #getPivot {{{2

/**
 * Get the pivot configuration.
 *
 * @returns {ComputedView~PivotSpec}
 * The pivot config currently being used by this view.
 */

ComputedView.prototype.getPivot = function () {
	var self = this;

	return self.pivotSpec;
};

// #clearPivot {{{2

/**
 * Reset the pivot config so the data is not pivotted.
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.sendEvent=true]
 * If true, issue an event indicating the pivot config has been changed.
 *
 * @param {Array.<Object>} [opts.dontSendEventTo]
 * Don't send events to these subscribers.
 *
 * @param {boolean} [opts.updateData=true]
 * If true, automatically update data to match new pivot config.
 */

ComputedView.prototype.clearPivot = function (opts) {
	return this.setPivot(null, opts);
};

// #pivot_orig {{{2

ComputedView.prototype.pivot_orig = function () {
	var self = this
		, pivotFields = [] // Array of field names to pivot by.
		, colValsTree // Tree of all possible column value combinations.
		, colVals     // Array of all possible column value combinations.
	;

	// FIXME Allow pivot without group.

	if (!self.data.isGroup) {
		return false;
	}

	// Make sure that pivotting has been asked for.

	if (self.pivotSpec == null) {
		return false;
	}

	// We need `typeInfo` to verify that the pivot fields requested actually exist in the source data.
	// It's not possible to just use the data, because there may be no rows.

	if (self.typeInfo == null) {
		self.logError(self.makeLogTag() + ' Source type information is missing');
		return false;
	}

	// Go through every pivot field and make sure it exists in the source.

	_.each(self.pivotSpec.fieldNames, function (field, fieldIdx) {
		if (!self.typeInfo.isSet(field)) {
			self.logError(self.makeLogTag() + ' Pivot field does not exist in the source: ' + field);
			self.fire('invalidPivotField', null, field);
		}
		else {
			pivotFields.push(field);
		}
	});

	// It's possible now that we've eliminated *all* the pivot fields because they're invalid; if
	// that's the case, we just abort as if no pivotting was requested at all.

	if (pivotFields.length === 0) {
		return false;
	}

	var buildColValsTree = function (pivotFields) {
		var colValsTree = {};

		_.each(self.data.data, function (groupedRows) {
			(function RECUR(fieldNames, data, tree) {
				var field = car(fieldNames)
					, tmp = {};

				_.each(data, function (row) {
					var value = row.rowData[field].orig || row.rowData[field].value;

					if (tree[value] === undefined) {
						tree[value] = fieldNames.length > 1 ? {} : true;
					}

					if (tmp[value] === undefined) {
						tmp[value] = [];
					}

					tmp[value].push(row);
				});

				if (fieldNames.length > 1) {
					_.each(tmp, function (pivottedRows, value) {
						RECUR(cdr(fieldNames), pivottedRows, tree[value]);
					});
				}
			})(pivotFields, groupedRows, colValsTree);
		});

		return colValsTree;
	};

	var buildColVals = function (colValsTree) {
		var colVals = [];

		(function RECUR(tree, level, path) {
			if (level === self.pivotSpec.fieldNames.length) {
				_.each(_.keys(tree).sort(), function (value) {
					colVals.push(path.concat([value]));
				});
			}
			else {
				_.each(tree, function (subtree, value) {
					RECUR(subtree, level + 1, path.concat([value]));
				});
			}
		})(colValsTree, 1, []);

		return colVals;
	};

	var buildData = function (data) {
		var result = [];

		_.each(data, function (groupedRows, groupNum) {
			var newData = [];
			_.each(colVals, function (colVal) {
				var tmp = [];
				_.each(groupedRows, function (row) {
					if (_.every(colVal, function (colValElt, colValNum) {
						var pivotField = pivotFields[colValNum];
						var fti = self.typeInfo.get(pivotField);
						var value = row.rowData[pivotField].value;
						var natRep = types.registry.isSet(fti.type) ?
							types.registry.get(fti.type).natRep(value) :
							getNatRep(value);
						return colValElt === natRep;
					})) {
						tmp.push(row);
					}
				});
				newData.push(tmp);
			});
			result.push(newData);
		});

		return result;
	};

	colValsTree = buildColValsTree(pivotFields);
	colVals = buildColVals(colValsTree);
	self.data.data = buildData(self.data.data, colVals);

	self.logDebug(self.makeLogTag('pivot') + ' Pivot Fields: %O', pivotFields);
	self.logDebug(self.makeLogTag('pivot') + ' Col Vals Tree: %O', colValsTree);
	self.logDebug(self.makeLogTag('pivot') + ' Col Vals: %O', colVals);
	self.logDebug(self.makeLogTag('pivot') + ' New Data: %O', self.data);

	self.data.isPlain = false;
	self.data.isGroup = false;
	self.data.isPivot = true;
	self.data.pivotFields = pivotFields;
	self.data.colVals = colVals;

	return true;
};

// #pivot_new {{{2

ComputedView.prototype.pivot = function () {
	var self = this
		, finalPivotSpec = [] // Array of field names to pivot by.
		, colValsTree // Tree of all possible column value combinations.
		, colVals     // Array of all possible column value combinations.
		, newData
	;

	// FIXME Allow pivot without group.

	if (!self.data.isGroup) {
		return false;
	}

	// Make sure that pivotting has been asked for.

	if (self.pivotSpec == null) {
		return false;
	}

	// We need `typeInfo` to verify that the pivot fields requested actually exist in the source data.
	// It's not possible to just use the data, because there may be no rows.

	if (self.typeInfo == null) {
		self.logError(self.makeLogTag() + ' Source type information is missing');
		return false;
	}

	// Go through every group field and make sure it exists in the source.  If it doesn't, we use an
	// event to notify the user interface about it so a warning can be shown.

	_.each(self.pivotSpec.fieldNames, function (fieldObj) {
		var fti = self.typeInfo.get(fieldObj.field);
		if (fti == null) {
			self.logError(self.makeLogTag() + ' Pivot field does not exist in the source: ' + fieldObj.field);
			self.fire('invalidPivotField', null, fieldObj.field);
		}
		else if (fti.type == null) {
			self.logError(self.makeLogTag() + ' Unable to pivot by field "%s": type is undefined');
		}
		else {
			Source.decodeAll(self.data.dataByRowId, fti.field, self.typeInfo);
			finalPivotSpec.push(fieldObj);
		}
	});

	// It's possible now that we've eliminated *all* the pivot fields because they're invalid; if
	// that's the case, we just abort as if no pivotting was requested at all.

	if (finalPivotSpec.length === 0) {
		return false;
	}

	var origKeys = [];

	// buildColVals {{{3

	var buildColVals = function (addColVals) {
		var colVal
			, pivotFieldIndex
			, pivotSpecElt
			, value
			, natRep
			, groupFun
			, groupIndex
			, group
			, row
			, rowIndex
			, acvIndex
			, colVals = []
			, fti;

		for (groupIndex = 0; groupIndex < self.data.data.length; groupIndex += 1) {
			group = self.data.data[groupIndex];
			for (rowIndex = 0; rowIndex < group.length; rowIndex += 1) {
				row = group[rowIndex];
				colVal = [];
				for (pivotFieldIndex = 0; pivotFieldIndex < finalPivotSpec.length; pivotFieldIndex += 1) {
					pivotSpecElt = finalPivotSpec[pivotFieldIndex];
					fti = self.typeInfo.get(pivotSpecElt.field);
					value = row.rowData[pivotSpecElt.field].value;
					if (pivotSpecElt.fun == null) {
						natRep = types.registry.isSet(fti.type) ?
							types.registry.get(fti.type).natRep(value) :
							getNatRep(value);
						origKeys[pivotFieldIndex][natRep] = value;
					}
					else {
						groupFun = GROUP_FUNCTION_REGISTRY.get(pivotSpecElt.fun);
						natRep = groupFun.applyValueFun(value, self.typeInfo.get(pivotSpecElt.field));
						origKeys[pivotFieldIndex][natRep] = natRep;
					}
					setProp(natRep, row.rowData[pivotSpecElt.field], 'natRep', 'pivot', pivotFieldIndex);
					colVal[pivotFieldIndex] = natRep;
				}
				if (_.findIndex(colVals, function (x) {
					return arrayEqual(colVal, x);
				}) === -1) {
					colVals.push(colVal);
				}
			}
		}

		if (addColVals != null) {
			for (acvIndex = 0; acvIndex < addColVals.length; acvIndex += 1) {
				colVal = addColVals[acvIndex];

				if (colVal.length != finalPivotSpec.length) {
					self.logError(self.makeLogTag() + ' Unable to add colVal %s when pivotting by %s: the lengths must be the same',
						JSON.stringify(colVal), JSON.stringify(finalPivotSpec));
					continue;
				}

				for (pivotFieldIndex = 0; pivotFieldIndex < colVal.length; pivotFieldIndex += 1) {
					pivotSpecElt = finalPivotSpec[pivotFieldIndex];
					fti = self.typeInfo.get(pivotSpecElt.field);
					value = colVal[pivotFieldIndex];
					natRep = types.registry.isSet(fti.type) ?
						types.registry.get(fti.type).natRep(value) :
						getNatRep(value);
					origKeys[pivotFieldIndex][natRep] = value;
					colVal[pivotFieldIndex] = natRep;
				}

				if (_.findIndex(colVals, function (x) {
					return arrayEqual(colVal, x);
				}) === -1) {
					colVals.push(colVal);
				}
			}
		}

		colVals.sort(function (a, b) {
			return arrayCompare(a, b);
		});

		return colVals;

	};

	// buildData {{{3

	var buildData = function (data) {
		var result = [];

		_.each(data, function (groupedRows, groupNum) {
			var newData = [];
			_.each(colVals, function (colVal) {
				var tmp = [];
				_.each(groupedRows, function (row) {
					if (_.every(colVal, function (colValElt, colValIndex) {
						var pivotSpecElt = finalPivotSpec[colValIndex];
						return colValElt === row.rowData[pivotSpecElt.field].natRep.pivot[colValIndex];
					})) {
						tmp.push(row);
					}
				});
				newData.push(tmp);
			});
			result.push(newData);
		});

		return result;
	};

	// convertColVals {{{3

	var convertColVals = function (colVals) {
		var result = [];

		for (var colValIndex = 0; colValIndex < colVals.length; colValIndex += 1) {
			var colVal = colVals[colValIndex];
			result[colValIndex] = [];
			for (var pivotFieldIndex = 0; pivotFieldIndex < finalPivotSpec.length; pivotFieldIndex += 1) {
				result[colValIndex][pivotFieldIndex] = origKeys[pivotFieldIndex][colVal[pivotFieldIndex]];
			}
		}

		return result;
	};

	// }}}3

	for (var pivotFieldIndex = 0; pivotFieldIndex < finalPivotSpec.length; pivotFieldIndex += 1) {
		origKeys[pivotFieldIndex] = {};
	}

	colVals = buildColVals(self.pivotSpec.addColVals);
	newData = buildData(self.data.data, colVals);
	colVals = convertColVals(colVals);

	self.logDebug(self.makeLogTag('pivot') + ' Pivot Spec: %O', finalPivotSpec);
	self.logDebug(self.makeLogTag('pivot') + ' Orig Keys: %O', origKeys);
	self.logDebug(self.makeLogTag('pivot') + ' Col Vals: %O', colVals);
	self.logDebug(self.makeLogTag('pivot') + ' New Data: %O', newData);

	self.data.isPlain = false;
	self.data.isGroup = false;
	self.data.isPivot = true;
	self.data.pivotFields = _.pluck(finalPivotSpec, 'field');
	self.data.pivotSpec = finalPivotSpec;
	self.data.colVals = colVals;
	self.data.data = newData;

	self.logDebug(self.makeLogTag('pivot') + ' Final Data: %O', self.data);

	return true;
};

// #setAggregate {{{2

/**
 * Set the aggregate configuration.
 *
 * @param {ComputedView~AggregateSpecs} spec
 * The aggregate configuration.
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.sendEvent=true]
 * If true, issue an event indicating the pivot config has been changed.
 *
 * @param {Array.<Object>} [opts.dontSendEventTo]
 * Don't send events to these subscribers.
 *
 * @param {boolean} [opts.updateData=true]
 * If true, automatically update data to match new pivot config.
 */

ComputedView.prototype.setAggregate = function (spec, opts) {
	var self = this
		, args = Array.prototype.slice.call(arguments)
		, isDifferent = false;

	var shouldGraph = {
		group: [],
		pivot: []
	};

	if (self.lock.isLocked()) {
		return self.lock.onUnlock(function () {
			self.setAggregate.apply(self, args);
		}, 'Waiting to set aggregate: ' + JSON.stringify(spec));
	}

	opts = deepDefaults(opts, {
		sendEvent: true,
		dontSendEventTo: [],
		updateData: true,
		savePrefs: true
	});

	self.logDebug(self.makeLogTag('setAggregate') + ' spec = %O ; options = %O', spec, opts);

	/*
	if (spec == null || self.aggregateSpec == null) {
		self.aggregateSpec = objFromArray(['group', 'pivot', 'cell', 'all'], [[{
			fun: 'count'
		}]]);
	}
	*/

	isDifferent = !_.isEqual(self.aggregateSpec, spec);

	if (spec == null) {
		self.super['View'].setAggregate(null, opts);
	}
	else {
		// Make sure we have typeInfo so we can perform the next check.

		/*
		if (self.typeInfo == null) {
			return self.getTypeInfo(function () {
				self.setFilter.apply(self, args);
			});
		}
		*/

		// Remove any fields that don't exist in the data (according to typeInfo).

		_.each(spec, function (aggSpec, aggType) {
			aggSpec = _.filter(aggSpec, function(agg) {
				var a = AGGREGATE_REGISTRY.get(agg.fun);
				if (a == null) {
					self.logError(self.makeLogTag() + ' Ignoring aggregate "' + agg.fun + '" because no such aggregate function exists');
					return false;
				}
				/*
				if (a.prototype.fieldCount > 0) {
					if (agg.fields == null) {
						self.logError(self.makeLogTag() + ' Ignoring aggregate "' + agg.fun + '" because no fields have been specified');
						return false;
					}
					if (agg.fields.length < a.prototype.fieldCount) {
						self.logError(self.makeLogTag() + ' Ignoring aggregate "' + agg.fun + '" because there aren\'t enough fields');
						return false;
					}
					for (var i = 0; i < agg.fields.length; i += 1) {
						if (self.typeInfo.get(agg.fields[i]) == null) {
							self.logError(self.makeLogTag() + ' Ignoring aggregate "' + agg.fun + '" because field "' + agg.fields[i] + '" doesn\'t exist in the data');
							return false;
						}
					}
				}
				*/
				return true;
			});

			// Go through all the aggregates for this type (e.g. group or pivot) that should be graphed,
			// adding them to the list. Graphs listening for the `aggregateSet` event can read the list,
			// configuring their renderer to show the specified aggregates.

			if (shouldGraph[aggType] != null) {
				_.each(aggSpec, function (agg, i) {
					if (agg.shouldGraph) {
						shouldGraph[aggType].push({
							aggNum: i,
							aggSpec: agg
						});
					}
				});
			}

			spec[aggType] = aggSpec;
		});

		self.super['View'].setAggregate(deepCopy(spec), opts);
	}

	// if (opts.sendEvent) {
	// 	self.fire('aggregateSet', {
	// 		notTo: opts.dontSendEventTo
	// 	}, spec, shouldGraph);
	// }

	if (isDifferent && self.prefs != null && opts.savePrefs) {
		self.prefs.save();
	}

	self.clearCache();

	if (!opts.updateData) {
		return true;
	}

	self.getData();

	return true;
};

// #getAggregate {{{2

ComputedView.prototype.getAggregate = function () {
	var self = this;

	return self.aggregateSpec;
};

// #clearAggregate {{{2

ComputedView.prototype.clearAggregate = function (opts) {
	var self = this;

	return self.setAggregate(objFromArray(['group', 'pivot', 'cell', 'all'], [[{fun: 'count'}]]), opts);
};

// #aggregate {{{2

ComputedView.prototype.aggregate = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	if (!(self.aggregateSpec && (self.data.isGroup || self.data.isPivot))) {
		return cont(false);
	}

	_.each(['group', 'pivot', 'cell', 'all'], function (what) {
		self.logDebug(self.makeLogTag('aggregate') + ' Computing %s aggregate functions: %s',
			what, _.pluck(getProp(self, 'aggregateSpec', what), 'fun').join(', '));
	});

	// Data structures for storing aggregate function results.

	var groupResults = []; // groupResults[i][n] -> agg over rows w/ rowval[n]
	var pivotResults = []; // pivotResults[i][m] -> agg over columns w/ colval[m]
	var cellResults = []; // cellResults[i][n][m] -> agg over cells w/ rowval[n] -AND- colval[m]
	var allResults = []; // allResults[i] -> agg over all cells

	var info = {
		group: [],
		pivot: [],
		cell: [],
		all: []
	};

	// Initialize the informational data structures.

	_.each(['group', 'pivot', 'cell', 'all'], function (what) {
		_.each(self.aggregateSpec[what], function (spec, aggNum) {
			try {
				info[what][aggNum] = new AggregateInfo(what, spec, aggNum, self.colConfig, self.typeInfo, function (field) {
					Source.decodeAll(self.data.dataByRowId, field, self.typeInfo);
				});
			}
			catch (e) {
				self.logError(self.makeLogTag() + ' Invalid Aggregate: ' + what + '[' + aggNum + '] - ' + e.message);

				// Set the aggregate to null so it can be removed later.
				info[what][aggNum] = null;

				// Let the UI know there was a problem with this aggregate, so the user can fix it or
				// remove the aggregate from the output entirely.
				self.fire('invalidAggregate', null, aggNum, e.message);
			}
		});

		// Strip out any aggregates which resulted in errors earlier.
		info[what] = _.without(info[what], null);
	});

	_.each(self.data.rowVals, function (rowVal, rowValIdx) {
		_.each(info.group, function (aggInfo, aggNum) {
			if (groupResults[aggNum] === undefined) {
				groupResults[aggNum] = [];
			}
			var aggResult = aggInfo.instance.calculate(_.flatten(self.data.data[rowValIdx]));
			groupResults[aggNum][rowValIdx] = aggResult;
			if (aggInfo.debug) {
				self.logDebug(self.makeLogTag('aggregate') + ' Group aggregate [%d] (%s) : Group [%s] = %s',
					aggNum,
					info.group[aggNum].instance.name + (info.group[aggNum].name ? ' -> ' + info.group[aggNum].name : ''),
					rowVal.join(', '),
					isElement(aggResult) ? getElement(aggResult).innerText : JSON.stringify(aggResult));
			}
		});

		if (self.data.isPivot) {
			_.each(info.cell, function (aggInfo, aggNum) {
				if (cellResults[aggNum] === undefined) {
					cellResults[aggNum] = [];
				}
				cellResults[aggNum][rowValIdx] = [];

				_.each(self.data.colVals, function (colVal, colValIdx) {
					var aggResult = aggInfo.instance.calculate(self.data.data[rowValIdx][colValIdx]);
					cellResults[aggNum][rowValIdx][colValIdx] = aggResult;
					if (aggInfo.debug) {
						self.logDebug(self.makeLogTag('aggregate') + ' Cell aggregate [%d] (%s) : Cell [%s ; %s] = %s',
							aggNum,
							info.cell[aggNum].instance.name + (info.cell[aggNum].name ? ' -> ' + info.cell[aggNum].name : ''),
							rowVal.join(', '),
							colVal.join(', '),
							isElement(aggResult) ? getElement(aggResult).innerText : JSON.stringify(aggResult));
					}
				});
			});
		}
	});

	if (self.data.isPivot && info.pivot) {
		_.each(info.pivot, function (aggInfo, aggNum) {
			pivotResults[aggNum] = [];

			_.each(self.data.colVals, function (colVal, colValIdx) {
				var aggResult = aggInfo.instance.calculate(_.flatten(_.pluck(self.data.data, colValIdx)));
				pivotResults[aggNum][colValIdx] = aggResult;
				if (aggInfo.debug) {
					self.logDebug(self.makeLogTag('aggregate') + ' Pivot aggregate [%d] (%s) : Col Val [%s] = %s',
						aggNum,
						info.pivot[aggNum].instance.name + (info.pivot[aggNum].name ? ' -> ' + info.pivot[aggNum].name : ''),
						colVal.join(', '),
						isElement(aggResult) ? getElement(aggResult).innerText : JSON.stringify(aggResult));
				}
			});
		});
	}

	if (info.all && (self.data.isGroup || self.data.isPivot)) {
		_.each(info.all, function (aggInfo, aggNum) {
			var aggResult = aggInfo.instance.calculate(_.flatten(self.data.data));
			allResults[aggNum] = aggResult;
			if (aggInfo.debug) {
				self.logDebug(self.makeLogTag('aggregate') + ' All aggregate [%d] (%s) = %s',
					aggNum,
					info.all[aggNum].instance.name + (info.all[aggNum].name ? ' -> ' + info.all[aggNum].name : ''),
					JSON.stringify(aggResult));
			}
		});
	}

	self.data.agg = {
		info: info,
		results: {
			group: groupResults,
			pivot: pivotResults,
			cell: cellResults,
			all: allResults
		}
	};

	cont(true);
};

// #getData {{{2

/**
 * Retrieves a fresh copy of the data for this view from the data source.
 *
 * @param {function} cont What to do next.
 *
 * @param {string} reason
 * Why are you calling this function?  (Used to save debugging information for onUnlock handlers.)
 */

ComputedView.prototype.getData = function (cont, reason) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	var lockMsg;

	if (self.lock.isLocked()) {
		lockMsg = 'Waiting to get data';
		if (reason != null) {
			lockMsg += ': ' + reason;
		}
		return self.lock.onUnlock(function () {
			self.getData(cont);
		}, lockMsg);
	}
	else {
		lockMsg = 'Getting data';
		if (reason != null) {
			lockMsg += ': ' + reason;
		}
		self.logDebug(lockMsg);
	}

	if (self.data !== undefined) {
		self.logDebug(self.makeLogTag() + ' Got cached data: %O', self.data);
		if (typeof cont === 'function') {
			return cont(true, self.data);
		}
	}

	var fail = function () {
		self.lock.unlock();
		return cont(false);
	};

	self.lock.lock();

	return self.source.getData(function (ok, data) {
		if (!ok) {
			return fail();
		}

		return self.getTypeInfo(function (ok, typeInfo) {
			if (!ok) {
				return fail();
			}

			self.fire('workBegin');

			var ops = {
				filter: false,
				group: false,
				pivot: false,
				sort: false
			};

			self.data = {
				isPlain: true,
				isGroup: false,
				isPivot: false,
				data: [],
				dataByRowId: []
			};

			_.each(data, function (rowData, rowNum) {
				self.data.data.push({
					rowNum: rowNum,
					rowData: rowData
				});
				self.data.dataByRowId[rowNum] = rowData;
			});

			return self.filter(function (didFilter, filteredData) {
				ops.filter = didFilter;
				if (didFilter) {
					self.data.data = filteredData;
				}
				ops.group = self.group();
				ops.pivot = self.pivot();
				return self.aggregate(function () {
					return self.sort(function (didSort) {
						ops.sort = didSort;

						var workEndObj = {
							isPlain: self.data.isPlain,
							isGroup: self.data.isGroup,
							isPivot: self.data.isPivot
						};

						workEndObj.numRows = self.getRowCount();
						if (self.isFiltered()) {
							workEndObj.totalRows = self.getTotalRowCount();
						}

						if (self.data.isGroup) {
							workEndObj.numGroups = self.data.rowVals.length;
						}

						if (self.data.isPivot) {
							workEndObj.numGroups = self.data.rowVals.length;
							workEndObj.numPivots = self.data.colVals.length;
						}

						// FIXME Why does this need to save prefs?  They should be saved when the configuration
						// changes, not when we retrieve data.
						//
						// if (self.prefs != null) {
						// 	self.prefs.save();
						// }

						self.lastOps = ops;
						self.fire('workEnd', null, workEndObj, ops);

						self.lock.unlock();
						self.logDebug(self.makeLogTag() + ' Got new data: %O', self.data);
						if (typeof cont === 'function') {
							return cont(true, self.data);
						}
					}); // -- self.sort()
				}); // -- self.aggregate()
			}); // -- self.filter()
		}); // -- self.getTypeInfo()
	}); // -- self.getData()
};

// #getTypeInfo {{{2

/**
 *
 */

ComputedView.prototype.getTypeInfo = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	if (self.typeInfo != null) {
		return cont(true, self.typeInfo);
	}

	return self.source.getTypeInfo(function (ok, typeInfo) {
		if (!ok) {
			return cont(false);
		}

		self.typeInfo = typeInfo;
		self.fire('getTypeInfo', null, self.typeInfo, self.colConfig);
		return cont(true, self.typeInfo);
	});
};

// #clearCache {{{2

ComputedView.prototype.clearCache = function () {
	var self = this;

	self.data = undefined;
	self.typeInfo = undefined;

	self.logDebug(self.makeLogTag() + ' Cleared cache');
};

// #clearSourceData {{{2

ComputedView.prototype.clearSourceData = function () {
	var self = this;

	if (self.source instanceof Source) {
		self.source.clearCachedData();
	}
	else if (self.source instanceof ComputedView) {
		self.source.clearSourceData();
	}

	self.logDebug(self.makeLogTag() + ' Cleared source data');
};

// #refresh {{{2

ComputedView.prototype.refresh = function () {
	var self = this;

	self.logDebug(self.makeLogTag() + ' Refreshing...');
	self.source.refresh();
};

// #reset {{{2

/**
 * Reset the view to reflect the data with no transformations.  This calls all the individual
 * "clear" functions, but doesn't notify consumers that there's been work done until the end.
 */

ComputedView.prototype.reset = function (opts) {
	var self = this;

	opts = deepDefaults(opts, {
		sendEvent: true,
		dontSendEventTo: [],
		updateData: true,
		savePrefs: true
	});

	var clearOpts = jQuery.extend({}, opts, {
		updateData: false
	});

	self.logDebug(self.makeLogTag() + ' RESET!');

	self.clearSort(clearOpts);
	self.clearFilter(clearOpts);
	self.clearAggregate(clearOpts);
	self.clearPivot(clearOpts);
	self.clearGroup(clearOpts);

	if (!opts.updateData) {
		delete self.lastOps;
		return;
	}

	self.getData();
};

// #getUniqueVals {{{2

ComputedView.prototype.getUniqueVals = function (cont) {
	var self = this;

	return self.source.getUniqueVals(cont);
};

// #getLastOps {{{2

ComputedView.prototype.getLastOps = function () {
	var self = this;

	return self.lastOps;
};

// #setColConfig {{{2

/**
 * Set the column config on the view.  In particular here, we need access to how the user wants the
 * data to be formatted.  You'd think that the view shouldn't have to know anything about the
 * display of the data, and ideally you'd be right.  However, the view runs aggregate functions such
 * as "group concat" which *do* need to know how values should be formatted.
 *
 * @param {OrdMap} colConfig
 * The column configuration.
 */

ComputedView.prototype.setColConfig = function (colConfig) {
	var self = this;

	if (!(colConfig instanceof OrdMap)) {
		throw new Error('Call Error: `colConfig` must be an instance of OrdMap');
	}

	self.logDebug(self.makeLogTag() + ' Setting column configuration');

	self.colConfig = colConfig;
};

// Exports {{{1

export {
	ComputedView
};
