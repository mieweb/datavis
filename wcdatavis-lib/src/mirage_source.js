// Imports {{{1

import _ from 'underscore';
import {
	arrayEqual,
	copyProps,
	deepDefaults,
	getProp,
	I,
	interleaveWith,
	makeSubclass,
	mixinLogging,
	setProp,
} from './util/misc';
import {AggregateInfo} from './aggregates.js';
import {View} from './view.js';
import {Source} from './source.js';
import {Prefs} from './prefs.js';
import OrdMap from './util/ordmap';

// MirageSource {{{1

// Constructor {{{2

/**
 * Creates a source of data used by the {@link MirageView}.
 *
 * @param {string} name
 * The name to use for the source.
 *
 * @param {Object} opts
 * Configuration of the source.
 *
 * @param {Object} opts.backend
 * Configuration of the source backend (i.e. how to access the mirage data).
 *
 * @param {string} opts.backend.type
 * What type of backend to use.  Must be a key in the {@linkcode MIRAGE_BACKEND_REGISTRY} {@link OrdMap}.
 *
 * @class
 *
 * @property {string} name
 * The name of the source.
 *
 * @property {MirageBackend} backend
 * The backend to use to retrieve mirage data.
 */

var MirageSource = makeSubclass('MirageSource', Object, function (opts) {
	var self = this;

	opts = deepDefaults(opts, {
		backend: {
			type: 'IndexedDB',
			dbName: 'datavis_mirage',
		}
	});

	if (!MIRAGE_BACKEND_REGISTRY.isSet(opts.backend.type)) {
		throw new Error('Call Error: requested backend type "' + opts.backend.type + '" does not exist');
	}

	// Create a backend to store the mirage data.

	var cls = MIRAGE_BACKEND_REGISTRY.get(opts.backend.type);
	self.backend = new cls(opts.backend);
});

mixinLogging(MirageSource);

// #initFromView {{{2

MirageSource.prototype.initFromView = function (prefs, view, source) {
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

	self.prefsName = prefs.name;
	self.perspectiveName = prefs.currentPerspective.name;

	self.viewConfig = {
		filterSpec: view.getFilter(),
		groupSpec: view.getGroup(),
		pivotSpec: view.getPivot(),
		aggregateSpec: view.getAggregate(),
	};

	// Copy configuration from the original source.

	self.sourceType = source.type;
	self.sourceName = source.getName();
	self.sourceParams = source.createParams();
};

// #initFromPrefs {{{2

/**
 * Used to initialize this source from prefs.  Since no view or source configuration is supplied,
 * you must load that existing config from the mirage backend before you can store to it again.
 */

MirageSource.prototype.initFromPrefs = function (prefs) {
	var self = this;

	if (!(prefs instanceof Prefs)) {
		throw new Error('Call Error: `prefs` must be an instance of Prefs');
	}

	self.prefsName = prefs.name;
	self.perspectiveName = prefs.currentPerspective.name;
};

// #setPerspectiveName {{{2

MirageSource.prototype.setPerspectiveName = function (perspectiveName) {
	var self = this;

	self.perspectiveName = perspectiveName;
};

// #toString {{{2

MirageSource.prototype.toString = function () {
	var self = this;

	return 'MIRAGE SOURCE {prefsName="' + self.prefsName + '", perspectiveName="' + self.perspectiveName + '"}';
};

// #save {{{2

/**
 * Push the mirage data to the storage location.
 */

