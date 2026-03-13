// Imports {{{1

import _ from 'underscore';
import Papa from 'papaparse';

import jQuery from 'jquery';

import {
	deepCopy,
	deepDefaults,
	getComparisonFn,
	getParamsFromUrl,
	getProp,
	logAsync,
	makeSubclass,
	mixinEventHandling,
	mixinLogging,
	mixinNameSetting,
	stringValueType,
} from './util/misc.js';

import OrdMap from './util/ordmap.js';
import Lock from './util/lock.js';
import types from './types.js';

// SourceError {{{1

var SourceError = makeSubclass('SourceError', Error, function (msg) {
	this.message = msg;
});

// LocalSource {{{1
// Constructor {{{2

var LocalSource = makeSubclass('LocalSource', Object, function (spec) {
	var self = this;

	self.varName = spec.varName;

	/*
	if (self.cache == null) {
		throw new InvalidSourceError('Local variable "' + self.varName + '" does not exist.');
	}

	if (!_.isArray(self.cache.data)) {
		throw new InvalidSourceError(self.varName + '.data is not an array.');
	}

	if (self.cache.typeInfo == null) {
		self.warning('No type information found in local data (' + self.varName + '.typeInfo is missing).');
	}
	*/

	self._copyData();
});

mixinLogging(LocalSource);

// #_copyData {{{2

LocalSource.prototype._copyData = function () {
	var self = this;

	self.cache = {
		data: deepCopy(window[self.varName].data),
		typeInfo: new OrdMap()
	};

	if (_.isArray(window[self.varName].typeInfo)) {
		_.each(window[self.varName].typeInfo, function (fti) {
			self.cache.typeInfo.set(fti.field, fti);
		});
	}
	else {
		_.each(window[self.varName].typeInfo, function (fti, field) {
			fti.field = field;
			self.cache.typeInfo.set(field, fti);
		});
	}
};

// #getData {{{2

LocalSource.prototype.getData = function (params, cont) {
	var self = this;

	self._copyData();
	return cont(true, self.cache.data);
};

// #getTypeInfo {{{2

LocalSource.prototype.getTypeInfo = function (cont) {
	var self = this;

	return cont(true, self.cache.typeInfo);
};

// #clearCachedData {{{2

LocalSource.prototype.clearCachedData = function () {
	var self = this;

	self.cache = null;
};

// #getName {{{2

LocalSource.prototype.getName = function () {
	var self = this;

	return self.varName;
};

// HttpSource {{{1
// Constructor {{{2

var HttpSource = makeSubclass('HttpSource', Object, function (spec, userTypeInfo) {
	var self = this;

	self.url = spec.url;
	self.method = spec.method || 'GET';
	self.dataType = spec.dataType;
	self.autoLimit = deepDefaults(spec.autoLimit, {
		enabled: false,
		maxRecords: 10000,
		cgiParam: 'limit'
	});

	self.cache = null;
	self.userTypeInfo = userTypeInfo;
});

mixinLogging(HttpSource);

// #parseData {{{2

HttpSource.prototype.parseData = function (data) {
	var self = this
		, result = {
			data: [],
			typeInfo: new OrdMap()
		};

	//debug.info('DATA SOURCE // HTTP // PARSER', 'Data = ' + ((data instanceof XMLDocument) ? '%o' : '%O'), data);

	if (data instanceof Document) {
		var root = jQuery(data).children('root');
		if (!root.is('root')) {
			throw new SourceError('HTTP Data Source / XML Parser / Missing (root) element');
		}

		data = root.children('data');
		if (data.length === 0) {
			throw new SourceError('HTTP Data Source / XML Parser / Missing (root > data) element');
		}
		else if (data.length > 1) {
			throw new SourceError('HTTP Data Source / XML Parser / Too many (root > data) elements');
		}

		data.children('item').each(function (_itemIndex, item) {
			item = jQuery(item);
			var row = {};
			item.children().each(function (_fieldIndex, field) {
				field = jQuery(field);
				row[field.prop('tagName')] = field.text();
			});
			result.data.push(row);
		});

		var typeInfo = root.children('typeInfo');
		if (typeInfo.length === 0) {
			throw new SourceError('HTTP Data Source / XML Parser / Missing (root > typeInfo) element');
		}
		else if (typeInfo.length > 1) {
			throw new SourceError('HTTP Data Source / XML Parser / Too many (root > typeInfo) elements');
		}

		typeInfo.children().each(function (_fieldIndex, field) {
			field = jQuery(field);
			var fieldName = field.prop('tagName');
			result.typeInfo.set(fieldName, {});
			if (field.children().length === 0) {
				result.typeInfo.get(fieldName).type = field.text();
			}
			else {
				var type = field.children('type');
				if (type.length === 0) {
					throw new SourceError('HTTP Data Source / XML Parser / Missing (root > typeInfo > ' + fieldName + ' > type) element');
				}
				else if (type.length > 1) {
					throw new SourceError('HTTP Data Source / XML Parser / Too many (root > typeInfo > ' + fieldName + ' > type) elements');
				}
				else if (type.children().length > 0) {
					throw new SourceError('HTTP Data Source / XML Parser / (root > typeInfo > ' + fieldName + ' > type) element cannot have children');
				}

				result.typeInfo.get(fieldName).type = type.text();

				var format = field.children('format');
				if (format.length > 1) {
					throw new SourceError('HTTP Data Source / XML Parser / Too many (root > typeInfo > ' + fieldName + ' > format) elements');
				}
				else if (format.length === 1) {
					if (format.children().length > 0) {
						throw new SourceError('HTTP Data Source / XML Parser / (root > typeInfo > ' + fieldName + ' > format) element cannot have children');
					}
					result.typeInfo.get(fieldName).format = format.text();
				}
			}
		});
	}
	else if (typeof data === 'string') {
		var decoded = Papa.parse(data, { skipEmptyLines: true })
			, fields = decoded.data[0];

		_.each(decoded.data.slice(1), function (row) {
			var newRow = {};
			_.each(row, function (colVal, colIdx) {
				newRow[fields[colIdx]] = colVal;
			});
			result.data.push(newRow);
		});

		_.each(fields, function (f) {
			result.typeInfo.set(f, {
				type: 'string'
			});
		});
	}
	else {
		if (data.data === undefined) {
			throw new SourceError('HTTP Data Source / JSON Parser / Missing (data) property');
		}
		else if (!_.isArray(data.data)) {
			throw new SourceError('HTTP Data Source / JSON Parser / (data) property must be an array');
		}

		if (data.typeInfo === undefined) {
			throw new SourceError('HTTP Data Source / JSON Parser / Missing (typeInfo) property');
		}

		_.each(data.typeInfo, function (fti) {
			var field = fti.field;
			delete fti.field;
			result.typeInfo.set(field, fti);
		});

		for (var rowNum = 0; rowNum < data.data.length; rowNum += 1) {
			if (_.isArray(data.data[rowNum])) {
				var newRow = {};
				result.typeInfo.each(function (fti, field, i) {
					newRow[field] = data.data[rowNum][i];
				});
				data.data[rowNum] = newRow;
			}
		}

		result.data = data.data;
	}

	self.isLimited = self.autoLimit.enabled && result.data.length === self.autoLimit.maxRecords;

	return result;
};

