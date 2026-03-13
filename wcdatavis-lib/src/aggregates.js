import _ from 'underscore';
import sprintf from 'sprintf-js';
import numeral from 'numeral';
import BigNumber from 'bignumber.js';

import jQuery from 'jquery';

import { trans } from './trans.js';
import {
	deepDefaults,
	format,
	getComparisonFn,
	getNatRep,
	getProp,
	getPropDef,
	isElement,
	isFloat,
	isInt,
	makeSubclass,
	mixinLogging,
	toFloat,
	toInt,
} from './util/misc.js';
import OrdMap from './util/ordmap.js';
import types from './types.js';

// Utility Functions {{{1
/* ===============================================================================================
 *  Aggregates
 * ===============================================================================================
 *
 * Aggregate functions are invoked over an array of data.  Each aggregate function is basically a
 * reduction, but we aren't using the Underscore reduce() function because of its limitations.
 *
 *
 *
 * Implementation of the aggregate functions inside the `aggregate` variable will seem awkward and
 * unconventional to programmers without a background in functional programming.  Please use this
 * explanation to help understand how the pieces fit together:
 *
 *   1. Properties of the `aggregates` variable are functions that are called directly based on
 *   user configuration of the report definition.  Most take only a single argument, which is the
 *   field to aggregate.  Some (like 'groupConcat') take additional arguments that affect their
 *   output.
 *
 *   2. Each of these `aggregates` properties return a function that takes the row data, which is
 *   all rows to aggregate.  It's an array of objects, each having a property corresponding to the
 *   field argument explained above.
 *
 *   3. When that function is applied to the row data to be aggregated, it more than likely calls
 *   invokeAggregate(), which is a convenience function to iterate over the row data.  This is
 *   basically a reduction.
 *
 *   4. The reduction function may be a simple function, or it might be a call to makeAggregate(),
 *   which builds an aggregate (i.e. reduction function) by closing over some userdata.  The
 *   userdata can be used for anything you want, e.g. building the sets used by aggregates like
 *   'countDistinct.'
 *
 * The presence of makeAggregate() isn't strictly necessary, as we can use the function from step
 * #2 as the closure over userdata, but it does make the architecture more flexible and easier to
 * adapt to build your own aggregates.
 *
 * -----------------------------------------------------------------------------------------------
 *  EXAMPLE
 * -----------------------------------------------------------------------------------------------
 *
 * var report = {
 *   table: {
 *     grouping: {
 *       headerLine: [
 *         { func: 'average', field: 'Age' },
 *         { func: 'countDistinct', field: 'First Name', separator: ', ' }
 *       ]
 *     }
 *   }
 * }
 */

function makeAggregate(userdata, aggregate) {
	var u = userdata;
	return function (acc, next, data, index) {
		return aggregate(acc, next, data, index, u);
	};
}

/**
 * Invoke the core implementation of an aggregate function.  This is used by most aggregate
 * functions (properties of `AGGREGATE_REGISTRY`) to perform the data traversal.
 *
 * - The implementation may throw an exception to abort the process at any time (e.g. if an item
 *   doesn't match the expected type or is in some other way borked).
 *
 * - The implementation may not use all of the arguments that it receives (e.g. `sum` only needs the
 *   accumulator and the item, it doesn't care about the data or index).
 *
 * - There is currently no way for an implementation to indicate successful premature termination
 *   (e.g. no need to continue traversing the data).  If this is needed (e.g. `first`), it's
 *   recommended to not use `invokeAggregate` - and to instead just traverse the data yourself.
 *
 * @param {Array.<any>} data
 * @param {function} aggregate Called like this: `agg(acc, item, data, index)`
 * @param {any} init
 */

function invokeAggregate(data, aggregate, init) {
	var i, i0, len, acc;
	if (!_.isArray(data)) {
		throw 'Cannot invoke aggregate over non-array';
	}
	len = data.length;
	if (!_.isUndefined(init)) {
		acc = init;
		i0 = 0;
	}
	else {
		acc = data[0].rowData;
		i0 = 1;
	}
	for (i = i0; i < len; i += 1) {
		try {
			acc = aggregate(acc, data[i].rowData, data, i);
		}
		catch (e) {
			if (_.isString(e)) {
				throw e + ' // data index = ' + i;
			}
			else {
				throw e;
			}
		}
	}
	return acc;
}



/**
 * Make sure a user-specified aggregate conforms to the required data structure.
 */

function checkAggregate(defn, agg, source) {
	if (!_.isObject(agg)) {
		throw defn.error(new Error('must be an object'));
	}
	// INPUT VALIDATION: [fun]
	if (_.isUndefined(agg.fun)) {
		throw defn.error(new Error('must be present'));
	}
	if (!_.isString(agg.fun)) {
		throw defn.error(new Error('must be a string'));
	}
	if (!AGGREGATE_REGISTRY.get(agg.fun)) {
		throw defn.error(new Error('must be a valid builtin aggregate function'));
	}
	// INPUT VALIDATION: [displayText]
	if (_.isUndefined(agg.displayText)) {
		agg.displayText = agg.fun;
	}
	if (!_.isString(agg.displayText)) {
		throw defn.error(new Error('must be a string'));
	}
}

// Aggregate {{{1