MirageSource.prototype.save = function (data, typeInfo, ok, fail) {
	var self = this;

	if (data.isPlain) {
		throw new Error('Cannot store mirage data for plain data.');
	}

	self.logDebug(self.makeLogTag('save') + ' Processing view data to store in backend');

	var aggRes = [];

	// Cell Aggregates {{{3

	if (data.isPivot) {
		for (var aggNum = 0; aggNum < data.agg.info.cell.length; aggNum += 1) {
			for (var rvi = 0; rvi < data.rowVals.length; rvi += 1) {
				for (var cvi = 0; cvi < data.colVals.length; cvi += 1) {
					if (data.data[rvi][cvi].length > 0) {
						aggRes.push({
							aggType: 'cell',
							aggNum: aggNum,
							coordinates: [].concat(data.rowVals[rvi], data.colVals[cvi]),
							result: data.agg.results.cell[aggNum][rvi][cvi]
						});
					}
				}
			}
		}
	}

	// Group Aggregates {{{3

	for (var aggNum = 0; aggNum < data.agg.info.group.length; aggNum += 1) {
		for (var rvi = 0; rvi < data.rowVals.length; rvi += 1) {
			aggRes.push({
				aggType: 'group',
				aggNum: aggNum,
				coordinates: data.rowVals[rvi],
				result: data.agg.results.group[aggNum][rvi]
			});
		}
	}

	// Pivot Aggregates {{{3

	if (data.isPivot) {
		for (var aggNum = 0; aggNum < data.agg.info.pivot.length; aggNum += 1) {
			for (var cvi = 0; cvi < data.colVals.length; cvi += 1) {
				aggRes.push({
					aggType: 'pivot',
					aggNum: aggNum,
					coordinates: data.colVals[cvi],
					result: data.agg.results.pivot[aggNum][cvi]
				});
			}
		}
	}

	// All Aggregates {{{3

	for (var aggNum = 0; aggNum < data.agg.info.all.length; aggNum += 1) {
		aggRes.push({
			aggType: 'all',
			aggNum: aggNum,
			coordinates: [],
			result: data.agg.results.all[aggNum]
		});
	}

	// }}}3

	var metadata = {
		prefsName: self.prefsName,
		perspectiveName: self.perspectiveName,
		sourceType: self.sourceType,
		sourceName: self.sourceName,
		sourceParams: self.sourceParams,
		typeInfo: typeInfo.serialize(),
		filterSpec: self.viewConfig.filterSpec,
		groupSpec: self.viewConfig.groupSpec,
		pivotSpec: self.viewConfig.pivotSpec,
		aggregateSpec: self.viewConfig.aggregateSpec,
	};

	self.logDebug(self.makeLogTag('save') + ' Sending processed data to backend: {metadata=%O, aggRes=%O}', metadata, aggRes);

	self.backend.save(metadata, aggRes, ok, fail);
};

// #load {{{2

/**
 * Pull the mirage data from the storage location.
 */