// #unlimit {{{2

HttpSource.prototype.unlimit = function () {
	var self = this;

	self.isLimited = false;
	self.autoLimit.enabled = false;
};

// #getData {{{2

HttpSource.prototype.getData = function (params, cont) {
	var self = this;

	if (self.cache != null) {
		return cont(true, self.cache.data);
	}

	// The auto-limit feature sends to the server the maximum number of records to return.  If that
	// many records comes back, we assume that there are more available.

	if (self.autoLimit.enabled) {
		params[self.autoLimit.cgiParam] = self.autoLimit.maxRecords;
	}

	var al = logAsync('HttpSource#getData');
	self.xhr = jQuery.ajax(self.url, {
		method: self.method,
		data: params,
		traditional: true,
		dataType: self.dataType,
		error: function (jqXHR, textStatus, errorThrown) {
			al.finish();
			self.logError(self.makeLogTag() + ' HTTP Data Source / AJAX Error / ' + errorThrown);
			return cont(false);
		},
		success: function (data, textStatus, jqXHR) {
			al.finish();
			self.cache = self.parseData(data);
			return cont(true, self.cache.data);
		}
	});

	return self.xhr;
};

// #getTypeInfo {{{2

HttpSource.prototype.getTypeInfo = function (cont) {
	var self = this;

	if (self.cache != null) {
		return cont(true, self.cache.typeInfo);
	}

	return self.getData(undefined, function (ok) {
		if (!ok) {
			return cont(false);
		}

		return cont(true, self.cache.typeInfo);
	});
};

// #clearCachedData {{{2

HttpSource.prototype.clearCachedData = function () {
	var self = this;

	self.cache = null;
};

// #cancel {{{2

HttpSource.prototype.cancel = function () {
	var self = this;

	self.xhr.abort();
};

// FileSource {{{1
// Constructor {{{2

var FileSource = makeSubclass('FileSource', Object, function (spec, userTypeInfo, source) {
	var self = this;

	self.spec = spec;
	self.userTypeInfo = userTypeInfo;
	self.source = source;

	self.cache = {
		data: [],
		typeInfo: new OrdMap()
	};
});

mixinLogging(FileSource);

// #setToolbar {{{2

FileSource.prototype.setToolbar = function (toolbar) {
	var self = this;

	var input = jQuery('<input>', { 'type': 'file', 'name': 'file', 'accept': '.csv' })
		.on('change', function () {
			Papa.parse(this.files.item(0), {
				header: true,
				skipEmptyLines: true,
				complete: function (results, file) {
					self.logInfo(results);

					self.cache.data = results.data;
					self.cache.typeInfo = new OrdMap();

					_.each(results.meta.fields, function (field) {
						self.cache.typeInfo.set(field, {
							'type': 'string'
						});
					});

					self.source.clearCachedData();
				}
			});
		})
		.appendTo(toolbar);
};

// #setFile {{{2

FileSource.prototype.setFiles = function (files) {
	var self = this;

	if (!(files instanceof FileList)) {
		return;
	}

	Papa.parse(files.item(0), {
		header: true,
		skipEmptyLines: true,
		complete: function (results, file) {
			self.logInfo(results);

			self.cache.data = results.data;
			self.cache.typeInfo = new OrdMap();

			_.each(results.meta.fields, function (field) {
				self.cache.typeInfo.set(field, {
					'type': 'string'
				});
			});

			self.source.clearCachedData();
		}
	});
};

