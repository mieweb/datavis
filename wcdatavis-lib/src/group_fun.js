// Imports {{{1

import _ from 'underscore';
import BigNumber from 'bignumber.js';
import numeral from 'numeral';
import moment from 'moment';

import jQuery from 'jquery';

import { trans } from './trans.js';
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

// GroupFunction {{{1

/**
 * Represents a function that can be applied to the value of a field when grouping or pivotting.
 *
 * @param {object} spec
 * A specification for the group function.
 *
 * @param {string} spec.transLabel
 * Translation label that should be shown in the user interface for this function's name.
 *
 * @param {Array.<string>} [spec.allowedTypes]
 * If present, this function will only be presented as an option for fields in the specified set of
 * data types (e.g. using `['datetime']` will restrict it to datetime fields only).  By default, the
 * group function will be shown for fields of all types on which DataVis supports group functions.
 *
 * @param {function} [spec.valueFun]
 * If present, this function will be used to transform the original data value into one used for
 * grouping.  If not provided, the default is the identity function.
 *
 * @param {string} [spec.resultType="string"]
 * The DataVis field type of the result of calling `valueFun`.
 *
 * @param {string} [spec.sortType=spec.resultType]
 * If present, overrides the algorithm for sorting group values, e.g. "month" to sort month names by
 * chronological (rather than alphabetical) order.
 *
 * @param {boolean} [canFilter=true]
 * If true, a filter can be applied to the data based on the result of this group function.  Used to
 * determine when drilldown is available, since drilling down means applying a filter that produces
 * exactly the population of the group.
 *
 * @param {function} [spec.valueToFilter]
 * If present, this function will be used to transform a value into a filter object that matches the
 * value.  Used for things like date buckets (e.g. a value "2010 October" becomes a filter for dates
 * from 10/1/2010 to 10/31/2010).
 *
 * @class
 */

var GroupFunction = makeSubclass('GroupFunction', Object, function (spec) {
	var self = this;

	spec = deepDefaults(spec, {});

	if (spec.transLabel == null || typeof spec.transLabel !== 'string') {
		throw new Error('Call Error: `transLabel` must be a string');
	}

	if (spec.allowedTypes != null && !_.isArray(spec.allowedTypes)) {
		throw new Error('Call Error: `allowedTypes` must be null or an array');
	}

	if (spec.valueFun != null && typeof spec.valueFun !== 'function') {
		throw new Error('Call Error: `valueFun` must be null or a function');
	}

	if (spec.resultType != null && typeof spec.resultType !== 'string') {
		throw new Error('Call Error: `resultType` must be null or a string');
	}

	if (spec.sortType != null && typeof spec.sortType !== 'string') {
		throw new Error('Call Error: `sortType` must be null or a string');
	}

	if (spec.valueToFilter != null && typeof spec.valueToFilter !== 'function') {
		throw new Error('Call Error: `valueToFilter` must be null or a function');
	}

	spec = deepDefaults(spec, {
		category: 'other',
		resultType: 'string',
		canFilter: true,
		valueToFilter: function (s) {
			return {'$eq': s};
		}
	});

	if (spec.sortType == null) {
		spec.sortType = spec.resultType;
	}

	copyProps(spec, self, ['category', 'transLabel', 'allowedTypes', 'valueFun', 'resultType', 'sortType', 'canFilter', 'valueToFilter']);
});

// #getTransName {{{2

GroupFunction.prototype.getTransName = function () {
	return trans(this.transLabel);
};

// #getDisplayName {{{2

GroupFunction.prototype.getDisplayName = function () {
	return this.getTransName();
};

// #applyValueFun {{{2

/**
 * Apply the function to get the value used for grouping.
 *
 * @param {any} x
 * The original value from the data.
 *
 * @returns {any}
 * The value that should be used for grouping purposes.
 */

GroupFunction.prototype.applyValueFun = function (x, fti) {
	return this.valueFun ? this.valueFun(x, fti) : x;
};

// Group Function Registry {{{1

var GROUP_FUNCTION_REGISTRY = new OrdMap();

// Year {{{2