/**
 * @class Aggregate
 *
 * Base class for all aggregate functions.  To make your own, extend it with {@linkcode
 * makeSubclass makeSubclass()} like this:
 *
 * ```
 * var MyAggregate = makeSubclass('MyAggregate', MIE.WC_DataVis.Aggregate, function () {
 *   // constructor (optional)
 * }, {
 *   name: 'My Aggregate',
 *   ... // override properties listed below
 * });
 * ```
 *
 * Aggregate functions are computed with the `calculate()` method.  You *must* either override the
 * base class' implementation of this method, or provide an implementation of the `calculateStep()`
 * method.  The base implementation of `calculate()` uses the abstract `calculateStep()` to iterate
 * over each row in the data.  This is the most common use, but some aggregate functions (e.g.
 * "count") don't need to iterate over all the rows, and therefore override `calculate()` with
 * something simpler.
 *
 * After creating the class, it needs to be added to the aggregate registry:
 *
 * ```
 * MIE.WC_DataVis.AGGREGATE_REGISTRY.set('briefUniqueName', MyAggregate);
 * ```
 *
 * Since the registry is an {@linkcode OrdMap}, the aggregate functions appear in the user interface
 * in the order they were added to the registry.
 *
 * @property {string} name
 * Name of the aggregate function used in the dropdown menu by the grid.
 *
 * @property {string} transLabel
 * Translation label for the displayed name of the aggregate function.
 *
 * @property {int} [fieldCount=0]
 * Number of fields required.  Usually zero or one.
 *
 * @property {string} [type]
 * Fixed type of the result of this aggregate function.  Undefined indicates that the type depends
 * on the field(s) used.
 *
 * @property {string[]} [allowedTypes]
 * If fields have one of the types specified, that type overrides the fixed type.  This exists as a
 * way of dealing with subtypes (e.g. "Sum" returns a number, but could also return a currency if
 * the field it's operating on is a currency).
 *
 * @property {boolean} [inheritFormatting=false]
 * If true, then the result should be formatted according to the formatting of the field(s).
 *
 * @property {any} [bottomValue]
 * The value returned when an error occurs.  Also used as the "starting point" of the reduction over
 * the data (i.e. zero or the empty string for most aggregates) when `init` isn't provided.
 *
 * @property {function|any} [init]
 * The value used as the initial seed of the result calculation (which is a reduction/fold over the
 * data).  If a function, that function is invoked with no arguments to get the value.  When not
 * provided, the bottom value is used.
 *
 * @property {boolean} [enabled=true]
 * If false, then the aggregate function will not be shown in the user interface.
 */

var Aggregate = makeSubclass('Aggregate', Object, function (opts) {
	var self = this;

	self.opts = deepDefaults(opts, {
		isHidden: false
	});
}, {
	enabled: true,
	fieldCount: 0,
	fieldInfo: [],
	inheritFormatting: false,
	numItems: 0
});

mixinLogging(Aggregate, function () { return 'Aggregate(' + this.name + ')'; });

// JSDoc {{{2

/**
 * @method calculateStep
 * @abstract
 * @memberof Aggregate
 * @instance
 *
 * @param {any} acc
 * Accumulator built up by the aggregate function so far.
 *
 * @param {any} next
 * The value from the next "row" in the data.
 *
 * @return {any}
 * The new accumulator value.
 */

/**
 * @method calculateDone
 * @abstract
 * @memberof Aggregate
 * @instance
 *
 * If this exists, it will be called to determine what the final result from the aggregate function
 * should be.  It receives the final accumulator value built from the reduction over the data.
 *
 * @param {any} result
 * The result of the aggregate function (the value returned from the final call to `calculateStep`).
 *
 * @return {any}
 * A value to return instead of the last accumulator.
 */

// #calculate {{{2

/**
 * Calculate the result of the aggregate function applied over the specified data.  Calls the
 * `calculateStep` method for each "row" in the data.  If the `calculateDone` method exists, the
 * result is passed through it before being returned.
 *
 * @param {object[]} data
 * The data to apply this aggregate function to.
 *
 * @return {any}
 * The result of the aggregate function.  This will have the type indicated by the `type` property
 * of the instance (and if undefined, will depend on the type of the fields used).
 */

Aggregate.prototype.calculate = function (data) {
	var self = this;
	var i, i0, len, acc;

	if (!self.checkOpts() || !self.checkData(data)) {
		return self.bottomValue;
	}

	self.numItems = 0;

	len = data.length;

	// Determine the initial value of the accumulator.  When there's an `init` property, prefer it.
	// Fall back to the `bottomValue` property.

	acc = typeof self.init === 'function' ? self.init()
		: self.init != null ? self.init
		: self.bottomValue;
	i0 = 0;

	// When there's no data, bail with the initial value.

	if (len === 0) {
		if (typeof self.calculateDone === 'function') {
			return self.calculateDone(acc);
		}
		return acc;
	}

	// If there's no initial value for the accumulator, use the first value from the data.

	if (acc == null) {
		acc = data[0].rowData;
		if (self.opts.fields && self.opts.fields.length > 0) {
			acc = self.getRealValue(acc[self.opts.fields[0]]);
		}
		i0 = 1;
	}

	// Loop through the rest of the data and call the `calculateStep` function.  This is basically
	// like calling fold/reduce.

	for (i = i0; i < len; i += 1) {
		try {
			acc = self.calculateStep(acc, data[i].rowData, data, i);
		}
		catch (e) {
			self.logError(self.makeLogTag() + ' Error occurred at data index [' + i + ']: ' + e.toString());
			return self.bottomValue;
		}
	}

	return self.calculateDone != null ? self.calculateDone(acc) : acc;
};