// #getData {{{2

FileSource.prototype.getData = function (params, cont) {
	var self = this;

	return cont(true, self.cache.data);
};

// #getTypeInfo {{{2

FileSource.prototype.getTypeInfo = function (cont) {
	var self = this;

	return cont(true, self.cache.typeInfo);
};

// TableSource {{{1

// Constructor {{{2

var TableSource = makeSubclass('TableSource', Object, function (spec, userTypeInfo, source) {
	var self = this;

	self.spec = spec;
	self.userTypeInfo = userTypeInfo;
	self.source = source;

	self.cache = {};
});

mixinLogging(TableSource);

// #getData {{{2

TableSource.prototype.getData = function (params, cont) {
	var self = this;

	if (self.cache.data != null) {
		return self.cache.data;
	}

	var getText = function (selector) {
		return jQuery(selector).map(function (i, x) {
			return jQuery(x).text();
		});
	};

	var tableSelector = self.spec.tableSelector || ''
		, columnSelector = self.spec.columnSelector || 'div[id="lv_' + self.source.table.id + '_span"] table tbody:eq(0) tr th a font'
		, dataSelector = self.spec.dataSelector || 'div[id="lv_' + self.source.table.id + '_span"] table tbody:eq(1) tr td font'
		, columns = getText(columnSelector)
		, data = getText(dataSelector)
		, row
		, col
		, newData = []
		, newObj;

	// The data we got from the table is in this format: [1A, 1B, 1C, 2A, 2B, 2C ...]
	// We want it to be in this format: [{1A, 1B, 1C}, {2A, 2B, 2C}, ...]
	// The following code does that conversion.
	for (row = 0; row < data.length / columns.length; row += 1) {
		newObj = {};
		for (col = 0; col < columns.length; col += 1) {
			newObj[columns[col]] = data[row * columns.length + col];
		}
		newData.push(newObj);
	}

	self.cache.data = newData;

	return cont(true, self.cache.data);
};

// #getTypeInfo {{{2

TableSource.prototype.getTypeInfo = function (cont) {
	var self = this;

	if (self.cache.typeInfo != null) {
		return self.cache.typeInfo;
	}

	var getText = function (selector) {
		return jQuery(selector).map(function (i, x) {
			return jQuery(x).text();
		});
	};

	var columnSelector = self.spec.columnSelector || 'div[id="lv_' + self.source.table.id + '_span"] table tbody:eq(0) tr th a font'
		, columns = getText(columnSelector)
		, newTypeInfo = new OrdMap();

	_.each(columns, function (field) {
		newTypeInfo.set(field, {
			'type': 'string'
		});
	});

	self.cache.typeInfo = newTypeInfo;

	return cont(true, self.cache.typeInfo);
};

// Source {{{1

// JSDoc Typedefs {{{2

/**
 * A callback function that receives the data obtained from a data source.
 *
 * @callback Source~getData_cb
 *
 * @param {Array<Object>} data The data.
 */

/**
 * A callback function that receives unique element information from a data source.
 *
 * @callback Source~getUniqElts_cb
 *
 * @param {Object<string, wcgraph.UniqElt>} uniqElts The unique element information.
 */

/**
 * A callback function that receives the type information about a data source.
 *
 * @callback Source~getTypeInfo_cb
 *
 * @param {TypeInfo} typeInfo The type information.
 */

/**
 * Represents information about the types of fields produced by a data source.  The keys are field
 * names.  Values can just be the type name as a string, in simple situations; when more info is
 * required, you can use the full object to describe the field.
 *
 * @typedef Source~TypeInfo
 *
 * @type {Object<string,string|Source~FieldTypeInfo>}
 */

/**
 * This is the full specification of a field's type information.  One step of data acquisition is
 * type decoding, which converts the data to an internal representation which will be used for
 * sorting and filtering.  This step occurs after any user conversion functions are evaluated.  Type
 * decoding works on the `value` property of the field value object.  If your conversion function
 * updates this property, it's possible to perform your own conversion and still get the benefit of
 * type decoding on the result.
 *
 * @typedef Source~FieldTypeInfo
 *
 * @property {string} type What type of data are we receiving?  Must be one of the following:
 * string, number, date, datetime, currency.
 *
 * @property {string} format For a type of date or datetime, a formatting string for Moment which
 * will decode the input.  Note that decoding comes *after* any conversion functions are executed.
 *
 * @property {string} internalType For a type of date, datetime, number, or currency, how that value
 * should be represented internally.  Supported values are:
 *
 *   - date or datetime
 *       - **string**: fastest but requires the date to be in a format like `YYYY-MM-DD`
 *       - **moment**: more flexible but slower
 *   - number or currency
 *       - **primitive**: uses the browser's native number representation; fast but imprecise
 *       - **numeral**: a library specifically for formatting numbers
 *       - **bignumber**: a library for arbitrary fixed-precision arithmetic
 */