MirageSource.prototype.load = function (ok, fail) {
	var self = this;

	// FIXME: This function is also responsible for converting the backend data format into the View's
	// data format.  This functionality may/should move into the backend class since each backend will
	// be different (i.e. AJAX request to web service using MySQL vs. IndexedDB).

	var data = {
		groupFields: [],
		pivotFields: [],
		rowVals: [],
		colVals: [],
		agg: {
			results: {
				cell: [],
				group: [],
				pivot: [],
				all: []
			},
			info: {
				cell: [],
				group: [],
				pivot: [],
				all: []
			}
		},
		data: [],
		groupMetadata: {
			lookup: {
				byRowValIndex: [],
				byId: []
			}
		}
	};

	return self.backend.load(self.prefsName, self.perspectiveName, function (metadata, aggRes) {
		var sourceConfig = {};
		var viewConfig = {};

		// Copy configuration for the source & view from the stored metadata.

		copyProps(metadata, sourceConfig, ['sourceType', 'sourceName', 'sourceParams']);
		copyProps(metadata, viewConfig, ['filterSpec', 'groupSpec', 'pivotSpec', 'aggregateSpec']);

		if (metadata.groupSpec != null) {
			data.groupSpec = metadata.groupSpec.fieldNames;
			data.groupFields = _.pluck(data.groupSpec, 'field');
		}

		if (metadata.pivotSpec != null) {
			data.pivotSpec = metadata.pivotSpec.fieldNames;
			data.pivotFields = _.pluck(data.pivotSpec, 'field');
		}

		_.each(aggRes, function (ar) {
			var rv = null
				, cv = null
				, rvi = null
				, cvi = null;

			// Determine the rowval and rowval index.

			switch (ar.aggType) {
			case 'cell':
				rv = ar.coordinates.slice(0, data.groupFields.length);
				cv = ar.coordinates.slice(data.groupFields.length);
				break;
			case 'group':
				rv = ar.coordinates;
				break;
			case 'pivot':
				cv = ar.coordinates;
				break;
			}

			if (rv != null) {
				rvi = _.findIndex(data.rowVals, function (x) { return arrayEqual(x, rv); });
			}
			if (cv != null) {
				cvi = _.findIndex(data.colVals, function (x) { return arrayEqual(x, cv); });
			}

			// Create rowval entry and group metadata data for the new rowval, if this is an aggregate
			// result for something that corresponds to a colval.

			if (rvi != null && rvi < 0) {
				rvi = data.rowVals.length;
				data.rowVals.push(rv);
				var metadataLeaf = {
					rowValIndex: rvi,
					rowValElt: rv[rv.length - 1]
				};
				setProp(metadataLeaf, data.groupMetadata, 'children', interleaveWith(rv, 'children'));
				data.groupMetadata.lookup.byRowValIndex[rvi] = metadataLeaf;
			}

			// Create colval entry for the new colval, if this is an aggregate result for something that
			// corresponds to a colval.

			if (cvi != null && cvi < 0) {
				cvi = data.colVals.length;
				data.colVals.push(cv);
			}

			// Store the aggregate result at the appropriate place in the data structure.

			switch (ar.aggType) {
			case 'cell':
				setProp(ar.result, data.agg.results.cell, ar.aggNum, rvi, cvi);
				break;
			case 'group':
				setProp(ar.result, data.agg.results.group, ar.aggNum, rvi);
				break;
			case 'pivot':
				setProp(ar.result, data.agg.results.pivot, ar.aggNum, cvi);
				break;
			case 'all':
				setProp(ar.result, data.agg.results.all, ar.aggNum);
				break;
			}

			// Make an AggregateInfo instance for this aggregate function.

			if (data.agg.info[ar.aggType][ar.aggNum] == null) {
				var ai = new AggregateInfo(ar.aggType, metadata.aggregateSpec[ar.aggType][ar.aggNum], ar.aggNum, null, null, null);

				setProp(ai, data.agg.info[ar.aggType], ar.aggNum);
			}
		});

		// We're not actually storing the rows, so shove an empty array in there.  Also initialize the
		// aggregate results with bottom values if they weren't already set to something.  We need to do
		// this because the data stored on the backend is sparse, but we need it fully populated.

		for (var rvi = 0; rvi < data.rowVals.length; rvi += 1) {
			data.data[rvi] = [];
			for (var cvi = 0; cvi < data.colVals.length; cvi += 1) {
				data.data[rvi][cvi] = [];

				for (var aggNum = 0; aggNum < metadata.aggregateSpec.cell.length; aggNum += 1) {
					if (data.agg.results.cell[aggNum][rvi][cvi] === undefined) {
						data.agg.results.cell[aggNum][rvi][cvi] = data.agg.info.cell[aggNum].instance.bottomValue;
					}
				}
			}
		}

		// Set bottom values for missing group aggregate results.

		for (var rvi = 0; rvi < data.rowVals.length; rvi += 1) {
			for (var aggNum = 0; aggNum < metadata.aggregateSpec.group.length; aggNum += 1) {
				if (data.agg.results.group[aggNum][rvi] === undefined) {
					data.agg.results.group[aggNum][rvi] = data.agg.info.group[aggNum].instance.bottomValue;
				}
			}
		}

		// Set bottom values for missing pivot aggregate results.

		for (var cvi = 0; cvi < data.colVals.length; cvi += 1) {
			for (var aggNum = 0; aggNum < metadata.aggregateSpec.pivot.length; aggNum += 1) {
				if (data.agg.results.pivot[aggNum][cvi] === undefined) {
					data.agg.results.pivot[aggNum][cvi] = data.agg.info.pivot[aggNum].instance.bottomValue;
				}
			}
		}

		// Set bottom values for missing all aggregate results.

		for (var aggNum = 0; aggNum < metadata.aggregateSpec.all.length; aggNum += 1) {
			if (data.agg.results.all[aggNum] === undefined) {
				data.agg.results.all[aggNum] = data.agg.info.all[aggNum].instance.bottomValue;
			}
		}

		var metadataId = 0;
		var postorder = function (node, depth) {
			node.id = metadataId++;
			node.numRows = 0;

			data.groupMetadata.lookup.byId[node.id] = node;

			// NOTE When there are no rows in the data, the root of the tree has no children, but also no
			// rows (because it's not a rowVal leaf).  This case is handled by setting numRows = 0 above.

			if (node.children == null) {
				node.rows = [];
			}
			else {
				node.numChildren = _.keys(node.children).length;
				node.rows = [];
				_.each(node.children, function (child) {
					child.parent = node;
					postorder(child, depth + 1);
					node.numRows += child.numRows;
					node.rows = node.rows.concat(child.rows);
				});
				if (depth > 0) {
					node.rowValIndex = node.children[_.keys(node.children)[0]].rowValIndex;
					node.rowValElt = data.rowVals[node.rowValIndex][depth - 1];
				}
			}

			if (depth > 0) {
				node.groupFieldIndex = depth - 1;
				node.groupField = data.groupSpec[node.groupFieldIndex].field;
				node.groupSpec = data.groupSpec[node.groupFieldIndex];
				if (node.rows != null && node.rows.length > 0) {
					node.rowValCell = node.rows[0].rowData[node.groupField];
				}
			}
		};

		postorder(data.groupMetadata, 0);

		// Set the `is(Plain|Group|Pivot)` properties correctly.

		if (data.colVals.length > 0) {
			_.extend(data, { isPlain: false, isGroup: false, isPivot: true });
		}
		else if (data.rowVals.length > 0) {
			_.extend(data, { isPlain: false, isGroup: true, isPivot: false });
		}
		else {
			_.extend(data, { isPlain: true, isGroup: false, isPivot: false });
		}

		return ok(OrdMap.deserialize(metadata.typeInfo), data, viewConfig, sourceConfig);
	}, fail);
};