// #checkOpts {{{2

/**
 * Check the options provided to the constructor.  This ensures that all configuration needed by the
 * aggregate function was provided.
 *
 * @return {boolean}
 * True if everything is OK, false if there is a problem with the options.
 */

Aggregate.prototype.checkOpts = function () {
	var self = this;

	if (self.fieldCount > 0) {
		if (self.opts.fields == null) {
			self.logError(self.makeLogTag() + ' Missing `opts.fields`');
			return false;
		}
		else if (!_.isArray(self.opts.fields)) {
			self.logError(self.makeLogTag() + ' `opts.fields` must be an array');
			return false;
		}
		else if (self.opts.fields.length !== self.fieldCount) {
			self.logError(self.makeLogTag() + ' `opts.fields` must include ' + self.fieldCount + ' elements');
			return false;
		}

		if (self.opts.typeInfo == null) {
			self.logError(self.makeLogTag() + ' Missing `opts.typeInfo`');
			return false;
		}
		else if (!_.isArray(self.opts.typeInfo)) {
			self.logError(self.makeLogTag() + ' `opts.typeInfo` must be an array');
			return false;
		}
		else if (self.opts.typeInfo.length !== self.fieldCount) {
			self.logError(self.makeLogTag() + ' `opts.typeInfo` must include ' + self.fieldCount + ' elements');
			return false;
		}
	}

	return true;
};

// #checkData {{{2

/**
 * Check the data provided to the `calculate` method.
 *
 * @return {boolean}
 * True if everything is OK, false if there is a problem with the data.
 */

Aggregate.prototype.checkData = function (data) {
	var self = this;

	if (!_.isArray(data)) {
		self.logError(self.makeLogTag() + ' `data` must be an array');
		return false;
	}

	return true;
};

// #getRealValue {{{2

Aggregate.prototype.getRealValue = function (cell) {
	if (_.isString(cell)) {
		return cell;
	}
	else if (_.isNumber(cell)) {
		return cell;
	}
	else if (_.isObject(cell)) {
		if (cell.value !== undefined) {
			return cell.value;
		}
		else if (cell.orig !== undefined) {
			return cell.orig;
		}
		else {
			throw new Error('Unable to get real value of cell');
		}
	}
};

// #getNatRep {{{2

Aggregate.prototype.getNatRep = function (val) {
	var self = this;
	var fcc = self.opts.colConfig ? self.opts.colConfig[0] : null;
	var fti = self.opts.typeInfo ? self.opts.typeInfo[0] : null;

	if (types.registry.isSet(fti.type)) {
		return types.registry.get(fti.type).natRep(val);
	}
	else {
		return getNatRep(val);
	}
};

// #getFormattedValue {{{2

Aggregate.prototype.getFormattedValue = function (cell) {
	var self = this;
	var val = self.getRealValue(cell);
	var colConfig = self.opts.colConfig ? self.opts.colConfig[0] : null;
	var typeInfo = self.opts.typeInfo ? self.opts.typeInfo[0] : null;

	return format(colConfig, typeInfo, cell);
};

// #getNumber {{{2

Aggregate.prototype.getNumber = function (x) {
	if (window.numeral && window.numeral.isNumeral(x)) {
		// Check to see if this is a plain number, or a number wrapped by the Numeral library.  It
		// should always be the latter, but we check anyway, because there's no reason not to.

		return x.value();
	}
	else if (_.isString(x)) {
		// We can also handle when it's a number represented as a string.  We'll try to convert it
		// either to an integer or a float.

		if (isInt(x)) {
			return toInt(x);
		}
		else if (isFloat(x)) {
			return toFloat(x);
		}
		else {
			return 0;
		}
	}
	else if (_.isNumber(x)) {
		return x;
	}
	else {
		return 0;
	}
};

// #getFullName {{{2

/**
 * Returns a name for this aggregate function, suitable for display.
 *
 * #. If `opts.name` was provided to the constructor, that will be used.
 * #. If fields are required and some were given, builds a name like "[name] of [field]".
 * #. Uses the aggregate function name.
 *
 * @returns {string} A name suitable for display.
 */

Aggregate.prototype.getFullName = function () {
	var self = this;

	if (self.opts.name != null) {
		return self.opts.name;
	}
	else if (self.fieldCount > 0 && _.isArray(self.opts.fields) && self.opts.fields.length > 0) {
		return trans('AGGREGATE.HEADER_DISPLAY', self.getTransName(), (
			_.map(self.opts.fields, function (field, fieldIdx) {
				var fcc = getPropDef({}, self.opts, 'colConfig', fieldIdx);
				return fcc.displayText || field;
			}).join(', ')));
	}
	else {
		return self.getTransName();
	}
};

// #getTransName {{{2

Aggregate.prototype.getTransName = function () {
	var self = this;

	return trans(self.transLabel);
};

// #getType {{{2