/**
 * Source specification.
 *
 * @typedef Source~Spec
 *
 * @property {string} name
 * @property {string} error
 * @property {string} type
 *
 * @property {Array.<string>|Object.<string,Array.<string>>} conversion
 * As an array, apply the named conversions to all fields in the data.  As an object, each key is a
 * field, and the corresponding value is the named conversions to apply to that field only.
 *
 * ```
 * conversion: ['foo', {'name': ['bar']}]
 * ```
 *
 * This example applies the conversion *foo* to all fields, and the conversion *bar* only to values
 * in the `name` field.
 */

// Constructor {{{2

/**
 * Abstract data source that wraps specific data source implementations (e.g. for system reports or
 * the JSON API).
 *
 * @param {Source~Spec} spec
 * Specification of the source.
 *
 * @param {object} params
 *
 * @param {Object.<string, Source~FieldTypeInfo>|Array.<Source~FieldTypeInfo>} userTypeInfo Provided
 * by the user to override the type information that comes from the origin.  For example, you might
 * be using an origin backed by MySQL, which reports a column type as being a string... but we want
 * to treat it as a date.  You would override that field's type information to indicate it should be
 * parsed as a date instead of a string.  Another possibility is to discard time information from a
 * datetime, treating it as a date instead.
 *
 * ```
 * {
 *   "Birth Date": {
 *     "type": "date"
 *   }
 * }
 * ```
 *
 * @param {object} opts
 *
 * @param {string} [opts.name]
 * Name of this instance used for logging messages; if omitted, one will be generated automatically.
 *
 * @param {boolean} [opts.deferDecoding=false] If true, defer conversion of numeric and date types
 * (using Numeral and Moment) until required (when displayed or upon sort).
 *
 * @param {boolean} [opts.passThroughParams=false] If true, then parameters are obtained from the
 * current page's URL.  These are overridden by any other parameters.
 *
 * @class
 * @property {function} error
 * @property {string} type
 * @property {object} cache
 * @property {Array<ParamInput>} params
 * @property {object} locks
 * @property {Array<function>} subscribers
 * @property {boolean} guessColumnTypes
 *
 * @property {string} discriminatorField
 * Name of the field used as a discriminator that tells us whether or not we've seen a given row
 * before or not.  Only one discriminator field is allowed.
 *
 * Example: `close_date` to ensure that we only capture new data based on the `close_date` of the
 * row.
 *
 * @property {Array.<Array.<any>>} discriminatorRanges
 * A list of [min, max] pairs indicating that we've already seen rows with the discriminator field
 * set to a value between the min and max.
 *
 * Example: `[['2020-01-01 00:00:00', '2020-03-31 23:59:59']]`, to indicate that we've already seen
 * data from Q1 2020.
 */

var Source = makeSubclass('Source', Object, function (spec, params, userTypeInfo, opts) {
	var self = this;

	opts = deepDefaults(opts, {
		deferDecoding: true,
		passThroughParams: false
	});

	self.setName(opts.name);

	self.error = spec.error; // Error reporting function.
	self.type = spec.type; // Where we're getting the data from.
	self.cache = {};
	self.params = params;
	self.locks = {};
	self.opts = opts;

	self.eventHandlers = {};
	_.each(_.keys(Source.events), function (evt) {
		self.eventHandlers[evt] = [];
	});

	self.guessColumnTypes = true;

	if (_.isArray(userTypeInfo)) {
		self.userTypeInfo = _.indexBy(userTypeInfo, 'field');
	}
	else {
		self.userTypeInfo = userTypeInfo;
	}

	if (Source.sources[self.type] === undefined) {
		throw new SourceError('Unsupported data source type: ' + self.type);
	}

	self.origin = new Source.sources[self.type](spec, userTypeInfo, self);

	var checkConversionArray = function (convs, field) {
		// Check the validity of all the specified conversions.
		//
		//   * If identified by name:
		//
		//     1. The name must already be registered in `Source.converters`
		//     2. The registered converter must be a function
		//
		//   * Otherwise it needs to be a function.

		_.each(convs, function (c, i) {
			if (typeof c === 'string') {
				if (Source.converters[c] === undefined) {
					throw new SourceError('Conversion' + (field ? ' for field "' + field + '", ' : '') + ' #' + i + ': Named converter "' + c + '" not registered');
				}

				if (typeof Source.converters[c] !== 'function') {
					throw new SourceError('Conversion' + (field ? ' for field "' + field + '", ' : '') + ' #' + i + ': Named converter "' + c + '" is not a function');
				}
			}
			else if (typeof c !== 'function') {
				throw new SourceError('Invalid Source config: `.conversion' + (field ? '[' + field + ']' : '') + '[' + i + ']` must be a function or string');
			}
		});
	};

	if (_.isArray(spec.conversion)) {
		checkConversionArray(spec.conversion);
	}
	else {
		_.each(spec.conversion, function (convs, field) {
			checkConversionArray(convs, field);
		});
	}

	self.conversion = spec.conversion;

	self.locks.getData = new Lock(self.toString() + ' // GET DATA');
	self.locks.refresh = new Lock(self.toString() + ' // REFRESH');
});

// Mixins {{{2

mixinEventHandling(Source, [
		'fetchDataBegin'
	, 'fetchDataEnd'
	, 'fetchDataCancel'
	, 'dataUpdated'
	, 'getTypeInfo'
]);

mixinLogging(Source);
mixinNameSetting(Source);

// Event JSDoc {{{2