GROUP_FUNCTION_REGISTRY.set('year', new GroupFunction({
	category: 'date',
	name: 'year',
	transLabel: 'GRID.GROUP_FUN.DATE.YEAR',
	allowedTypes: ['date', 'datetime'],
	valueFun: function (d) {
		if (typeof d === 'string') {
			d = moment(d);
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		return d.format('YYYY');
	},
	valueToFilter: function (s) {
		return {
			'$gte': moment(s, 'YYYY').format('YYYY-MM-DD HH:mm:ss'),
			'$lte': moment(s, 'YYYY').add(1, 'years').subtract(1, 'seconds').format('YYYY-MM-DD HH:mm:ss')
		};
	}
}));

// Quarter {{{2

GROUP_FUNCTION_REGISTRY.set('quarter', new GroupFunction({
	category: 'repeating',
	name: 'quarter',
	transLabel: 'GRID.GROUP_FUN.REPEATING.QUARTER',
	allowedTypes: ['date', 'datetime'],
	valueFun: function (d) {
		if (typeof d === 'string') {
			d = moment(d);
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		return d.format('[Q]Q');
	},
	// The View does not currently offer a filter that matches a date within a specific quarter
	// regardless of year (e.g. all dates in Q1 in any year).
	canFilter: false
}));

// Month {{{2

GROUP_FUNCTION_REGISTRY.set('month', new GroupFunction({
	category: 'repeating',
	name: 'month',
	transLabel: 'GRID.GROUP_FUN.REPEATING.MONTH',
	allowedTypes: ['date', 'datetime'],
	valueFun: function (d) {
		if (typeof d === 'string') {
			d = moment(d);
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		return d.format('MMM');
	},
	sortType: 'month',
	// The View does not currently offer a filter that matches a date within a specific month
	// regardless of year (e.g. all dates in October in any year).
	canFilter: false
}));

// ISO Week {{{2

GROUP_FUNCTION_REGISTRY.set('week_iso', new GroupFunction({
	category: 'repeating',
	name: 'week_iso',
	transLabel: 'GRID.GROUP_FUN.REPEATING.WEEK',
	allowedTypes: ['date', 'datetime'],
	valueFun: function (d) {
		if (typeof d === 'string') {
			d = moment(d);
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		return d.format('[W]WW');
	},
	// The View does not currently offer a filter that matches a date within a specific week
	// regardless of year.
	canFilter: false
}));

// Day of Week {{{2

GROUP_FUNCTION_REGISTRY.set('day_of_week', new GroupFunction({
	category: 'repeating',
	name: 'day_of_week',
	transLabel: 'GRID.GROUP_FUN.REPEATING.DAY_OF_WEEK',
	allowedTypes: ['date', 'datetime'],
	valueFun: function (d) {
		if (typeof d === 'string') {
			d = moment(d);
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		return d.format('ddd');
	},
	sortType: 'day_of_week',
	// The View does not currently offer a filter that matches a date for a specific day of the week
	// (e.g. find all dates that fall on Tuesday).
	canFilter: false
}));

// Year, Quarter {{{2

GROUP_FUNCTION_REGISTRY.set('year_and_quarter', new GroupFunction({
	category: 'date',
	name: 'year_and_quarter',
	transLabel: 'GRID.GROUP_FUN.DATE.YEAR_AND_QUARTER',
	allowedTypes: ['date', 'datetime'],
	valueFun: function (d) {
		if (typeof d === 'string') {
			d = moment(d);
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		return d.format('YYYY [Q]Q');
	},
	valueToFilter: function (s) {
		return {
			'$gte': moment(s, 'YYYY [Q]Q').format('YYYY-MM-DD HH:mm:ss'),
			'$lte': moment(s, 'YYYY [Q]Q').add(1, 'quarters').subtract(1, 'seconds').format('YYYY-MM-DD HH:mm:ss')
		};
	}
}));

// Year, Month {{{2

GROUP_FUNCTION_REGISTRY.set('year_and_month', new GroupFunction({
	category: 'date',
	name: 'year_and_month',
	transLabel: 'GRID.GROUP_FUN.DATE.YEAR_AND_MONTH',
	allowedTypes: ['date', 'datetime'],
	valueFun: function (d) {
		if (typeof d === 'string') {
			d = moment(d);
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		return d.format('YYYY MMM');
	},
	sortType: 'year_and_month',
	valueToFilter: function (s) {
		return {
			'$gte': moment(s, 'YYYY MMM').format('YYYY-MM-DD HH:mm:ss'),
			'$lte': moment(s, 'YYYY MMM').add(1, 'months').subtract(1, 'seconds').format('YYYY-MM-DD HH:mm:ss')
		};
	}
}));

// Year, ISO Week {{{2

GROUP_FUNCTION_REGISTRY.set('year_and_week_iso', new GroupFunction({
	category: 'date',
	name: 'year_and_week_iso',
	transLabel: 'GRID.GROUP_FUN.DATE.YEAR_AND_WEEK',
	allowedTypes: ['date', 'datetime'],
	valueFun: function (d) {
		if (typeof d === 'string') {
			d = moment(d);
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		return d.format('YYYY [W]WW');
	},
	valueToFilter: function (s) {
		return {
			'$gte': moment(s, 'YYYY [W]WW').format('YYYY-MM-DD HH:mm:ss'),
			'$lte': moment(s, 'YYYY [W]WW').add(1, 'weeks').subtract(1, 'seconds').format('YYYY-MM-DD HH:mm:ss')
		};
	}
}));

// Year, Month, Day {{{2

GROUP_FUNCTION_REGISTRY.set('day', new GroupFunction({
	category: 'date',
	name: 'day',
	transLabel: 'GRID.GROUP_FUN.DATE.FULL_DATE',
	allowedTypes: ['datetime'],
	valueFun: function (d) {
		if (typeof d === 'string') {
			d = moment(d);
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		return d.format('YYYY-MM-DD');
	},
	resultType: 'date',
	valueToFilter: function (s) {
		return {
			'$gte': moment(s).format('YYYY-MM-DD HH:mm:ss'),
			'$lte': moment(s).add(1, 'days').subtract(1, 'seconds').format('YYYY-MM-DD HH:mm:ss')
		};
	}
}));

// Year, Month, Day, Hour {{{2

GROUP_FUNCTION_REGISTRY.set('day_and_time_1hr', new GroupFunction({
	category: 'datetime',
	name: 'day_and_time_1hr',
	transLabel: 'GRID.GROUP_FUN.DATE_TIME.SLICE.1HR',
	allowedTypes: ['datetime'],
	valueFun: function (d) {
		if (typeof d === 'string') {
			d = moment(d);
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		return d.format('YYYY-MM-DD HH:00:00');
	},
	resultType: 'datetime',
	valueToFilter: function (s) {
		return {
			'$gte': moment(s).format('YYYY-MM-DD HH:mm:ss'),
			'$lte': moment(s).add(1, 'hours').subtract(1, 'seconds').format('YYYY-MM-DD HH:mm:ss')
		};
	}
}));

// Year, Month, Day, Hour, Quarter Hour {{{2

GROUP_FUNCTION_REGISTRY.set('day_and_time_15min', new GroupFunction({
	category: 'datetime',
	name: 'day_and_time_15min',
	transLabel: 'GRID.GROUP_FUN.DATE_TIME.SLICE.15MIN',
	allowedTypes: ['datetime'],
	valueFun: function (d) {
		if (typeof d === 'string') {
			d = moment(d);
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		var min = d.minutes();
		var minStr = (min >= 0 && min <= 14) ? '00'
			: (min >= 15 && min <= 29) ? '15'
			: (min >= 30 && min <= 44) ? '30'
			: (min >= 45 && min <= 59) ? '45'
			: '00';
		return d.format('YYYY-MM-DD HH:' + minStr + ':00');
	},
	resultType: 'datetime',
	valueToFilter: function (s) {
		return {
			'$gte': moment(s).format('YYYY-MM-DD HH:mm:ss'),
			'$lte': moment(s).add(15, 'minutes').subtract(1, 'seconds').format('YYYY-MM-DD HH:mm:ss')
		};
	}
}));

// Hour {{{2

GROUP_FUNCTION_REGISTRY.set('time_1hr', new GroupFunction({
	category: 'time',
	name: 'time_1hr',
	transLabel: 'GRID.GROUP_FUN.TIME.SLICE.1HR',
	allowedTypes: ['time'],
	valueFun: function (d, fti) {
		if (typeof d === 'string') {
			d = moment(d, getProp(fti, 'format'));
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		return d.format('HH:00:00');
	},
	resultType: 'time',
	valueToFilter: function (s) {
		return {
			'$gte': moment(s).format('HH:mm:ss'),
			'$lte': moment(s).add(1, 'hours').subtract(1, 'seconds').format('HH:mm:ss')
		};
	}
}));

// Hour, Quarter Hour {{{2

GROUP_FUNCTION_REGISTRY.set('time_15min', new GroupFunction({
	category: 'time',
	name: 'time_15min',
	transLabel: 'GRID.GROUP_FUN.TIME.SLICE.15MIN',
	allowedTypes: ['time'],
	valueFun: function (d, fti) {
		if (typeof d === 'string') {
			d = moment(d, getProp(fti, 'format'));
		}
		if (!moment.isMoment(d) || !d.isValid()) {
			return 'Invalid Date';
		}
		var min = d.minutes();
		var minStr = (min >= 0 && min <= 14) ? '00'
			: (min >= 15 && min <= 29) ? '15'
			: (min >= 30 && min <= 44) ? '30'
			: (min >= 45 && min <= 59) ? '45'
			: '00';
		return d.format('HH:' + minStr + ':00');
	},
	resultType: 'time',
	valueToFilter: function (s) {
		return {
			'$gte': moment(s).format('HH:mm:ss'),
			'$lte': moment(s).add(15, 'minutes').subtract(1, 'seconds').format('HH:mm:ss')
		};
	}
}));

// Exports {{{1

export {
	GroupFunction,
	GROUP_FUNCTION_REGISTRY
};