/**
 * Gets the type of the result of the aggregate function.
 *
 * An aggregate function can specify its own type $T_a$, e.g. count is always a number.
 *
 * * If fields were supplied, and they are all the same type $T_f$:
 *    * If that type is in the aggregate function's list of allowed types, then $T_f$ is used.
 *    * If the aggregate function didn't specify a fixed type, $T_f$ is used.
 * * If $T_a$ was specified, then it is used.
 * * The type "string" is used.
 *
 * @returns {string} The type of the result of the aggregate function.
 */

Aggregate.prototype.getType = function () {
	var self = this;

	// Set the type of the aggregate result.  Sometimes this is fixed (e.g. count is always a number).
	// If that's the case, it's given by the Aggregate instance itself.

	var t = self.type;

	if (getProp(self.opts, 'fields', 'length')) {
		var uniqueTypes = _.uniq(_.pluck(self.opts.typeInfo, 'type'));
		if (uniqueTypes.length === 1) {
			if (self.allowedTypes && self.allowedTypes.indexOf(uniqueTypes[0]) >= 0) {
				// Using `allowedTypes` lets field types override the fixed type.
				t = uniqueTypes[0];
			}
			else if (t == null) {
				// There is no fixed type, so we must use the field type.
				t = uniqueTypes[0];
			}
		}
	}

	// Default to a string type.

	if (t == null) {
		t = 'string';
	}

	return t;
};

// Count {{{1

var CountAggregate = makeSubclass('CountAggregate', Aggregate, null, {
	name: 'count',
	transLabel: 'AGGREGATE.NAME.COUNT',
	fieldCount: 0,
	type: 'number',
	inheritFormatting: false,
	bottomValue: 0
});

// #calculate {{{2

CountAggregate.prototype.calculate = function (data) {
	var self = this;

	if (!self.checkOpts() || !self.checkData(data)) {
		return self.bottomValue;
	}

	return (data && data.length) || self.bottomValue;
};

// Count Distinct {{{1

var CountDistinctAggregate = makeSubclass('CountDistinctAggregate', Aggregate, function () {
	var self = this;

	self.set = {};
	self.super['Aggregate'].ctor.apply(self, arguments);
}, {
	name: 'countDistinct',
	transLabel: 'AGGREGATE.NAME.COUNT_DISTINCT',
	fieldCount: 1,
	type: 'number',
	inheritFormatting: false,
	bottomValue: 0,
	init: function () {
		return {
			set: {},
			count: 0
		};
	}
});

// #calculateStep {{{2

CountDistinctAggregate.prototype.calculateStep = function (acc, next) {
	var self = this;
	var cell = next[self.opts.fields[0]];
	var key = self.getNatRep(cell.value);

	if (key != null && key != '' && acc.set[key] == null) {
		acc.set[key] = true;
		acc.count += 1;
	}
	return acc;
};

// #calculateDone {{{2

CountDistinctAggregate.prototype.calculateDone = function (acc) {
	return acc.count;
};

// Values {{{1

var ValuesAggregate = makeSubclass('ValuesAggregate', Aggregate, null, {
	name: 'values',
	transLabel: 'AGGREGATE.NAME.VALUES',
	fieldCount: 1,
	inheritFormatting: false,
	type: 'string',
	init: function () {
		return {
			resultIsElement: false,
			values: []
		};
	},
	options: {
		'separator': {
			'displayText': 'Separator'
		}
	}
});

// #calculateStep {{{2

ValuesAggregate.prototype.calculateStep = function (acc, next) {
	var self = this;
	var formatted = self.getFormattedValue(next[self.opts.fields[0]]);

	if (isElement(formatted)) {
		acc.resultIsElement = true;
	}

	acc.values.push(formatted);
	return acc;
};

// #calculateDone {{{2

ValuesAggregate.prototype.calculateDone = function (acc) {
	var self = this;

	if (!acc.resultIsElement) {
		return acc.values.join(self.opts.separator || ', ');
	}
	else {
		var wrapper = jQuery('<div>');
		_.each(acc.values, function (elt, i) {
			if (i > 0) {
				wrapper.append(self.opts.separator || ', ');
			}
			// FIXME: Subsequent calls to #calculate() from a different instance of ValuesAggregate can
			// change the elements of acc and therefore wrapper.  I cannot figure out why, so cloning the
			// element will have to do for now.
			wrapper.append(isElement(elt) ? jQuery(elt).clone() : elt);
		});
		return wrapper;
	}
};

// Values w/ Counts {{{1

var ValuesWithCountsAggregate = makeSubclass('ValuesWithCountsAggregate', Aggregate, null, {
	name: 'valuesWithCounts',
	transLabel: 'AGGREGATE.NAME.VALUES_WITH_COUNTS',
	fieldCount: 1,
	inheritFormatting: false,
	type: 'string',
	init: function () {
		return {
			map: new OrdMap(),
			resultIsElement: false
		};
	},
	options: {
		'separator': {
			'displayText': 'Separator'
		}
	}
});

// #calculateStep {{{2