/**
 * Fired when we start fetching data from the origin.
 *
 * @event Source#fetchDataBegin
 */

/**
 * Fired when we've received data from the origin.
 *
 * @event Source#fetchDataEnd
 */

/**
 * Fired when new data is available.
 *
 * @event Source#dataUpdated
 */

/**
 * Fired when new type information is available.
 *
 * @event Source#getTypeInfo
 */

// .sources {{{2

/**
 * A map of source types to the classes that implement them.
 */

Source.sources = {
	local: LocalSource,
	http: HttpSource,
	file: FileSource,
	table: TableSource
};

// .converters {{{2

Source.converters = {};

// .decode {{{2

Source.decode = function (cell, fti) {
	if (cell.decoded) {
		// We already did this one.
		return;
	}

	if (cell.orig === undefined) {
		cell.orig = cell.value;
	}

	if (typeof cell.orig === 'string') {
		// We'll be decoding from a string to some type.
		cell.value = types.registry.get(fti.type).parse(cell.orig, fti.internalType, fti.format);
	}
	else {
		// We'll be decoding from another type, e.g. float to BigNumber.
		cell.value = types.registry.get(fti.type).decode(cell.orig, fti.internalType);
	}

	cell.decoded = true;
};

// .decodeAll {{{2

Source.decodeAll = function (data, field, typeInfo) {
	var fti = typeInfo.get(field);

	if (!fti.needsDecoding) {
		return;
	}

	console.debug('[DataVis // Source // Decoding] Decoding all values: field = "%s" ; type = %s ; internalType = %s ; valueTypeOf = %s', field, fti.type, fti.internalType, typeof(getProp(data, 0, field, 'value')));

	_.each(data, function (row) {
		Source.decode(row[field], typeInfo.get(field));
	});

	fti.deferDecoding = false;
	fti.needsDecoding = false;
};

// #unlimit {{{2

Source.prototype.unlimit = function () {
	var self = this;

	if (typeof self.origin.unlimit === 'function') {
		return self.origin.unlimit();
	}
};

// #getName {{{2

Source.prototype.getName = function () {
	var self = this;

	if (typeof self.origin.getName === 'function') {
		return self.origin.getName();
	}
};

// #getData {{{2

/**
 * Evaluate the data source, if necessary, and pass along the data that was obtained from it.  The
 * data will be cached so that subsequent invocations don't re-evaluate the data source.
 *
 * @method
 *
 * @param {Source~getData_cb} cont Continuation function.
 */

Source.prototype.getData = function (cont) {
	var self = this;

	if (self.locks.getData.isLocked()) {
		return self.locks.getData.onUnlock(function () {
			return self.getData(cont);
		});
	}

	if (self.cache.data != null) {
		return cont(true, self.cache.data);
	}

	self.locks.getData.lock();
	self.fire('fetchDataBegin');
	return self.origin.getData(self.createParams(), function (ok, data) {
		if (!ok) {
			self.fire('fetchDataEnd');
			self.locks.getData.unlock();
			return cont(false);
		}

		self.postProcess(data, function (finalData) {
			self.cache.data = finalData;
			self.fire('fetchDataEnd');
			self.locks.getData.unlock();
			return cont(true, finalData);
		});
	});
};

// #getUniqueVals {{{2

/**
 * Provide unique element information.
 *
 * @method
 *
 * @param {Source~getUniqElts_cb} cont Continuation function.
 */

Source.prototype.getUniqueVals = function (cont) {
	var self = this;

	if (self.cache.uniqElts != null) {
		return cont(self.cache.uniqElts);
	}

	self.getData(function (ok, data) {
		var uniqElts = {};
		var tmp = {};

		if (!ok) {
			return cont({});
		}

		_.each(data, function (row) {
			_.each(row, function (cell, field) {
				if (uniqElts[field] === undefined) {
					uniqElts[field] = {
						count: 0,
						values: []
					};
					tmp[field] = {};
				}

				if (tmp[field][cell.value] === undefined) {
					tmp[field][cell.value] = true;
					uniqElts[field].count += 1;
					uniqElts[field].values.push(cell.value);
				}
			});
		});

		_.each(uniqElts, function (obj) {
			obj.values.sort();
		});

		self.cache.uniqElts = uniqElts;
		return cont(self.cache.uniqElts);
	});
};

// #getTypeInfo {{{2

/**
 * @param {Source~getTypeInfo_cb} cont Continuation function.
 */