// MirageBackend {{{1

// Constructor {{{2

/**
 * Abstract base class for custom mirage data backends.
 *
 * @param {Object} opts
 * Configuration of the backend.
 *
 * @class
 */

var MirageBackend = makeSubclass('MirageBackend', Object, function (opts) {
	// DO NOTHING
});

// #save {{{2

/**
 * Push the mirage data to the storage location.
 */

MirageBackend.prototype.save = function (/* TBD */ cont) {
	throw new Error('Abstract Method Error: this method must be implemented by a concrete derived class');
};

// #load {{{2

/**
 * Pull the mirage data from the storage location.
 */

MirageBackend.prototype.load = function (cont) {
	throw new Error('Abstract Method Error: this method must be implemented by a concrete derived class');
};

// MirageBackend_IndexedDB {{{1

// Constructor {{{2

var MirageBackend_IndexedDB = makeSubclass('MirageBackend_IndexedDB', MirageBackend, function (opts) {
	var self = this;

	if (!_.isString(opts.dbName)) {
		throw new Error('Call Error: `opts.dbName` must be a string');
	}

	self.dbName = opts.dbName;

	if (!window.indexedDB) {
		throw new Error('Browser does not support indexedDB');
	}
}, {
	DB_CURRENT_VERSION: 1
});

mixinLogging(MirageBackend_IndexedDB);

// #toString {{{2

MirageBackend_IndexedDB.prototype.toString = function () {
	var self = this;

	return 'MIRAGE BACKEND // INDEXEDDB {dbName="' + self.dbName + '"}';
};

// #open {{{2

MirageBackend_IndexedDB.prototype.open = function (ok, fail) {
	var self = this;

	if (self.db != null) {
		return ok();
	}

	var request = window.indexedDB.open(self.dbName, self.DB_CURRENT_VERSION);

	request.onupgradeneeded = function (evt) {
		self.logInfo(self.makeLogTag('open') + ' Upgrading database from version ' + evt.target.version + ' to ' + self.DB_CURRENT_VERSION + '...');
		self.db = evt.target.result;

		// metadata
		//
		// Stores metadata about the mirage data.  Mostly used to make sure that something hasn't
		// changed behind the scenes that would invalidate the mirage data.  Also used to re-integrate
		// new data by changing the filters.  This is futuristic magick that doesn't exist yet, but we
		// have to design or it now.
		//
		//   | field           | type       | description                 |
		//   +-----------------+------------+-----------------------------+
		//   | metadataId      | int (auto) | auto-generated ID           |
		//   | prefsName       | string     | name of prefs               |
		//   | perspectiveName | string     | name of perspective         |
		//   | sourceType      | string     | what type of source is used |
		//   | sourceName      | string     | e.g. report name            |
		//   | sourceParams    | object     | data sent to the source     |
		//   | filterSpec      | object     | configuration from the view |
		//   | groupSpec       | [object]   | configuration from the view |
		//   | pivotSpec       | [object]   | configuration from the view |
		//   | aggregateSpec   | [object]   | configuration from the view |
		//
		// aggResult
		//
		// Stores the actual mirage data: a collection of results of aggregate functions over a fixed
		// set of data.  The metadata tables tells us what that fixed data set is (i.e. a specific
		// report with a specific set of inputs), and this table tells us what groups there are, and
		// what the pre-computed aggregate results are for each.
		//
		//   | field       | type       | description                                 |
		//   +-------------+------------+---------------------------------------------+
		//   | aggResultId | int (auto) | auto-generated ID                           |
		//   | metadataId  | int (fk)   | ties to the metadata ID                     |
		//   | coordinates | [string]   | rowvals + colvals, in order                 |
		//   | aggType     | string     | the aggregate type: cell, group, pivot, all |
		//   | aggNum      | int        | corresponds to index from aggregateSpec     |
		//   | result      | any        | result of aggregate function                |

		var metadata = self.db.createObjectStore('metadata', { keyPath: 'metadataId', autoIncrement: true });
		metadata.createIndex('primary', ['prefsName', 'perspectiveName'], { unique: true });

		var aggResult = self.db.createObjectStore('aggResult', { keyPath: 'aggResultId', autoIncrement: true });
		aggResult.createIndex('primary', ['metadataId', 'coordinates', 'aggType', 'aggNum'], { unique: true });
		aggResult.createIndex('metadata', ['metadataId'], { unique: false });
	};

	request.onsuccess = function (evt) {
		self.db = evt.target.result;
		return ok();
	};

	request.onerror = fail;
};