ValuesWithCountsAggregate.prototype.calculateStep = function (acc, next) {
	var self = this;
	var cell = next[self.opts.fields[0]];
	var key = self.getNatRep(cell.value);
	var formatted = self.getFormattedValue(cell);

	if (acc.map.isSet(key)) {
		var info = acc.map.get(key);
		info.count += 1;
	}
	else {
		acc.map.set(key, {
			formatted: formatted,
			count: 1
		});
		if (isElement(formatted)) {
			acc.resultIsElement = true;
		}
	}

	return acc;
};

// #calculateDone {{{2

ValuesWithCountsAggregate.prototype.calculateDone = function (acc) {
	var self = this;

	if (acc.resultIsElement) {
		var div = jQuery('<div>');
		acc.map.each(function (v, k, i) {
			if (i > 0) {
				div.append(self.opts.separator || ', ');
			}
			div.append(isElement(v.formatted) ? v.formatted.clone() : v.formatted);
			div.append(' (' + v.count + ')');
		});
		return div;
	}
	else {
		var a = [];

		acc.map.each(function (v, k) {
			a.push(v.formatted + ' (' + v.count + ')');
		});

		return a.join(self.opts.separator || ', ');
	}
};

// Distinct Values {{{1

var DistinctValuesAggregate = makeSubclass('DistinctValuesAggregate', ValuesWithCountsAggregate, null, {
	name: 'distinctValues',
	transLabel: 'AGGREGATE.NAME.DISTINCT_VALUES',
});

// #calculateDone {{{2

DistinctValuesAggregate.prototype.calculateDone = function (acc) {
	var self = this;

	if (acc.resultIsElement) {
		var div = jQuery('<div>');
		acc.map.each(function (v, k, i) {
			if (i > 0) {
				div.append(self.opts.separator || ', ');
			}
			div.append(isElement(v.formatted) ? v.formatted.clone() : v.formatted);
		});
		return div;
	}
	else {
		var a = [];

		acc.map.each(function (v, k) {
			a.push(v.formatted);
		});

		return a.join(self.opts.separator || ', ');
	}
};

// Sum {{{1

var SumAggregate = makeSubclass('SumAggregate', Aggregate, null, {
	name: 'sum',
	transLabel: 'AGGREGATE.NAME.SUM',
	fieldCount: 1,
	// type: 'number',
	allowedTypes: ['number', 'currency', 'duration'],
	inheritFormatting: true,
	bottomValue: 0,
	init: function () {
		switch (this.opts.typeInfo[0].internalType) {
		case 'primitive':
			return 0;
		case 'numeral':
			return numeral(0);
		case 'bignumber':
			return BigNumber(0);
		}
	}
});

// #calculateStep {{{2

SumAggregate.prototype.calculateStep = function (acc, next) {
	var self = this;
	var val = self.getRealValue(next[self.opts.fields[0]]);
	var fcc = self.opts.colConfig ? self.opts.colConfig[0] : null;
	var fti = self.opts.typeInfo ? self.opts.typeInfo[0] : null;

	if (val == null) {
		return acc;
	}

	if (types.registry.isSet(fti.type) && typeof types.registry.get(fti.type).add === 'function') {
		self.numItems += 1;
		return types.registry.get(fti.type).add(acc, val);
	}

	switch (fti.internalType) {
	case 'primitive':
		if (Number.isNaN(val)) {
			return acc;
		}
		else {
			self.numItems += 1;
			return acc + val;
		}
	case 'numeral':
		if (Number.isNaN(val) || val.value() === null) {
			return acc;
		}
		else {
			self.numItems += 1;
			return acc.add(val.value());
		}
	case 'bignumber':
		if (val.isNaN()) {
			return acc;
		}
		else {
			self.numItems += 1;
			return acc.plus(val);
		}
	}
};

// Average {{{1

var AverageAggregate = makeSubclass('AverageAggregate', Aggregate, function (opts) {
	var self = this;

	self.sumAgg = new SumAggregate(opts);
	self.super['Aggregate'].ctor.apply(self, arguments);
}, {
	name: 'average',
	transLabel: 'AGGREGATE.NAME.AVERAGE',
	fieldCount: 1,
	type: 'number',
	allowedTypes: ['number', 'currency'],
	inheritFormatting: true,
	bottomValue: 0
});

// #calculate {{{2

AverageAggregate.prototype.calculate = function (data) {
	var self = this;

	if (!self.checkOpts() || !self.checkData(data)) {
		return self.bottomValue;
	}

	// First, compute the SUM using a sum aggregate.  It will keep track of the number of contributing
	// items internally which we can use for division later.

	var num = self.sumAgg.calculate(data);
	var denom = self.sumAgg.numItems;

	// If the SUM ends up being null, NaN, or invalid in any other way, just return the bottom value.
	// Otherwise, perform the average using whatever division method is appropriate for the internal
	// type of the field.

	if (num == null || denom === 0) {
		return self.bottomVal;
	}

	switch (self.opts.typeInfo[0].internalType) {
	case 'primitive':
		if (Number.isNaN(num)) {
			return self.bottomVal;
		}
		else {
			return num / denom;
		}
	case 'numeral':
		if (Number.isNaN(num) || num.value() === null) {
			return self.bottomVal;
		}
		else {
			return num.divide(denom);
		}
	case 'bignumber':
		if (num.isNaN()) {
			return self.bottomVal;
		}
		else {
			return num.div(denom);
		}
	}
};

// Min {{{1