Source.prototype.getTypeInfo = function (cont) {
	var self = this;

	if (self.cache.typeInfo != null) {
		return cont(true, self.cache.typeInfo);
	}

	return self.origin.getTypeInfo(function (ok, typeInfo) {
		if (!ok) {
			return cont(false);
		}

		// When the type information for a field is just a string, then that's the same as setting it as
		// the 'type' property of the full object.

		typeInfo.each(function (v, k) {
			if (typeof v === 'string') {
				v = {
					'type': v
				};
				typeInfo.set(k, v);
			}
			v.field = k;
			v.overridden = false;
		});

		// Merge user-specified type information with whatever we got from the source.

		if (self.userTypeInfo != null) {
			_.each(self.userTypeInfo, function (userFti, field) {
				if (!typeInfo.isSet(field)) {
					self.logWarning(self.makeLogTag() + ' Overriding type information on field "' + field + '" which is not present in the source.');
					typeInfo.set(field, {});
				}

				// Just a string for the value is a shortcut for specifying the type.
				// EXAMPLE: {field1: 'number'} => {field1: {type: 'number'}}

				if (typeof userFti === 'string') {
					userFti = { type: userFti };
				}

				var fti = typeInfo.get(field);

				// Mark when the type is overridden by the user, so we don't try to guess it later.

				if (userFti.type != null) {
					fti.overridden = true;
				}

				_.extend(fti, userFti);

				self.logDebug(self.makeLogTag('getTypeInfo') + ' Overriding origin type information { field = "' + field + '", typeInfo = %O }', userFti);
			});
		}

		self.cache.typeInfo = typeInfo;
		self.logDebug(self.makeLogTag('getTypeInfo') + ' Type Info = %O', deepCopy(self.cache.typeInfo.asMap()));

		self.fire(Source.events.getTypeInfo, null, self.cache.typeInfo, self);
		return cont(true, self.cache.typeInfo);
	});
};

// #getDisplayName {{{2

Source.prototype.getDisplayName = function (cont) {
	var self = this;

	if (self.cache.displayName != null) {
		return cont(self.cache.displayName);
	}

	if (self.origin.getDisplayName != null) {
		return self.origin.getDisplayName(function (displayName) {
			self.cache.displayName = displayName;
			return cont(self.cache.displayName);
		});
	}
	else {
		self.cache.displayName = {};
		return cont(self.cache.displayName);
	}
};

// #postProcess {{{2

Source.prototype.postProcess = function (data, cont) {
	var self = this;

	if (data == null) {
		throw new SourceError('Data Source / Post Process / Received nothing');
	}
	else if (!_.isArray(data)) {
		throw new SourceError('Data Source / Post Process / Data is not an array');
	}

	self.logDebug(self.makeLogTag('postProcess') + ' Beginning post-processing');

	self.getTypeInfo(function (ok, typeInfo) {
		if (!ok) {
			return cont(data);
		}

		self.logDebug(self.makeLogTag('postProcess') + ' Received type info from source origin: %O', typeInfo.asMap());

		typeInfo.each(function (fti) {
			if (fti.type == null) {
				fti.type = 'string';
			}
		});

		// Post-processing involves converting the data received from the source into a form that will
		// be used internally for sorting, filtering, and display.  This takes several steps.
		//
		//   #1 - User conversion functions.  These go first because they can alter the value and type
		//        information.  (For example, turning all strings starting with "$" into currency.)
		//
		//   #2 - Decide whether type conversion is necessary and should be deferred.
		//
		//   #3 - Perform type conversion for non-deferred fields.

		// Gather the user's conversion functions, which will be applied on every row.  Conversion
		// functions can be applied across all fields (specified as an array), or on a per-field basis
		// (specified as an object with field name keys and array values).

		var conversionFuncs = {};
		typeInfo.each(function (fti, fieldName) {
			conversionFuncs[fieldName] = self.getConversionFuncs(fieldName);
		});

		// Step #1 - Perform all user conversion functions.

		_.each(data, function (row, rowNum) {
			_.each(row, function (val, field) {
				var fti = typeInfo.get(field);
				var cell = {
					value: val
				};

				if (conversionFuncs[field] != null) {
					var conversionFuncOpts = {
						row: row,
						source: self,
						rowNum: rowNum,
						totalRows: data.length
					};

					// Go through all the user's conversion functions.

					for (var i = 0; i < conversionFuncs[field].length; i += 1) {
						if (conversionFuncs[field][i](cell, field, fti, conversionFuncOpts)) {
							break;
						}
					}
				}

				row[field] = cell;
			});
		});

		self.guessTypes(data, typeInfo);

		// Step #2 - Update the type information with whether the internal representation (i.e. numeral
		// or moment) conversion of a field should be deferred or not.

		self.setConversionTypeInfo(data, typeInfo);

		// Step #3 - Unless conversion has been deferred on this field, decode it into the appropriate
		// internal representation (numeral or moment).

		_.each(data, function (row, rowNum) {
			_.each(row, function (val, field) {
				var fti = typeInfo.get(field);

				// We also must decode now if this column is used as the discriminator.  Mostly this is
				// because using a date discriminator is much easier if we already have it parsed in Moment.

				if (fti != null && (!fti.deferDecoding || field === self.discriminatorField)) {
					Source.decode(row[field], fti);
				}

			});
		});

		// Step #4 - Find the new min/max for discriminator ranges, if that's something we're doing.

		if (self.discriminatorField != null) {
			var dfti = typeInfo.get(self.discriminatorField);
			var cmp = getComparisonFn.byType(dfti);

			var newMin = null;
			var newMax = null;

			self.logDebug(self.makeLogTag('postProcess') + ' Checking discriminator ranges for "%s" field (type = %s)', self.discriminatorField, dfti.type);

			_.each(data, function (row, rowNum) {
				var val = row[self.discriminatorField].value;
				var inRange = false;
				for (var i = 0; i < self.discriminatorRanges.length && !inRange; i += 1) {
					var range = self.discriminatorRanges[i];
					if (cmp(range[0], val) <= 0 && cmp(val, range[1]) <= 0) {
						inRange = true;
					}
				}
				if (inRange) {
					// This row is already within a discriminator range, so mark it to be removed.
					data[rowNum] = null;
				}
				else {
					// Update min/max for the new discriminator range.

					if (newMin == null || cmp(val, newMin) < 0) {
						newMin = val;
					}
					if (newMax == null || cmp(newMax, val) > 0) {
						newMax = val;
					}
				}
			});

			self.addDiscriminatorRange([newMin, newMax]);

			// Get rid of the rows we marked earlier as being within an existing range.
			data = _.without(data, null);
		}

		self.logDebug(self.makeLogTag('postProcess') + ' Post-processing finished');

		return cont(data);
	});
};