// #close {{{2

/**
 * Close the database.  To be honest, I'm not sure when it's a good idea to do this.
 */

MirageBackend_IndexedDB.prototype.close = function () {
	var self = this;

	self.db.close();
	delete self.db;
};

// #save {{{2

MirageBackend_IndexedDB.prototype.save = function (metadata, aggResult, ok, fail) {
	var self = this;

	self.open(function () {
		var txn = self.db.transaction(['metadata', 'aggResult'], 'readwrite');

		txn.oncomplete = function (evt) {
			self.logInfo(self.makeLogTag('save') + ' Successfully stored all mirage data.');
			return ok();
		};

		txn.onerror = function (evt) {
			return fail(evt.target.error.message);
		};

		var mdStore = txn.objectStore('metadata');
		var arStore = txn.objectStore('aggResult');

		var req;

		req = mdStore.add(metadata);
		req.onsuccess = function (evt) {
			_.each(aggResult, function (ar) {
				ar.metadataId = evt.target.result;
				var req = arStore.add(ar);

				req.onerror = function (evt) {
					self.logError(self.makeLogTag('save') + ' Failed to add aggregate results: %O', ar);
					return fail(evt.target.error.message);
				};
			});
		};

		req.onerror = function (evt) {
			self.logError(self.makeLogTag('save') + ' Failed to add metadata: %O', metadata);
			return fail(evt.target.error.message);
		};
	}, function (evt) {
		self.logError(self.makeLogTag('save') + ' Failed to open database.');
		return fail(evt.target.error.message);
	});
};

// #load {{{2

MirageBackend_IndexedDB.prototype.load = function (prefsName, perspectiveName, ok, fail) {
	var self = this;

	self.open(function () {
		var txn = self.db.transaction(['metadata', 'aggResult'], 'readonly');

		txn.oncomplete = function (evt) {
			self.logInfo(self.makeLogTag('save') + ' Successfully loaded all mirage data.');
		};

		txn.onerror = function (evt) {
			return fail(evt.target.error.message);
		};

		var mdStore = txn.objectStore('metadata');
		var arStore = txn.objectStore('aggResult');

		var mdIndex = mdStore.index('primary');
		var arIndex = arStore.index('metadata');

		var req;

		req = mdIndex.get([prefsName, perspectiveName]);

		// Successfully got matching metadata row.

		req.onsuccess = function (evt) {
			var metadata = evt.target.result;

			if (metadata == null) {
				return fail('Mirage metadata for {prefs = "' + prefsName + '", perspective = "' + perspectiveName + '"} does not exist');
			}

			var req = arIndex.getAll([metadata.metadataId]);

			// Successfully got all agg result data.

			req.onsuccess = function (evt) {
				var aggRes = evt.target.result;

				if (aggRes == null) {
					return fail('Mirage aggregate results for {prefs = "' + prefsName + '", perspective = "' + perspectiveName + '", metadataId = ' + metadata.metadataId + '} do not exist');
				}

				return ok(metadata, aggRes);
			};

			// Error getting agg result data.

			req.onerror = function (evt) {
				self.logError(self.makeLogTag('save') + ' Failed to retrieve aggregate results.');
				return fail(evt.target.error.message);
			};
		};

		// Error getting metadata row.

		req.onerror = function (evt) {
			self.logError(self.makeLogTag('save') + ' Failed to retrieve metadata.');
			return fail(evt.target.error.message);
		};
	}, function (evt) {
		self.logError(self.makeLogTag('save') + ' Failed to open database.');
		return fail(evt.target.error.message);
	});
};

// MIRAGE_BACKEND_REGISTRY {{{1

var MIRAGE_BACKEND_REGISTRY = new OrdMap();

MIRAGE_BACKEND_REGISTRY.set('IndexedDB', MirageBackend_IndexedDB);

// Exports {{{1

export {
	MirageSource,
	MIRAGE_BACKEND_REGISTRY
};