var MinAggregate = makeSubclass('MinAggregate', Aggregate, null, {
	name: 'min',
	transLabel: 'AGGREGATE.NAME.MIN',
	fieldCount: 1,
	inheritFormatting: true
});

// #checkOpts {{{2

MinAggregate.prototype.checkOpts = function () {
	var self = this;

	if (self.opts.typeInfo == null) {
		self.logError(self.makeLogTag() + ' Missing `opts.typeInfo`');
		return false;
	}

	if (self.opts.compare == null) {
		self.opts.compare = getComparisonFn.byType(self.opts.typeInfo[0].type);
	}

	if (typeof self.opts.compare !== 'function') {
		self.logError(self.makeLogTag() + ' Missing `opts.compare`');
		return false;
	}

	return self.super['Aggregate'].checkOpts();
};

// #calculateStep {{{2

MinAggregate.prototype.calculateStep = function (acc, next) {
	var self = this;
	var fcc = self.opts.colConfig ? self.opts.colConfig[0] : null;
	var fti = self.opts.typeInfo ? self.opts.typeInfo[0] : null;

	var val = self.getRealValue(next[self.opts.fields[0]]);
	if (types.registry.isSet(fti.type)) {
		return types.registry.get(fti.type).compare(acc, val) < 0 ? acc : val;
	}
	return self.opts.compare(acc, val) < 0 ? acc : val;
};

// Max {{{1

var MaxAggregate = makeSubclass('MaxAggregate', Aggregate, null, {
	name: 'max',
	transLabel: 'AGGREGATE.NAME.MAX',
	fieldCount: 1,
	inheritFormatting: true
});

// #checkOpts {{{2

MaxAggregate.prototype.checkOpts = function () {
	var self = this;

	if (self.opts.typeInfo == null) {
		self.logError(self.makeLogTag() + ' Missing `opts.typeInfo`');
		return false;
	}

	if (self.opts.compare == null) {
		self.opts.compare = getComparisonFn.byType(self.opts.typeInfo[0].type);
	}

	if (typeof self.opts.compare !== 'function') {
		self.logError(self.makeLogTag() + ' Missing `opts.compare`');
		return false;
	}

	return self.super['Aggregate'].checkOpts();
};

// #calculateStep {{{2

MaxAggregate.prototype.calculateStep = function (acc, next) {
	var self = this;
	var fcc = self.opts.colConfig ? self.opts.colConfig[0] : null;
	var fti = self.opts.typeInfo ? self.opts.typeInfo[0] : null;

	var val = self.getRealValue(next[self.opts.fields[0]]);
	if (types.registry.isSet(fti.type)) {
		return types.registry.get(fti.type).compare(acc, val) < 0 ? val : acc;
	}
	return self.opts.compare(acc, val) < 0 ? val : acc;
};

// First {{{1

var FirstAggregate = makeSubclass('FirstAggregate', Aggregate, null, {
	name: 'first',
	transLabel: 'AGGREGATE.NAME.FIRST',
	fieldCount: 1,
	inheritFormatting: true
});

// #checkData {{{2

FirstAggregate.prototype.checkData = function (data) {
	var self = this;

	if (data.length === 0) {
		//self.logError(self.makeLogTag() + ' `data` has no elements');
		return false;
	}

	return self.super['Aggregate'].checkData(data);
};

// #calculate {{{2

FirstAggregate.prototype.calculate = function (data) {
	var self = this;

	if (!self.checkOpts() || !self.checkData(data)) {
		return self.bottomValue;
	}

	return self.getRealValue(data[0].rowData[self.opts.fields[0]]);
};

// Last {{{1

var LastAggregate = makeSubclass('LastAggregate', Aggregate, null, {
	name: 'last',
	transLabel: 'AGGREGATE.NAME.LAST',
	fieldCount: 1,
	inheritFormatting: true
});

// #checkData {{{2

LastAggregate.prototype.checkData = function (data) {
	var self = this;

	if (data.length === 0) {
		//self.logError(self.makeLogTag() + ' `data` has no elements');
		return false;
	}

	return self.super['Aggregate'].checkData(data);
};

// #calculate {{{2

LastAggregate.prototype.calculate = function (data) {
	var self = this;

	if (!self.checkOpts() || !self.checkData(data)) {
		return self.bottomValue;
	}

	return self.getRealValue(data[data.length - 1].rowData[self.opts.fields[0]]);
};

// Nth {{{1

var NthAggregate = makeSubclass('NthAggregate', Aggregate, null, {
	name: 'nth',
	transLabel: 'AGGREGATE.NAME.NTH',
	enabled: false,
	fieldCount: 1,
	inheritFormatting: true
});

// #checkOpts {{{2

NthAggregate.prototype.checkOpts = function () {
	var self = this;

	if (self.opts.index == null) {
		self.logError(self.makeLogTag() + ' Missing `opts.index`');
		return false;
	}

	if (!_.isNumber(self.opts.index)) {
		self.logError(self.makeLogTag() + ' `opts.index` must be a number');
		return false;
	}

	return self.super['Aggregate'].checkOpts();
};

// #checkData {{{2