// #determineConversionFuncs {{{2

Source.prototype.getConversionFuncs = function (fieldName) {
	var self = this
		, conversionFuncs = [];

	var addConversionFuncs = function (convs) {
		_.each(convs, function (c, i) {
			if (typeof c === 'function') {
				conversionFuncs.push(c);
			}
			else if (typeof c === 'string') {
				conversionFuncs.push(Source.converters[c]);
			}
		});
	};

	if (self.conversion !== undefined) {
		if (_.isArray(self.conversion)) {
			addConversionFuncs(self.conversion);
		}
		else if (self.conversion[fieldName] !== undefined) {
			addConversionFuncs(self.conversion[fieldName]);
		}
	}

	return conversionFuncs;
};

// #guessTypes {{{2

Source.prototype.guessTypes = function (data, typeInfo) {
	var self = this;

	typeInfo.each(function (fti, f) {
		if (fti.overridden || fti.type !== 'string') {
			return;
		}

		self.logDebug(self.makeLogTag('guessTypes') + ' Guessing type for field "%s"', fti.field);

		var guess = null;

		for (var i = 0; guess !== 'string' && i < data.length; i += 1) {
			var val = data[i][f].value;
			var newGuess = stringValueType(val);

			if (guess == null) {
				guess = newGuess;
			}
			else if (newGuess !== guess) {
				self.logDebug(self.makeLogTag('guessTypes') + ' For field "%s", previous guess "%s" disagrees with current guess "%s" (rowNum = %d, value = %O)', f, guess, newGuess, i, val);
				guess = 'string';
			}
		}

		if (guess != null && guess !== 'string') {
			self.logDebug(self.makeLogTag('guessTypes') + ' For field "%s", successfully guessed new type "%s"', f, guess);
			fti.type = guess;
		}
	});
};

// #setConversionTypeInfo {{{2

Source.prototype.setConversionTypeInfo = function (data, typeInfo) {
	var self = this;

	typeInfo.each(function (fti, f) {
		if (fti.type === 'string') {
			fti.internalType = 'string';
		}
		else if (['number', 'currency'].indexOf(fti.type) >= 0) {
			fti.deferDecoding = self.opts.deferDecoding;
			fti.needsDecoding = true;
			if (fti.internalType == null) {
				if (fti.type === 'currency') {
					fti.internalType = 'bignumber';
				}
				else {
					fti.internalType = 'primitive';
				}
			}
			else if (['primitive', 'numeral', 'bignumber'].indexOf(fti.internalType) < 0) {
				self.logError(self.makeLogTag() + ' Invalid internalType "' + fti.internalType + '" requested for field "' + fti.field + '" - falling back to "primitive" instead');
				fti.internalType = 'primitive';
			}
		}
		else if (['date', 'datetime', 'time'].indexOf(fti.type) >= 0) {
			fti.deferDecoding = self.opts.deferDecoding;
			if ((fti.type === 'date' && (fti.format === undefined || fti.format === 'YYYY-MM-DD'))
					|| (fti.type === 'datetime' && (fti.format === undefined || fti.format === 'YYYY-MM-DD HH:mm:ss'))
					|| (fti.type === 'time' && (fti.format === undefined || fti.format === 'HH:mm:ss' || fti.format === 'HH:mm'))) {
				// The values are dates and/or times where the lexicographic sort is also chronological.
				// So, there's no need to convert them to any special value internally to support sorting.
				fti.internalType = 'string';
			}
			else {
				fti.needsDecoding = true;
				fti.internalType = 'moment';
			}
		}

		if (fti.deferDecoding) {
			self.logDebug(self.makeLogTag('convert') + ' Deferring conversion until <%s> { field = "%s", type = "%s", format = "%s" }',
				fti.needsDecoding ? 'SORT' : 'DISPLAY', f, fti.type, fti.format);
		}
	});
};

// #clearCachedData {{{2

/**
 * Removes the cache of data, type information, unique elements, and display names.  This is also
 * needed to force the data source to re-evalute its parameter inputs.  The next call to getData()
 * et al. will re-evaluate the underlying data source.
 *
 * @method
 */

Source.prototype.clearCachedData = function () {
	var self = this;

	if (typeof self.origin.clearCachedData === 'function') {
		self.origin.clearCachedData();
	}

	self.cache = {};

	self.fire('dataUpdated');
};

// #refresh {{{2