NthAggregate.prototype.checkData = function (data) {
	var self = this;

	if (data.length === 0) {
		//self.logError(self.makeLogTag() + ' `data` has no elements');
		return false;
	}

	if (data.length <= self.opts.index) {
		self.logError(self.makeLogTag() + ' `data` has insufficient number of elements');
		return self.bottomValue;
	}

	return self.super['Aggregate'].checkData(data);
};

// #calculate {{{2

NthAggregate.prototype.calculate = function (data) {
	var self = this;

	if (!self.checkOpts() || !self.checkData(data)) {
		return self.bottomValue;
	}

	return data[data.length - 1];
};

// Sum / Sum {{{1

var SumOverSumAggregate = makeSubclass('SumOverSumAggregate', Aggregate, null, {
	name: 'sumOverSum',
	transLabel: 'AGGREGATE.NAME.SUM_OVER_SUM',
	fieldCount: 2,
	fieldInfo: [{
		transLabel: 'AGGREGATE.FIELD.NUMERATOR',
	}, {
		transLabel: 'AGGREGATE.FIELD.DENOMINATOR',
	}],
	type: 'string',
	inheritFormatting: false,
	bottomValue: 0,
	init: function () {
		return { a: 0, b: 0 };
	},
	options: {
		'format': {}
	}
});

// #calculateStep {{{2

SumOverSumAggregate.prototype.calculateStep = function (acc, next) {
	var self = this;

	acc.a += self.getNumber(next[self.opts.fields[0]].value);
	acc.b += self.getNumber(next[self.opts.fields[1]].value);

	return acc;
};

// #calculateDone {{{2

SumOverSumAggregate.prototype.calculateDone = function (obj) {
	var self = this;
	var result = (obj.a + 0.0) / (obj.b + 0.0);

	if (window.sprintf) {
		if (self.opts.format) {
			return sprintf.sprintf(self.opts.format, result);
		}
		if (result >= 100) {
			return sprintf.sprintf('%d', result);
		}
		else if (result >= 10) {
			return sprintf.sprintf('%3.1f', result);
		}
		else if (result >= 1) {
			return sprintf.sprintf('%3.2f', result);
		}
		else {
			return sprintf.sprintf('%3.3f', result);
		}
	}
	return result;
};

// #getFullName {{{2

SumOverSumAggregate.prototype.getFullName = function () {
	var self = this;

	return 'Sum(' + getPropDef(self.opts.fields[0], self.opts, 'colConfig', 0, 'displayText') + ') / Sum(' + getPropDef(self.opts.fields[1], self.opts, 'colConfig', 1, 'displayText') + ')';
};

// Count / Count {{{1

var CountOverCountAggregate = makeSubclass('CountOverCountAggregate', Aggregate, null, {
	name: 'countOverCount',
	transLabel: 'AGGREGATE.NAME.COUNT_OVER_COUNT',
	fieldCount: 2,
	fieldInfo: [{
		transLabel: 'AGGREGATE.FIELD.NUMERATOR',
	}, {
		transLabel: 'AGGREGATE.FIELD.DENOMINATOR',
	}],
	type: 'number',
	inheritFormatting: false,
	bottomValue: 0
});

// Aggregate Registry {{{1

var AGGREGATE_REGISTRY = new OrdMap();
AGGREGATE_REGISTRY.set('count', CountAggregate);
AGGREGATE_REGISTRY.set('countDistinct', CountDistinctAggregate);
AGGREGATE_REGISTRY.set('values', ValuesAggregate);
AGGREGATE_REGISTRY.set('valuesWithCounts', ValuesWithCountsAggregate);
AGGREGATE_REGISTRY.set('distinctValues', DistinctValuesAggregate);
AGGREGATE_REGISTRY.set('sum', SumAggregate);
AGGREGATE_REGISTRY.set('average', AverageAggregate);
AGGREGATE_REGISTRY.set('min', MinAggregate);
AGGREGATE_REGISTRY.set('max', MaxAggregate);
AGGREGATE_REGISTRY.set('first', FirstAggregate);
AGGREGATE_REGISTRY.set('last', LastAggregate);
AGGREGATE_REGISTRY.set('nth', NthAggregate);
AGGREGATE_REGISTRY.set('sumOverSum', SumOverSumAggregate);
AGGREGATE_REGISTRY.set('countOverCount', CountOverCountAggregate);

// AggregateInfo {{{1

/**
 * Create a new AggregateInfo instance.
 *
 * @param {string} aggType
 * What kind of aggregate to construct.
 *
 * @param {View~AggregateSpec} spec
 * The specification of the aggregate function.
 *
 * @param {number} [aggNum]
 * What number this aggregate function is.  Optional, because this information is not useful in all
 * contexts (e.g. footer aggregates, because there can only ever be one for each field).
 *
 * @param {OrdMap} [colConfig]
 * Column configuration for all fields; requirement depends upon the aggregate function.
 *
 * @param {OrdMap} [typeInfo]
 * Type information for all fields; requirement depends upon the aggregate function, but is strongly
 * recommended (only some basic aggregate functions like "count" don't need it).
 *
 * @param {function} [decode]
 * A function which is used to decode all the data in the fields over which the aggregate function
 * is applied.
 *
 * @class
 *
 * Represents information about an aggregate function.
 *
 * @property {number} aggNum
 * The aggregate number; used to correlate with the results.
 *
 * @property {string} fun
 * Internal name of the aggregate function, maps to a key in `AGGREGATE_REGISTRY`.
 *
 * @property {string} name
 * Display text for the aggregate function.
 *
 * @property {boolean} isHidden
 * If true, then the aggregate function should not be shown in the grid.
 *
 * @property {Array.<string>} fields
 * An array of the fields to which the aggregate function applies.  For functions that don't require
 * any fields, this will be an empty array.
 *
 * @property {Array.<Grid~ColConfig>} colConfig
 * An array of column configuration objects which correspond to `fields`.
 *
 * @property {Array.<Source~TypeInfo>} typeInfo
 * An array of type information objects which correspond to `fields`.
 *
 * @property {Aggregate} instance
 * The actual aggregate function instance which was used to compute the results.
 *
 * @property {boolean} debug
 * If true, then debugging messages are output for this aggregate.
 */