Source.prototype.refresh = function () {
	var self = this;

	// When locked, a data updated is already in progress.  Just wait and it will notify clients to
	// re-pull the data from us.

	if (self.locks.refresh.isLocked()) {
		return;
	}

	self.logDebug(self.makeLogTag() + ' Refreshing...');

	self.locks.refresh.lock();

	if (typeof self.origin.clearCachedData === 'function') {
		self.origin.clearCachedData();
	}

	var tmp = self.cache;
	self.cache = {};

	self.getData(function (ok) {
		self.locks.refresh.unlock();
		if (ok) {
			self.fire('dataUpdated');
		}
		else {
			// Restore cached data.  Not sure if this is really necessary because the View should have its
			// own reference to this data.
			self.cache = tmp;
		}
	});
};

// #createParams {{{2

/**
 * Create a parameters object from the ParamInput instances currently bound to this data source.
 * This is an internal method used when the user calls getData().  For system reports, it helps
 * build the object used by jQuery to set the CGI parameters for the HTTP GET request.
 *
 * @method
 *
 * @returns {object} The CGI parameters needed for running a system report.
 */

Source.prototype.createParams = function () {
	var self = this
		, obj = {};

	if (self.opts.passThroughParams) {
		obj = getParamsFromUrl();
	}

	_.each(self.params, function (p) {
		self.logDebug(self.makeLogTag('createParams') + ' Parameter =', p);
		p.toParams(obj);
	});

	self.logDebug(self.makeLogTag('createParams') + ' Final Parameters =', obj);

	// The JSON clause parameters will be objects that need to be serialized first, so they can be
	// sent to the server and unpacked there.

	if (obj.report_json_where != null) {
		obj.report_json_where = JSON.stringify(obj.report_json_where);
	}

	if (obj.report_json_having != null) {
		obj.report_json_having = JSON.stringify(obj.report_json_having);
	}

	return obj;
};

// #swapRows {{{2

/**
 *
 */

Source.prototype.swapRows = function (oldIndex, newIndex) {
	var self = this;

	if (self.cache.data === undefined) {
		throw new SourceError('Attempted to swap rows before retrieving data');
	}

	var temp = self.cache.data.splice(oldIndex, 1);
	self.cache.data.splice(newIndex, 0, temp[0]);
	//for (var i=0; i<self.cache.data.length; i++) {
	//	self.cache.data[i].position=i;
	//}
};

// #isCancellable {{{2

/**
 * Indicates that retrieving data from the origin is cancellable via the `cancel()` method.
 *
 * @returns {boolean}
 * True if the `cancel()` method works, false otherwise.
 */

Source.prototype.isCancellable = function () {
	var self = this;

	return typeof self.origin.cancel === 'function';
};

// #cancel {{{2

/**
 * Cancel retrieval of the data from the origin.
 */

Source.prototype.cancel = function () {
	var self = this;

	if (typeof self.origin.cancel === 'function') {
		self.origin.cancel();
		self.locks.getData.clear();
		self.locks.refresh.clear();
		self.fire('fetchDataCancel');
	}
};

// #toString {{{2

Source.prototype.toString = function () {
	var self = this;

	return 'Source(' + self.name + ', ' + self.type + ')';
};

// #setToolbar {{{2

Source.prototype.setToolbar = function (toolbar) {
	var self = this;

	self.toolbar = toolbar;

	if (typeof self.origin.setToolbar === 'function') {
		self.origin.setToolbar(toolbar);
	}
};

// #setDiscriminatorField {{{2

Source.prototype.setDiscriminatorField = function (field) {
	this.discriminatorField = field;
};

// #setDiscriminatorRanges {{{2

Source.prototype.setDiscriminatorRanges = function (ranges) {
	this.discriminatorRanges = ranges;
};

// #addDiscriminatorRange {{{2

Source.prototype.addDiscriminatorRange = function (range) {
	this.discriminatorRanges.push(range);
};

// #clearDiscriminatorRanges {{{2

Source.prototype.clearDiscriminatorRanges = function () {
	this.discriminatorRanges = [];
};

// #condenseDiscriminatorRanges {{{2

/**
 * Eliminate gaps within individual discriminator ranges.  Think of this like "garbage collection"
 * for the discriminator ranges.  You could have a Source that updates every hour to get new stuff,
 * which would slowly build up a bunch of hour-long ranges.  We need a way to keep that list from
 * growing indefinitely, and that's what this does by collapsing all the ranges into a single range
 * corresponding to the overall min/max of all ranges.
 */

Source.prototype.condenseDiscriminatorRanges = function () {
	var self = this;

	if (self.discriminatorField == null) {
		return;
	}

	if (self.discriminatorRanges.length === 0) {
		return;
	}

	var dfti = self.cache.typeInfo.get(self.discriminatorField);
	var cmp = getComparisonFn.byType(dfti);

	var newMin = null;
	var newMax = null;

	_.each(self.discriminatorRanges, function (range) {
		if (newMin == null || cmp(range[0], newMin) < 0) {
			newMin = range[0];
		}
		if (newMax == null || cmp(newMax, range[1]) > 0) {
			newMax = range[1];
		}
	});

	if (newMin == null || newMax == null) {
		self.clearDiscriminatorRanges();
	}
	else {
		self.setDiscriminatorRanges([[newMin, newMax]]);
	}
};

// Data Model {{{1
//
// There's no such thing as a data model now.  There's just not a lot of functionality AT THIS TIME
// that we would put there.  So the data source is kind of acting as the model now.  This may change
// when we add editing.

// Exports {{{1

export {
	Source,
	FileSource,
};