var AggregateInfo = makeSubclass('AggregateInfo', Object, function (aggType, spec, aggNum, colConfig, typeInfo, decode) {
	var self = this;

	self.aggNum = aggNum;
	self.aggType = aggType;
	self.fun = spec.fun;
	self.name = spec.name;
	self.isHidden = spec.isHidden;
	self.fields = [];
	self.colConfig = [];
	self.typeInfo = [];
	self.debug = spec.debug;

	if (typeof aggType !== 'string') {
		throw new Error('Call Error: `aggType` must be a string');
	}

	if (!_.isObject(spec)) {
		throw new Error('Call Error: `spec` must be an object');
	}
	if (typeof spec.fun !== 'string') {
		throw new Error('Call Error: `spec.fun` must be a string');
	}
	if (spec.fields != null && !_.isArray(spec.fields)) {
		throw new Error('Call Error: `spec.fields` must be null or an array');
	}

	if (aggNum != null && typeof aggNum !== 'number') {
		throw new Error('Call Error: `aggNum` must be null or a number');
	}

	if (colConfig != null && !(colConfig instanceof OrdMap)) {
		throw new Error('Call Error: `colConfig` must be null or an OrdMap instance');
	}

	if (typeInfo != null && !(typeInfo instanceof OrdMap)) {
		throw new Error('Call Error: `typeInfo` must be null or an OrdMap instance');
	}

	if (decode != null && typeof decode !== 'function') {
		throw new Error('Call Error: `decode` must be null or a function');
	}

	var aggClass = AGGREGATE_REGISTRY.get(spec.fun);

	if (aggClass == null) {
		throw new Error('No such aggregate function: "' + spec.fun + '"' +
			(spec.name ? ' (output name = "' + spec.name + '")' : ''));
	}

	var ctorOpts = {
		name: spec.name
	};

	if (spec.fields) {
		self.fields = spec.fields;
	}

	// Check to see if the number of fields supplied matches the number requested by the aggregate
	// function class.

	if (self.fields.length !== aggClass.prototype.fieldCount) {
		self.logWarning(self.makeLogTag() + ' Creating ' + aggType + '[' + aggNum + '] aggregate function "' + spec.fun + '" to be applied over fields ' + JSON.stringify(self.fields) + ', which doesn\'t match the number of fields supported by the aggregate function (' + aggClass.prototype.fieldCount + ')... expect trouble.');
	}

	if (self.fields.length > 0) {
		// Set the colConfig array for the supplied fields.

		if (colConfig != null) {
			self.colConfig = _.map(self.fields, function (f) {
				return colConfig.get(f);
			});
		}
		else {
			self.logWarning(self.makeLogTag() + ' Creating ' + aggType + '[' + aggNum + '] aggregate function "' + spec.fun + '" to be applied over fields ' + JSON.stringify(self.fields) + ', but no column config was provided.');
		}

		// Set the typeInfo array for the supplied fields.

		if (typeInfo != null) {
			self.typeInfo = _.map(self.fields, function (f) {
				return typeInfo.get(f);
			});
		}
		else {
			self.logWarning(self.makeLogTag() + ' Creating ' + aggType + '[' + aggNum + '] aggregate function "' + spec.fun + '" to be applied over fields ' + JSON.stringify(self.fields) + ', but no type info was provided.');
		}

		// Perform type decoding if needed, before we calculate the aggregate results.  This is
		// needed when doing aggregates like "values" and "distinct values" to make sure they're
		// formatted right by the aggregate function itself.

		_.each(self.typeInfo, function (fti, i) {
			if (fti == null) {
				throw new Error('Aggregate function applied to unknown field: "' + self.fields[i] + '"');
			}

			if (fti.needsDecoding) {
				if (decode != null) {
					decode(fti.field, fti);
				}
				else {
					self.logWarning(self.makeLogTag() + ' Unable to decode field "' + fti.field + '" on demand for aggregate function, no decoding function provided.');
				}
			}
		});

		ctorOpts.fields = self.fields;
		ctorOpts.isHidden = self.isHidden;
		ctorOpts.colConfig = self.colConfig;
		ctorOpts.typeInfo = self.typeInfo;
	}

	_.extend(ctorOpts, spec.opts);

	self.instance = new aggClass(ctorOpts);
});

mixinLogging(AggregateInfo);

// Exports {{{1

export {
	Aggregate,
	AggregateInfo,
	AGGREGATE_REGISTRY
};
