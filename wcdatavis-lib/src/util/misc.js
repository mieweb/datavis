import jQuery from 'jquery';
import BigNumber from 'bignumber.js';
import numeral from 'numeral';
import moment from 'moment';
import _ from 'underscore';
import sprintf from 'sprintf-js';
import JSONFormatter from 'json-formatter-js';

import deepCopy from './deepCopy.js';
import OrdMap from './ordmap.js';
import Lock from './lock.js';
import EXPERIMENTAL_FEATURES from '../flags.js';

import types from '../types.js';

/**
 * @namespace util
 */

// Functional {{{1

/**
 * @namespace util.functional
 */

/**
 * Generate unique symbols to use for element IDs. It doesn't much matter what the actual string
 * produced is, as long as it's unique. That's why we use the 'gensymSeed' upvalue.
 *
 * @memberof util
 * @inner
 */

export var gensym = (function (prefix) {
	var gensymSeed = 0;
	return function () {
		gensymSeed += 1;
		return '' + (prefix != null ? prefix : 'gensym-') + gensymSeed;
	};
})();

/**
 * Y combinator.
 *
 * @memberof util.functional
 * @inner
 */

export function Y(f) {
	return (function (g) {
		return g(g);
	})(function (g) {
		return f(function () {
			return g(g).apply(this, arguments);
		});
	});
}

/**
 * Identity function.
 *
 * @memberof util.functional
 * @inner
 */

export function I(x) {
	return x;
}

/**
 * Does nothing.
 *
 * @memberof util.functional
 * @inner
 */

export function NOP() {
	return;
}

/**
 * Universal comparison function.  Uses the builtin JavaScript type-safe equality and less-than
 * operators to do the comparison.
 *
 * @memberof util.functional
 * @inner
 *
 * @param {any} a First operand.
 * @param {any} b Second operand.
 *
 * @returns {number} Zero if operands are equal, -1 if the first operand compares less than the
 * second, and +1 if the first operand compares greater than the second.
 */

export function universalCmp(a, b) {
	return a === b ? 0 : a < b ? -1 : 1;
}

// IE does not have Number.EPSILON so set it according to 2 ^ -52 which what it "should" be for
// JavaScript floating point arithmetic.  (JavaScript uses doubles, which are 64 bits wide and have
// a 53-bit significand in the IEEE 754 floating point specification.)
//
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON

if (Number.EPSILON == null) {
	Number.EPSILON = Math.pow(2, -52);
}

export var getComparisonFn = (function () {
	var cmpFn = {};

	var floatSafe_equalp = function (n, m) {
		var epsilon = Number.EPSILON;

		/*
		var biggerEpsilon = 0.0000000001;

		if (Math.abs(n - m) > epsilon && Math.abs(n - m) < biggerEpsilon) {
			log.error('FLOATING POINT WEIRDNESS: %s <=> %s', n, m);
		}
		*/

		return Math.abs(n - m) < epsilon;
	};

	// Dates and times are stored as Moment instances, so we need to compare them accordingly.

	cmpFn.date = function (a, b) {
		if (a == null || b == null) {
			return a == b ? 0 : a == null ? -1 : 1;
		}

		if (!moment.isMoment(a) && !moment.isMoment(b)) {
			return a < b ? -1 : a > b ? 1 : 0;
		}
		else if (moment.isMoment(a) && moment.isMoment(b)) {
			return a.isBefore(b) ? -1 : a.isAfter(b) ? 1 : 0;
		}
		else {
			console.warn('Cannot compare Moment w/ non-Moment');
			return 0;
		}
	};
	cmpFn.time = cmpFn.date;
	cmpFn.datetime = cmpFn.date;

	// TODO: i18n
	cmpFn.month = function (a, b) {
		var trans = {'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
			'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12};

		var a_month = trans[a];
		var b_month = trans[b];

		return a_month == null ? -1
			: b_month == null ? 1
			: a_month < b_month ? -1
			: a_month > b_month ? 1
			: 0;
	};

	// TODO: i18n
	cmpFn.day_of_week = function (a, b) {
		var trans = {'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6};

		var a_num = trans[a];
		var b_num = trans[b];

		return a_num == null ? -1
			: b_num == null ? 1
			: a_num < b_num ? -1
			: a_num > b_num ? 1
			: 0;
	};

	// TODO: i18n
	cmpFn.year_and_month = function (a, b) {
		var trans = {'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
			'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12};

		var regexp = /^(\d{4}) (\w{3})$/;
		var m;

		var a_year, a_month, b_year, b_month;

		if ((m = regexp.exec(a)) != null) {
			a_year = toInt(m[1]);
			a_month = trans[m[2]];
		}
		if (m == null || a_month == null) {
			return -1;
		}

		if ((m = regexp.exec(b)) != null) {
			b_year = toInt(m[1]);
			b_month = trans[m[2]];
		}
		if (m == null || b_month == null) {
			return 1;
		}

		return a_year < b_year ? -1
			: a_year > b_year ? 1
			: a_month < b_month ? -1
			: a_month > b_month ? 1
			: 0;
	};

	if (window.Intl && window.Intl.Collator) {
		var collator = window.Intl.Collator(undefined, { usage: 'sort', sensitivity: 'base' });

		cmpFn.string = function (a, b) {
			if (a == null || b == null) {
				return a == b ? 0 : a == null ? -1 : 1;
			}

			return collator.compare(a, b);
		};
	}
	else {
		cmpFn.string = function (a, b) {
			if (a == null || b == null) {
				return a == b ? 0 : a == null ? -1 : 1;
			}

			return a < b ? -1 : a > b ? 1 : 0;
		};
	}

	cmpFn.number = function (a, b) {
		// We *should* only be comparing numbers with the same representation, but just to be safe we
		// allow comparisons among different representations.

		// First, make sure that we are handling comparisons with undefined/null consistently.  You'd
		// think this would work just fine based on the fallback to universalCmp below... or at least,
		// that's what I thought.  But that's wrong, and I'm not sure why.  Doing it here makes it very
		// obvious what we're trying to accomplish, and more importantly, actually makes it work right.

		if (a == null || b == null) {
			return a == b ? 0 : a == null ? -1 : 1;
		}

		// Second, handle the common case of comparisons between the same representation.

		if (typeof a === 'number' && typeof b === 'number') {
			if (EXPERIMENTAL_FEATURES['Safe Float Equality']) {
				return floatSafe_equalp(a, b) ? 0 : a < b ? -1 : 1;
			}
			else {
				return a < b ? -1 : a > b ? 1 : 0;
			}
		}
		else if (numeral.isNumeral(a) && numeral.isNumeral(b)) {
			if (EXPERIMENTAL_FEATURES['Safe Float Equality']) {
				return floatSafe_equalp(a.value(), b.value()) ? 0 : a.value() < b.value() ? -1 : 1;
			}
			else {
				return a.value() < b.value() ? -1 : a.value() > b.value() ? 1 : 0;
			}
		}
		else if (BigNumber.isBigNumber(a) && BigNumber.isBigNumber(b)) {
			// No need to perform a separate check for safer float comparison because BigNumber values
			// are inherently as precise as they need to be.
			return a.lt(b) ? -1 : a.gt(b) ? 1 : 0;
		}

		// Third, handle comparisons between different representations.

		if (numeral.isNumeral(a)) {
			if (BigNumber.isBigNumber(b)) {
				return b.gt(a.value()) ? -1 : b.lt(a.value()) ? 1 : 0;
			}
			else if (typeof b === 'number') {
				return a.value() < b ? -1 : a.value() > b ? 1 : 0;
			}
			else {
				return universalCmp(a, b);
			}
		}
		else if (BigNumber.isBigNumber(a)) {
			if (numeral.isNumeral(b)) {
				return a.lt(b.value()) ? -1 : a.gt(b.value()) ? 1 : 0;
			}
			else if (typeof b === 'number') {
				return a.lt(b) ? -1 : a.gt(b) ? 1 : 0;
			}
			else {
				return universalCmp(a, b);
			}
		}
		else if (typeof a === 'number') {
			if (BigNumber.isBigNumber(b)) {
				return b.gt(a) ? -1 : b.lt(a) ? 1 : 0;
			}
			else if (numeral.isNumeral(b)) {
				return a < b.value() ? -1 : a > b.value() ? 1 : 0;
			}
			else {
				return universalCmp(a, b);
			}
		}
		else {
			return universalCmp(a, b);
		}
	};

	cmpFn.currency = cmpFn.number;

	cmpFn.array = function (a, b) {
		return arrayCompare(a, b);
	};

	return {
		byType: (function (type) {
			return cmpFn[type] || types.registry.get(type).compare;
		}),
		byValue: (function (val) {
			if (typeof val === 'number' || numeral.isNumeral(val) || BigNumber.isBigNumber(val)) {
				return cmpFn.number;
			}
			else if (moment.isMoment(val)) {
				return cmpFn.date;
			}
			else if (_.isArray(val)) {
				return cmpFn.array;
			}
			else {
				return cmpFn.string;
			}
		})
	};
})();

export function getNatRep(x) {
	if (numeral.isNumeral(x)) {
		return x.value();
	}
	else if (moment.isMoment(x)) {
		return x.unix();
	}
	else {
		return x;
	}
}

/**
 * Call a chain of functions, such that each function consumes as its arguments the result(s) of
 * the previous function.
 *
 * @param {array} #0 The arguments to pass to the first function in the chain.  If it's not an
 * array, that's OK.  An array of multiple elements gets turned into multiple arguments for the
 * first function in the chain.
 *
 * @param {function} ... The functions to call in a chain.
 *
 * @returns {any} Whatever the result of calling the last function in the chain is.
 */

export function chain() {
	var args = Array.prototype.slice.call(arguments);
	var fnArgs = args.shift();
	var fn;

	while (args.length > 0) {
		fn = args.shift();

		if (!(fnArgs instanceof Array)) {
			fnArgs = [fnArgs];
		}

		if (typeof fn !== 'function') {
			return fnArgs;
		}

		fnArgs = fn.apply(null, fnArgs);
	}

	return fnArgs;
}

/**
 * Build a function that invokes a chain of function calls, where each function consumes as its
 * arguments the result of the previous call (converting an array into separate arguments).  The
 * arguments of the function thus produced are the arguments for the first function in the chain.
 *
 * @param {function} ... The functions to chain together.
 *
 * @returns {function} A function that takes any number of arguments; these are passed to the first
 * function in the chain.  The result of the last function of the chain is the return value.
 */

export function makeChain() {
	var fns = Array.prototype.slice.call(arguments);
	return function () {
		var args = Array.prototype.slice.call(arguments);
		return chain.apply(null, Array.prototype.concat.call([args], fns));
	};
}

export function makeArray() {
	return Array.prototype.slice.call(arguments);
}

/**
 * Call methods on an object, and build an object from the values which are passed to callbacks by
 * those methods.  In other words, it's a way to get results from multiple callback-taking methods
 * at the same time.
 *
 * @param {Function} cont
 * @param {Array.<Object.<fn:string, prop:string>>} spec
 * @param {Object} thisArg
 * @param {?Object} acc
 *
 * @example
 * trulyYours(cont, [{prop: a, fn: alpha}, {prop: b, fn: bravo}], target) =>
 *
 * var obj = {};
 * return target.alpha(function (x) {
 *   obj[a] = x;
 *   return target.bravo(function (y) {
 *     obj[b] = y;
 *     return cont(obj);
 *   });
 * });
 */
export function trulyYours(cont, spec, thisArg, acc) {
	acc = acc || {};
	return (spec.length === 0) ? cont(acc) : (function () {
		console.debug('[DataVis // Truly Yours] Calling #%s() to set property .%s', spec[0].fn, spec[0].prop);
		return (thisArg[spec[0].fn].bind(thisArg))(function (y) {
			acc[spec[0].prop] = (spec[0].conv || I)(y);
			return trulyYours(cont, spec.slice(1), thisArg, acc);
		});
	})();
}

export function asyncChain(fns, args, done) {
	var self = this;
	if (!_.isArray(fns)) {
		throw new Error('Call Error: `fns` must be an array');
	}
	if (!_.isArray(args)) {
		throw new Error('Call Error: `args` must be an array');
	}

	fns = shallowCopy(fns);
	var g = function () {
		if (fns.length === 0) {
			return done();
		}
		fns.shift().apply(self, args.concat(g));
	};
	return g();
}

/**
 * Partial application of a function.  Returns a new function that is a version of the argument
 * with some parameters already bound.  Also called Schönfinkelization.
 *
 * @param {function} f The function to curry.
 * @param {...any} args Arguments to bind in `f`.
 *
 * @returns {function} A function with free parameters corresponding to the parameters of `f`
 * which weren't bound by `args`.
 */

export function curry() {
	var curryArgs = Array.prototype.slice.call(arguments);
	var fn = curryArgs.shift();
	var placeholderIndex = curryArgs.indexOf('#');
	return function () {
		var args = Array.prototype.slice.call(arguments);
		var fnArgs = curryArgs.slice();
		var spliceArgs = placeholderIndex === -1 ? [fnArgs.length, 0] : [placeholderIndex, 1];
		Array.prototype.splice.apply(fnArgs, spliceArgs.concat(args));
		return fn.apply(this, fnArgs);
	};
}

export function curryCtor() {
	var args = Array.prototype.slice.call(arguments)
		, result = curry.apply(null, args);
	result.prototype = args[0].prototype;
	return result;
}

export function either() {
	var args = Array.prototype.slice.call(arguments);
	for (var i = 0; i < args.length; i += 1) {
		if (args[i] !== undefined) {
			return args[i];
		}
	}
	return undefined;
}

export function car(a) {
	return a[0];
}

export function cdr(a) {
	return a.slice(1);
}

// Conversion {{{1

/**
 * @namespace util.conversion
 */

export function isInt(x) {
	return (typeof x === 'string') ? String(parseInt(x, 10)) === x : +x === Math.floor(+x);
}

export function isFloat(x) {
	if (x === null || (typeof x === 'string' && x === '')) {
		// Because: +null => 0 ; +"" => 0
		return false;
	}

	return !isNaN(+x);
}

export function toInt(x) {
	return (typeof x === 'string') ? parseInt(x, 10) : Math.floor(+x);
}

export function toFloat(x) {
	return +x;
}

export var stringValueType = (function () {
	var re_date = new RegExp(/^\d{4}-\d{2}-\d{2}$/);
	var re_time = new RegExp(/^\d{2}:\d{2}:\d{2}$/);
	var re_datetime = new RegExp(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  var re_number = new RegExp(/(^-?[1-9]{1}[0-9]{0,2}(,?\d{3})*(\.\d+)?(e[+-]?\d+)?$)|(^0(e[+-]?\d+)?$)|(^-?0?\.\d+(e[+-]?\d+)?$)/);
	var re_comma = new RegExp(/,/g);
  return function p(s) {
		var guess;
		if (re_date.test(s)) {
			return 'date';
		}
		else if (re_time.test(s)) {
			return 'time';
		}
		else if (re_datetime.test(s)) {
			return 'datetime';
		}
		else if (typeof s === 'string' && s.startsWith('{') && s.endsWith('}')) {
			return 'json';
		}
		else if (typeof s === 'string' && s.startsWith('[') && s.endsWith(']')) {
			return 'json';
		}
		else if (typeof s === 'string' && s.charAt(0) === '$') {
			guess = p(s.substring(1));
      return guess === 'number' ? 'currency' : 'string';
    }
    else if (typeof s === 'string' && s.charAt(0) === '(' && s.charAt(s.length - 1) === ')') {
			guess = p(s.substring(1, s.length - 1));
			return ['number', 'currency'].indexOf(guess) >= 0 ? guess : 'string';
    }
    else {
      return re_number.test(s) ? 'number' : 'string';
    }
  };
})();

export var parseNumber = (function () {
  var re_number = new RegExp(/(^-?[1-9]{1}[0-9]{0,2}(,?\d{3})*(\.\d+)?(e[+-]?\d+)?$)|(^0(e[+-]?\d+)?$)|(^-?0?\.\d+(e[+-]?\d+)?$)/);
	var re_comma = new RegExp(/,/g);
  return function p(s, resultType) {
		if (typeof s !== 'string') {
			throw new Error('Call Error: `s` must be a string');
		}
		if (resultType != null && typeof resultType !== 'string') {
			throw new Error('Call Error: `resultType` must be null or a string');
		}

		if (resultType == null) {
			resultType = 'number';
		}

		if (['number', 'string'].indexOf(resultType) < 0) {
			throw new Error('Call Error: `resultType` must be one of: ["number", "string"]');
		}

    if (s.charAt(0) === '$') {
      return p(s.substring(1));
    }
    else if (s.charAt(0) === '(' && s.charAt(-1) === ')') {
      return p(s.substring(1, s.length - 1)) * -1;
    }
    else {
      return !re_number.test(s) ? null
        : s.indexOf('.') >= 0 || s.indexOf('e') >= 0 ? (resultType === 'number' ? parseFloat : I)(s.replace(re_comma, ''))
        : (resultType === 'number' ? parseInt : I)(s.replace(re_comma, ''));
    }
  };
})();

/**
 * Convert from a string to an integer.
 *
 * @param {any} x Value to attempt to convert.
 *
 * @returns {number} The value as an integer number, or 0 if the value is not something which can
 * be converted cleanly.
 */

export function tryIntConvert(x) {
	return isInt(x) ? toInt(x) : 0;
}

/**
 * Convert from a string to a float.
 *
 * @param {any} x Value to attempt to convert.
 *
 * @returns {number} The value as a floating point number, or 0.0 if the value is not something
 * which can be converted cleanly.
 */

export function tryFloatConvert(x) {
	return isFloat(x) ? toFloat(x) : 0.0;
}

// Data Structures {{{1

/**
 * @namespace util.data_structures
 */

/**
 * @memberof util.data_structures
 * @inner
 */

export function arrayCompare(a, b) {
	if (!_.isArray(a) || !_.isArray(b)) {
		throw new Error('Call Error: arguments must be arrays');
	}

	if (a.length !== b.length) {
		throw new Error('Call Error: arguments must have the same length');
	}

	for (var i = 0; i < a.length; i += 1) {
		if (a[i] < b[i]) {
			return -1;
		}
		else if (a[i] > b[i]) {
			return 1;
		}
	}

	return 0;
}

/**
 * @memberof util.data_structures
 * @inner
 */

export function arrayEqual(a, b) {
	if (!_.isArray(a) || !_.isArray(b)) {
		throw new Error('Call Error: arguments must be arrays');
	}

	if (a.length !== b.length) {
		return false;
	}

	return arrayCompare(a, b) === 0;
}

export function moveArrayElement(a, fromIdx, toIdx) {
	var elt = a[fromIdx];
	a.splice(fromIdx, 1);
	a.splice(toIdx, 0, elt);
}

/**
 * Calls a function on each element in a list until a certain value is returned.
 *
 * @memberof util.data_structures
 * @inner
 *
 * @param {array} l List to iterate over.
 * @param {function} f Function to invoke on each element.  Called like: f(item, index).
 * @param {any} r Return value that causes the iteration to abort.
 *
 * @returns {void} Nothing.
 */

export function eachUntil(l, f, r) {
	var i;
	for (i = 0; i < l.length; i += 1) {
		if (f(l[i], i) === r) {
			return;
		}
	}
}

/**
 * Calls a function on each key/value pair in an object until the function returns a certain value.
 * This is mainly useful as a sort of short-circuited version of `_.each()` or a version of
 * `_.every()` that works on objects.  This contrived example only goes through as many keys as
 * necessary to determine that one of them is "TERMINATE."
 *
 * ```
 * if (!eachUntilObject(o, (v, k) => { k.toUpperCase() }, "TERMINATE")) {
 *   console.log('Object contains TERMINATE key!');
 * }
 * ```
 *
 * @memberof util.data_structures
 * @inner
 *
 * @param {object} o
 * The object to iterate over.
 *
 * @param {function} f
 * Function to call like this: `f(value, key, extra)`
 *
 * @param {any} r
 * If `f` returns `r` then this function returns false.
 *
 * @param {any} [extra]
 * A "userdata" type of argument passed to `f`.
 *
 * @return {boolean}
 * False if `f` returned `r` for some key/value pair in the object, and true otherwise.
 */

export function eachUntilObj(o, f, r, extra) {
	for (var k in o) {
		if (Object.prototype.hasOwnProperty.call(o, k) && f(o[k], k, extra) === r) {
			return false;
		}
	}
	return true;
}

/**
 * Call an asynchronous function for each element in a list.
 *
 * @param {object[]} args
 * The list to iterate over.
 *
 * @param {function} fun
 * An asynchronous function.  The arguments passed to it are: (1) the next element of `args`,
 * (2) the index, and (3) a callback function to continue iterating.
 *
 * @param {function} [done]
 * A function called when we're done.
 */

export function asyncEach(args, fun, done) {
	if (!_.isArray(args)) {
		throw new Error('Call Error: `args` must be an array');
	}
	if (typeof fun !== 'function') {
		throw new Error('Call Error: `fun` must be a function');
	}
	if (done != null && typeof done !== 'function') {
		throw new Error('Call Error: `done` must be null or a function');
	}

	args = shallowCopy(args);
	var i = 0;
	function g() {
		if (args.length === 0) {
			return typeof done === 'function' ? done() : null;
		}
		return fun(args.shift(), i++, g);
	}
	return g();
}

/**
 * Map a function over an array, stopping after a preset number of elements.
 *
 * @memberof util.data_structures
 * @inner
 *
 * @param {any[]} a
 * An array of items.
 *
 * @param {function} f
 * The function to map.
 *
 * @param {number} l
 * Maximum number of elements to process.
 *
 * @return {any[]}
 * An array of size `min(a.length, l)` containing the mapped results.
 */

export function mapLimit(a, f, l) {
	var result = [];
	for (var i = 0; i < Math.min(a.length, l); i += 1) {
		result.push(f(a[i], i));
	}
	return result;
}

/**
 * Create a shallow copy of an object.
 *
 * @memberof util.data_structures
 * @inner
 *
 * @param {any} x
 * The thing to copy.
 *
 * @return {any}
 * A shallow copy of the argument.
 */

export var shallowCopy = function (x) {
	if (x == null) {
		return {};
	}

	var result;

	if (jQuery.isArray(x)) {
		result = [];

		for (var i = 0; i < x.length; i += 1) {
			result[i] = x[i];
		}

		return result;
	}
	else if (jQuery.isPlainObject(x)) {
		result = {};

		for (var k in x) {
			if (Object.prototype.hasOwnProperty.call(x, k)) {
				result[k] = x[k];
			}
		}

		return result;
	}
	else {
		return x;
	}
};

export var arrayCopy = deepCopy;

/**
 * Returns true if the argument is null or undefined.
 *
 * @memberof util.data_structures
 * @inner
 * @deprecated
 */

export function isNothing(x) {
	return x === undefined || x === null;
}

/**
 * Returns true if the object doesn't have any properties.
 *
 * @memberof util.data_structures
 * @inner
 * @deprecated
 */

export function isEmpty(o) {
	var numProps = 0;

	_.each(o, function () {
		numProps += 1;
	});

	return numProps === 0;
}

/**
 * @memberof util.data_structures
 * @inner
 */

export function deepDefaults() {
	var args = Array.prototype.slice.call(arguments)
		, base;

	if (args[0] === true) {
		args.shift();
		base = args.shift();
	}
	else {
		base = deepCopy(args.shift());
	}

	var f = function (dst, src) {
		_.each(src, function (v, k) {
			if (dst[k] === undefined) {
				dst[k] = (typeof v === 'object' && v != null) ? deepCopy(v) : v;
			}
			else if (_.isObject(dst[k]) && _.isObject(v)) {
				f(dst[k], v);
			}
		});
	};

	_.each(args, function (arg) {
		f(base, arg);
	});

	return base;
}

/**
 * Safely get the value of a property path in an object, even if some properties in the path don't
 * exist.  Returns the value of the last property in the path, or undefined if some elements in
 * the path don't exist in the object.
 *
 * @memberof util.data_structures
 * @inner
 *
 * @param {object} obj The object to search for the property path.
 * @param {...(string|number)} prop Property path to traverse.
 *
 * @returns {any} The value of the property found at the end of the provided path, or undefined if
 * the path cannot be traversed at any step of the way.
 *
 * @example
 * var obj = {a: {b: 2}};
 *
 * getProp(obj, 'a', 'b');  // 2
 * getProp(obj, 'a');		  // {b: 2}
 * getProp(obj, 'a', 'x');  // undefined
 * getProp(obj, 'x');		  // undefined
 */

export function getProp() {
	var args = Array.prototype.slice.call(arguments)
		, o = args.shift()
		, i;

	args = _.flatten(args);

	for (i = 0; o !== undefined && o !== null && i < args.length; i += 1) {
		o = o[args[i]];
	}

	return i < args.length ? undefined : o;
}

/**
 * Safely get the value of a property path in an object, even if some properties in the path don't
 * exist.  Returns the value of the last property in the path, or a default value if some elements
 * in the path don't exist in the object.
 *
 * @memberof util.data_structures
 * @inner
 *
 * @param {any} value The default value to return if the property doesn't exist.
 * @param {object} obj The object to search for the property within.
 * @param {...(string|number)} prop Property path to traverse.
 *
 * @example
 * var obj = {a: {b: 2}};
 *
 * getPropDef(1, obj, 'a', 'b');		// 2
 * getPropDef(1, obj, 'a', 'b', 'c'); // 1
 * getPropDef(1, obj, 'a', 'x');		// 1
 * getPropDef(1, obj, 'x');			// 1
 */

export function getPropDef() {
	var args = Array.prototype.slice.call(arguments);
	var d = args.shift();
	var p = getProp.apply(undefined, args);
	return p !== undefined ? p : d;
}

/**
 * Set a value for a property path in an object.
 *
 * @memberof util.data_structures
 * @inner
 *
 * @param {any} value The value to set for the property.
 * @param {object} obj The object to set the property within.
 * @param {...(string|number)} prop Property path to traverse before setting the value.
 *
 * @example
 * var obj = {};
 * setProp(42, obj, 'a', 'b', 'c');
 * obj.a.b.c === 42;
 */

export function setProp() {
	var args = Array.prototype.slice.call(arguments);
	var x = args.shift();
	var o = args.shift();

	args = _.flatten(args);

	for (var i = 0; i < args.length - 1; i += 1) {
		if (o[args[i]] == null) {
			o[args[i]] = _.isNumber(args[i]) ? [] : {};
		}

		o = o[args[i]];
	}

	o[args[args.length - 1]] = x;
}

/**
 * @memberof util.data_structures
 * @inner
 */

export function setPropDef() {
	var args = Array.prototype.slice.call(arguments);
	var x = args.shift();
	var o = args.shift();

	args = _.flatten(args);

	for (var i = 0; i < args.length - 1; i += 1) {
		if (o[args[i]] === undefined) {
			o[args[i]] = _.isNumber(args[i]) ? [] : {};
		}

		o = o[args[i]];
	}

	if (o[args[args.length - 1]] === undefined) {
		o[args[args.length - 1]] = x;
	}
}

/**
 * Copy properties from one object to another.
 *
 * @param {object} src
 * Where to copy properties from.
 *
 * @param {object} dest
 * Where to copy properties to.
 *
 * @param {string[]} props
 * Array of properties to copy.
 *
 * @param {object} opts
 * Additional options.
 *
 * @param {boolean} [opts.followPrototype=false]
 * If true, follow the prototype chain; the default behavior is that `src` must have its own
 * property with the specified name for it to be copied.
 */

export function copyProps(src, dest, props, opts) {
	opts = opts || {};

	_.each(props, function (p) {
		if (Object.prototype.hasOwnProperty.call(src, p) || (opts.followPrototype && p in src)) {
			dest[p] = src[p];
		}
	});
}

/**
 * Throw an exception if a property is missing.
 *
 * @param {function} exn Constructor used to instantiate an exception if an error arises.
 * @param {object} obj Target object to search within.
 * @param {...(string|number)} prop Property path.
 */

export function needProp() {
	var args = Array.prototype.slice.call(arguments)
		, exn = args.shift()
		, prop = getProp.apply(this, args);

	if (prop === undefined) {
		throw new exn('Missing property: [' + args.slice(1).join('.') + ']');
	}

	return prop;
}

/**
 * Throw an exception if a property is missing or not a member of a set.
 *
 * @param {object} obj Target object to search within.
 * @param {...(string|number)} prop Property path.
 * @param {array} arr Set of values which the property must be in.
 */

export function needPropIn() {
	var args = Array.prototype.slice.call(arguments)
		, set = args.pop()
		, prop = needProp.apply(this, args);

	if (set.indexOf(prop) === -1) {
		throw new Error('Property [' + args.slice(1).join('.') + '] must be one of: {"' + set.join('", "') + '"}');
	}

	return prop;
}

/**
 * Throw an exception if a property is missing or not an array.
 *
 * @param {function} exn Constructor used to instantiate an exception if an error arises.
 * @param {object} obj Target object to search within.
 * @param {...(string|number)} prop Property path.
 */

export function needPropArr() {
	var args = Array.prototype.slice.call(arguments)
		, exn = args[0]
		, prop = needProp.apply(this, args);

	if (!_.isArray(prop)) {
		throw new exn('Property [' + args.slice(1).join('.') + '] must be an array');
	}

	return prop;
}

/**
 * Throw an exception if a property is missing or not an object.
 *
 * @param {function} exn Constructor used to instantiate an exception if an error arises.
 * @param {object} obj Target object to search within.
 * @param {...(string|number)} prop Property path.
 */

export function needPropObj() {
	var args = Array.prototype.slice.call(arguments)
		, exn = args[0]
		, prop = needProp.apply(this, args);

	if (!_.isObject(prop)) {
		throw new exn('Property [' + args.slice(1).join('.') + '] must be an object');
	}

	return prop;
}

/**
 * Throw an exception if a property is missing or not an instance of a class.
 *
 * @param {function} exn Constructor used to instantiate an exception if an error arises.
 * @param {object} obj Target object to search within.
 * @param {...string|number} prop Property path.
 * @param {function} cls Class which the property must be an instance of.
 */

export function needPropInst() {
	var args = Array.prototype.slice.call(arguments)
		, exn = args[0]
		, cls = args.pop()
		, prop = needProp.apply(this, args);

	if (!(prop instanceof cls)) {
		throw new exn('Property [' + args.slice(1).join('.') + '] must be an instance of ' + cls.name);
	}

	return prop;
}

export function needArgInst(val, varName, cls) {
	needArg(val, varName);
	var msg = arguments.callee.name + '(): Argument "' + varName + '" must be an instance of ' + cls.name;

	if (!(val instanceof cls)) {
		console.error(msg + ', received: %O', val);
		throw new Error(msg);
	}

	return val;
}

export function needArg(val, varName) {
	var msg = arguments.callee.name + '(): Missing required argument "' + varName + '"';

	if (isNothing(val)) {
		throw new Error(msg);
	}

	return val;
}

export function iota(a, b, step) {
	var r = []
		, start
		, end;

	if (b == null) {
		start = 0;
		end = a;
	}
	else {
		start = a;
		end = b;
	}

	if (step == null) {
		step = 1;
	}

	for (var i = start; i <= end; i += step) {
		r.push(i);
	}

	return r;
}

/**
 * Prune a subtree in an object.  This means to prune the leaf, and then if there are no other
 * leaves on that branch, prune the branch, and so on all the way up.
 *
 * @example pruneTree(OBJECT, PATH...)
 */

export function pruneTree() {
	var args = Array.prototype.slice.call(arguments);
	var o = args.shift();
	var deleteFrom = [];
	var i;

	for (i = 0; i < args.length; i += 1) {
		if (o[args[i]] !== undefined) {
			deleteFrom.push(o);
			if (_.isObject(o[args[i]])) {
				o = o[args[i]];
				continue;
			}
		}

		break;
	}

	for (i = deleteFrom.length - 1; i >= 0; i -= 1) {
		delete deleteFrom[i][args[i]];
		if (!isEmpty(deleteFrom[i])) {
			break;
		}
	}
}

export function interleaveWith(a, x) {
	var result = [];

	if (a.length > 0) {
		result.push(a[0]);
	}

	for (var i = 1; i < a.length; i += 1) {
		result.push(x);
		result.push(a[i]);
	}

	return result;
}

/**
 * Stable sort algorithm that allows for responsive browser UI.
 */

export function mergeSort(data, cmp, cont) {
	cmp = cmp || universalCmp;
	return Y(function (recur) {
		return function (data, cont) {
			function merge(left, right, cont) {
				var result = [];
				while (left.length !== 0 && right.length !== 0) {
					var cmpResult = cmp(left[0], right[0]);
					if (!_.isNumber(cmpResult)) {
						throw 'comparison result returned non-number';
					}
					result.push(cmpResult <= 0 ? left.shift() : right.shift());
				}
				window.setTimeout(function () {
					cont(result.concat(left.length > 0 ? left : right));
				}, 0);
			}
			if (data.length <= 1) {
				window.setTimeout(function () {
					cont(data);
				}, 0);
			}
			else {
				var pivot = Math.floor(data.length / 2);
				window.setTimeout(function () {
					recur(data.slice(0, pivot), function (left) {
						window.setTimeout(function () {
							recur(data.slice(pivot), function (right) {
								window.setTimeout(function () {
									merge(left, right, cont);
								}, 0);
							});
						}, 0);
					});
				}, 0);
			}
		};
	})(data, cont);
}

export function mergeSort2(data, cmp) {
	cmp = cmp || function (a, b) { return a < b; };

	var merge = function (left, right) {
		var result = []
			, leftLen = left.length
			, leftIdx = 0
			, rightLen = right.length
			, rightIdx = 0;
		while (leftIdx < leftLen && rightIdx < rightLen) {
			var cmpResult = cmp(left[leftIdx], right[rightIdx]);
			result.push(cmpResult ? left[leftIdx++] : right[rightIdx++]);
		}
		return result.concat(leftIdx < leftLen ? left.slice(leftIdx) : right.slice(rightIdx));
	};

	if (data.length <= 1) {
		return data;
	}
	else {
		var pivot = Math.floor(data.length / 2)
			, left = mergeSort2(data.slice(0, pivot), cmp)
			, right = mergeSort2(data.slice(pivot), cmp);
		return merge(left, right);
	}
}

export function mergeSort3(data, cmp, cont, update) {
	cmp = cmp || function (a, b) { return a < b; };
	var size = data.length;
	var step = 0;
	var stepsBeforeUpdate = Math.min(data.length / 50, 500);

	function merge(left, right) {
		var result = []
			, leftLen = left.length
			, leftIdx = 0
			, rightLen = right.length
			, rightIdx = 0;
		while (leftIdx < leftLen && rightIdx < rightLen) {
			var cmpResult = cmp(left[leftIdx], right[rightIdx]);
			result.push(cmpResult ? left[leftIdx++] : right[rightIdx++]);
		}
		return result.concat(leftIdx < leftLen ? left.slice(leftIdx) : right.slice(rightIdx));
	}

	function sort(data, cont) {
		if (data.length <= 1) {
			return cont(data);
		}
		else {
			var pivot = Math.floor(data.length / 2);
			return sort(data.slice(0, pivot), function (left) {
				return sort(data.slice(pivot), function (right) {
					var fn = function () {
						return cont(merge(left, right, cont));
					};
					step += 1;
					if (step % stepsBeforeUpdate === 0) {
						if (typeof update === 'function') {
							update(step, size);
						}
						return window.setTimeout(fn);
					}
					else {
						return fn();
					}
				});
			});
		}
	}

	return sort(data, cont);
}

/**
 * Non-recursive merge sort, mostly taken from: https://stackoverflow.com/questions/1557894/
 * Breaks for update every "merge" which happens log_2(n) times.
 */

export var mergeSort4 = function (data, cmp, cont, update) {
	cmp = cmp || function (x, y) { return x < y; };
	var a = data;
	var num = data.length;
	var b = new Array(num);

	var rght, wid, rend;
	var i, j, m, t;

	var sortWindow = function (k) {
		for (var left=0; left+k < num; left += k*2 ) {
			rght = left + k;
			rend = rght + k;
			if (rend > num) rend = num;
			m = left; i = left; j = rght;
			while (i < rght && j < rend) {
				if (cmp(a[i], a[j])) {
					b[m] = a[i]; i++;
				} else {
					b[m] = a[j]; j++;
				}
				m++;
			}
			while (i < rght) {
				b[m]=a[i];
				i++; m++;
			}
			while (j < rend) {
				b[m]=a[j];
				j++; m++;
			}
			for (m=left; m < rend; m++) {
				a[m] = b[m];
			}
		}

		if (k < num) {
			if (typeof update === 'function') {
				update(k, num);
			}
			return window.setTimeout(function () {
				sortWindow(k * 2);
			});
		}
		else {
			return cont(a);
		}
	};

	sortWindow(1);
};

export function pigeonHoleSort(data, values, cont) {
	var o = {}
		, r = []
		, i
		, j
	;

	for (i = 0; i < values.length; i += 1) {
		o[values[i]] = [];
	}

	for (i = 0; i < data.length; i += 1) {
		if (o[data[i].sortSource] != null) {
			o[data[i].sortSource].push(data[i]);
		}
	}

	for (i = 0; i < values.length; i += 1) {
		for (j = 0; j < o[values[i]].length; j += 1) {
			r.push(o[values[i]][j]);
		}
	}

	return cont(r);
}

export function objGetPath(obj, fieldPath) {
	var i, len = fieldPath.length;
	for (i = 0; i < len && obj !== undefined; i += 1) {
		obj = obj[fieldPath[i]];
	}
	return obj;
}

export function cmpObjField(fieldPath, cmp) {
	cmp = cmp || universalCmp;
	return function (a, b) {
		a = objGetPath(a, fieldPath);
		b = objGetPath(b, fieldPath);
		if (!_.isString(a) && !_.isNumber(a) && !_.isDate(a)) {
			throw 'object "a" doesn\'t contain field path: ' + fieldPath.toString();
		}
		if (!_.isString(b) && !_.isNumber(b) && !_.isDate(b)) {
			throw 'object "b" doesn\'t contain field path: ' + fieldPath.toString();
		}
		return cmp(a, b);
	};
}

/**
 * Constructs an object from a simplified array representation.
 *
 * ```
 * objFromArray(['foo', 'bar', 'baz'])             => {foo: 0, bar: 1}
 * objFromArray(['foo', 'bar', 'baz'], ['a'])      => {foo: 'a', bar: 'a', baz: 'a'}
 * objFromArray(['foo', 'bar', 'baz'], ['a', 'b']) => {foo: 'a', bar: 'b', baz: 'a'}
 * ```
 *
 * @param {any[]} a
 * Items that will become the keys in the object.
 *
 * @param {any[]} [v]
 * Items that will become the values in the object.
 */

export function objFromArray(a, v) {
	return _.reduce(a, function (o, x, i) {
		o[x] = v ? v[i % v.length] : x;
		return o;
	}, {});
}

/**
 * Treating an object like a tree, descends through object values until it hits a non-object, then
 * calls the given function.
 *
 * @param object o The root of the tree.
 *
 * @param function f Callback to invoke, applied to the leaf and the path of keys taken to arrive
 * at that leaf.
 *
 * @param array acc Accumulator of the key path.
 */

export function walkObj(o, f, opts) {
	opts = deepDefaults(opts, {
		replace: false,
		callOnNodes: false
	});

	var walk = function (o, acc) {
		_.each(o, function (v, k) {
			var x;
			var newAcc = acc.slice();
			newAcc.push(k);

			if (opts.callOnNodes || !_.isObject(v) || _.isArray(v)) {
				x = f(v, newAcc);
			}

			if (opts.replace) {
				o[k] = v = x;
			}

			if (_.isObject(v)) {
				walk(v, newAcc);
			}
		});

		return o;
	};

	return walk(o, []);
}

// Object Orientation {{{1

// makeSubclass {{{2

/**
 * Create a function representing a subclass.
 *
 * ```
 * var Animal = makeSubclass('Animal', Object, function (name) {
 *   this.name = name;
 * }, {
 *   species: 'unknown species'
 * });
 *
 * Animal.prototype.printInfo = function () {
 *   console.log(this.name + ' is a ' + this.species + '.');
 * };
 *
 * var HouseFinch = makeSubclass('HouseFinch', Animal, null, {
 *   species: 'Haemorhous mexicanus'
 * });
 *
 * HouseFinch.prototype.printInfo = function () {
 *   self.super['Animal'].printInfo();
 *   console.log('He says: Tweet tweet!');
 * };
 *
 * var harold = new HouseFinch('Harold');
 * harold.printInfo();
 *
 * > Harold is a Haemorhous mexicanus.
 * > He says: Tweet tweet!
 * ```
 *
 * Within the source code, look to {@linkcode Aggregate} or {@linkcode GridTable} for some prime
 * examples.
 *
 * @param {function} parent
 * The parent class; use "Object" to create base classes.
 *
 * @param {function} [ctor]
 * Constructor for the subclass.  If not provided, a default constructor is used which simply calls
 * the superclass' constructor with all arguments.
 *
 * @param {object} [ptype]
 * Properties added to the resulting class' prototype.
 *
 * @return {function}
 * A constructor used to create new instances of the subclass.  The instance will get a `super`
 * property which can be used to invoke the superclass' methods on itself.
 */

export var makeSubclass = function (name, parent, ctor, ptype) {
	// Default constructor just calls the super constructor.

	if (typeof name !== 'string') {
		throw new Error('Call Error: `name` must be a string');
	}
	if (typeof parent !== 'function') {
		throw new Error('Call Error: `parent` must be a function');
	}
	if (ctor != null && typeof ctor !== 'function') {
		throw new Error('Call Error: `ctor` must be null or a function');
	}
	if (ptype != null && typeof ptype !== 'object') {
		throw new Error('Call Error: `ptype` must be null or an object');
	}

	if (ctor == null && parent !== Object) {
		ctor = function () {
			this.super[parent.name].ctor.apply(this, arguments);
		};
	}

	/**
	 * This becomes the actual constructor that's invoked by using the `new` operator.
	 */

	var subclass = function () {
		var childInst = this;

		// Create a reference to superclass methods that are bound to the current instance, so invoking
		// `self.super['BaseClass'].methodName()` calls the specified method of the base class, but with
		// the current instance as `this`.

		if (parent !== Object) {
			// console.log('[DataVis // Obj // Super] Creating %s#super[\'%s\']', childInst.constructor.name, parent.name);
			if (childInst.super == null) {
				childInst.super = {};
			}
			childInst.super[parent.name] = makeSuper(childInst, parent);
		}

		// Invoke the user's "constructor" if one was provided.  It would be pretty uncommon to not have
		// a user-supplied initializer.

		if (ctor != null) {
			ctor.apply(childInst, arguments);
		}
	};

	Object.defineProperty(subclass, 'name', {value: name});
	subclass.prototype = Object.create(parent.prototype);
	subclass.prototype.constructor = subclass;

	//subclass.prototype.__ctor = subclass;
	//subclass.prototype.__ctorname = name;

	_.each(ptype, function (v, k) {
		subclass.prototype[k] = v;
	});

	return subclass;
};

// makeSuper {{{2

/**
 * Creates an object to act as a proxy to superclass methods.  Probably best to not use this
 * directly, and instead let {@linkcode makeSubclass makeSubclass()} do the work for you.
 *
 * @param {object} childInst
 * An instance of the subclass.
 *
 * @param {function} parentCls
 * The superclass.
 *
 * @return {object}
 * An object containing proxies to superclass methods (bound to `child`).
 */

export var makeSuper = function (childInst, parentCls) {
	var superObj = {}
		, method;
	for (method in parentCls.prototype) {
		if (typeof parentCls.prototype[method] === 'function') {
			// console.log('[DataVis // Obj // Super] Binding %s#super[\'%s\'].%s to %s#%s', childInst.constructor.name, parentCls.name, method, parentCls.name, method);
			superObj[method] = _.bind(parentCls.prototype[method], childInst);
		}
	}
	superObj.ctor = _.bind(parentCls, childInst);
	return superObj;
};

// mixinEventHandling {{{2

export var mixinEventHandling = (function () {
	var HANDLER_ID = 0;

	return function (obj, events) {
		if (events != null) {
			obj.events = objFromArray(events);
		}

		obj._seenEvents = {};
		obj._eventHandlers = {
			byEvent: {},
			byId: {}
		};

		var getName = function (self) {
			if (typeof self.toString === 'function' && self.toString !== Object.prototype.toString) {
				return self.toString();
			}
			else {
				return obj.prototype.constructor.name.toUpperCase();
			}
		};

		var getTag = function (self) {
			if (typeof self.getDebugTag === 'function') {
				return self.getDebugTag();
			}
			else if (typeof self.toString === 'function' && self.toString !== Object.prototype.toString) {
				return self.toString();
			}
			else {
				return obj.prototype.constructor.name.toUpperCase();
			}
		};

		// #_initEventHandlers {{{3

		obj.prototype._initEventHandlers = function () {
			var self = this;

			if (self.eventHandlers == null) {
				self.eventHandlers = {};

				if (obj.events != null) {
					_.each(obj.events, function (evt) {
						self.eventHandlers[evt] = [];
					});
				}
			}

			if (self.eventHandlersById == null) {
				self.eventHandlersById = [];
			}
		};

		// #echo {{{3

		/**
		 * Echo events from a source, reproducing them ourselves.
		 *
		 * @param {object} src
		 * The source, it must have had `mixinEventHandling()` called on it as well.
		 *
		 * @param {string[]} evt
		 * List of events to echo.
		 *
		 * @param {object} opts
		 * Additional options to pass to the `on()` method.
		 */

		obj.prototype.echo = function (src, evt, opts) {
			var self = this;

			opts = opts || {};

			//self._initEventHandlers();

			if (!_.isArray(evt)) {
				evt = [evt];
			}
			_.each(evt, function (e, i) {
				if (typeof e !== 'string') {
					throw new Error('Call Error: `evt[' + i + ']` must be a string');
				}
				if (obj.events != null && obj.events[e] === undefined) {
					throw new Error('Unable to register handler on ' + getName(self) + ' for "' + e + '" event: no such event available');
				}
				src.on(e, function () {
					self.fire(e);
				}, opts);
			});
		};

		// #on {{{3

		obj.prototype.on = function (evt, cb, opts) {
			var self = this;

			opts = opts || {};

			self._initEventHandlers();

			if (!_.isArray(evt)) {
				evt = [evt];
			}

			_.each(evt, function (e) {
				if (obj.events != null && obj.events[e] === undefined) {
					throw new Error('Unable to register handler on ' + getName(self) + ' for "' + e + '" event: no such event available');
				}

				var handler = {
					id: HANDLER_ID++,
					who: opts.who,
					info: opts.info,
					cb: cb,
					limit: opts.limit
				};

				self.eventHandlers = self.eventHandlers || {};
				self.eventHandlers[e] = self.eventHandlers[e] || [];
				self.eventHandlers[e].push(handler);

				self.eventHandlersById = self.eventHandlersById || [];
				self.eventHandlersById[handler.id] = handler;

				var msg = 'Adding "' + evt + '" event handler on ' + getName(self);
				if (opts.who != null) {
					msg += ' from ' + opts.who;
				}
				console.debug('[DataVis // %s // On] %s',
					getTag(self), msg);
			});

			return self;
		};

		// #off {{{3

		obj.prototype.off = function (evt, who, opts) {
			var self = this;

			opts = opts || {};

			self._initEventHandlers();

			if (evt === '*') {
				_.each(obj.events, function (e) {
					self.off(e, who, opts);
				});
				return;
			}

			if (obj.events[evt] === undefined) {
				throw new Error('Unable to register handler on ' + getName(self) + ' for "' + evt + '" event: no such event available');
			}

			var newHandlers = [];

			_.each(self.eventHandlers[evt], function (handler, i) {
				if (handler == null) {
					// This handler has been removed, e.g. due to reaching the invocation limit.
					return;
				}

				if (who == null || handler.who === who) {
					// Remove from the ID lookup.  This is used to allow event handlers to be removed while
					// their event is being fired.

					self.eventHandlersById[handler.id] = null;
				}
				else {
					newHandlers.push(handler);
				}
			});

			if (!opts.silent) {
				console.debug('[DataVis // %s // Off] Removed %s handlers from %s on "%s" event',
					getTag(self), self.eventHandlers[evt].length - newHandlers.length, who, evt);
			}

			self.eventHandlers[evt] = newHandlers;
		};

		// #fire {{{3

		/**
		* @param {string} event
		*
		* @param {object} opts
		*
		* @param {boolean} opts.silent
		* If true, don't print a debugging log entry for sending the event.  This is useful for some
		* really spammy events which would otherwise slow down the console.
		*
		* @param {object|Array.<object>|function} opts.notTo
		* Indicates entities which should not receive the event.  Can either be the entity itself, a list
		* of entities, or a function which returns true when passed an entity which shouldn't receive the
		* event.  An entity here is registered in the `who` property of the handler.
		*/

		obj.prototype.fire = function () {
			var self = this
				, args = Array.prototype.slice.call(arguments)
				, evt = args.shift()
				, opts = args.shift() || {};

			self._initEventHandlers();

			if (obj.events[evt] === undefined) {
				throw new Error('Illegal event: ' + evt);
			}

			var handlers = [];

			_.each(self.eventHandlers[evt], function (handler, i) {
				if (handler == null) {
					// This handler has been removed, e.g. due to reaching the invocation limit.
					return;
				}

				// Check to see if this handler is for someone we shouldn't be sending to.
				//
				//   - `notTo` is an array (check memberof)
				//   - `notTo` is a function returning true
				//   - `notTo` is an object (direct comparison)

				if (handler.who && opts.notTo &&
						((_.isArray(opts.notTo) && opts.notTo.indexOf(handler.who) >= 0)
							|| (typeof opts.notTo === 'function' && opts.notTo(handler.who))
							|| (typeof opts.notTo === 'object' && opts.notTo === handler.who))) {
					return;
				}

				handlers.push({
					handler: handler,
					index: i
				});
			});

			// Print a debugging message unless invoked with the silent option (used internally to prevent
			// spamming millions of messages, which slows down the console).

			if (!opts.silent) {
				console.debug('[DataVis // %s // Fire] Triggering %d handlers for "%s" event on %s: %O',
					getTag(self), handlers.length, evt, getName(self), args);
			}

			// Execute all matching handlers in the order they were registered.  A break is added between
			// each handler's invocation using setTimeout().  This allows user interface changes made a
			// handler to be picked up by the browser.  An early handler is allowed to remove a later one.

			asyncEach(handlers, function (h, i, next) {
				if (self.eventHandlersById[h.handler.id] == null) {
					// This handler has been removed since we started firing for this event.  This happens one
					// an earlier event handler removes a later one.
					return;
				}

				if (h.handler.info != null) {
					console.debug('[DataVis // %s // Fire] Executing "%s" handler %O (%d of %d) on %s: %s',
						getTag(self), evt, h.handler.cb, i+1, handlers.length, getName(self), h.handler.info);
				}
				else {
					console.debug('[DataVis // %s // Fire] Executing "%s" handler %O (%d of %d) on %s',
						getTag(self), evt, h.handler.cb, i+1, handlers.length, getName(self));
				}
				h.handler.cb.apply(null, args);

				// Remove the handler if we've hit the limit of how many times we're supposed to invoke it.
				// Actually we just set the handler to null and remove it below.

				if (h.handler.limit) {
					h.handler.limit -= 1;
					if (h.handler.limit <= 0) {
						console.debug('[DataVis // %s // Fire] Removing "%s" handler #%d from %s after reaching invocation limit',
							getTag(self), evt, i+1, getName(self));
						self.eventHandlers[evt][h.index] = null;
					}
				}

				return opts.async ? window.setTimeout(next) : next();
			}, function () {
				if (!opts.silent) {
					console.debug('[DataVis // %s // Fire] Done triggering handlers for "%s" event on %s',
						getTag(self), evt, getName(self));
				}

				// Clean up handlers we removed (because they reached the limit).

				self.eventHandlers[evt] = _.without(self.eventHandlers[evt], null);
			});
		};

		// }}}3
	};
})();

// mixinLogging {{{2

/**
 * Adds logging methods to a class.
 *
 * @example
 * mixinLogging(ClassName);
 * mixinLogging(ClassName, 'Foo');
 * mixinLogging(ClassName, () => { return 'Foo(' + this.name + ')'; });
 *
 * this.logInfo(this.makeLogTag('Doing Stuff'), 'Log message goes here');
 *   => [DataVis // Foo(name) // Doing Stuff] Log message goes here
 *
 * this.disableDebugLog();
 * this.enableDebugLog();
 */

export function mixinLogging(obj, tagPrefix) {
	if (tagPrefix != null && typeof tagPrefix !== 'string' && typeof tagPrefix !== 'function') {
		throw new Error('Call Error: `tagPrefix` must be null, a string, or a function');
	}

	obj.prototype.makeLogTag = function (extra) {
		var self = this
			, prefix
			, tag = ['DataVis']
			, stack
			, m
			, lvl;

		if (typeof tagPrefix === 'string') {
			prefix = tagPrefix;
		}
		else if (typeof tagPrefix === 'function') {
			prefix = tagPrefix.call(self);
		}
		else if (typeof self.toString === 'function' && self.toString !== Object.prototype.toString) {
			prefix = self.toString();
		}
		else {
			prefix = obj.prototype.constructor.name;
			// Stack analysis works only on Chromium.
			//   0 : exception message
			//   1 : this function
			//   2 : caller
			//   3 : caller's caller &c
			// Named function in stack: "at foo (source)"
			// Anonymous function in stack: "at source"
			//   e.g. inside _.each(),
			//        keep going up stack until we find a named function
			// Keep in mind this is only when there's no toString() method.
			try {
				throw new Error;
			}
			catch (e) {
				stack = e.stack.split('\n');
				for (lvl = 2; lvl < stack.length; lvl += 1) {
					if ((m = stack[2].match(/^\s*at ([^\s]+) \(http[^)]+\)$/)) != null) {
						prefix += ' @ ' + m[1];
						break;
					}
					else if ((m = stack[2].match(/^\s*at http/)) != null) {
						// Lambda function... not useful at all?
						continue;
					}
					else {
						break;
					}
				}
			}
		}

		if (typeof prefix === 'string' && prefix.length > 0) {
			tag.push(prefix);
		}
		if (typeof extra === 'string' && extra.length > 0) {
			tag.push(extra);
		}

		return '[' + tag.join(' // ') + ']';
	};

	obj.prototype.disableDebugLog = function () {
		obj.prototype.logDebug = function () {};
	};

	obj.prototype.enableDebugLog = function () {
		obj.prototype.logDebug = window.console.debug.bind(window.console);
	};

	obj.prototype.logDebug = window.console.debug.bind(window.console);
	obj.prototype.logInfo = window.console.log.bind(window.console);
	obj.prototype.logWarning = window.console.warn.bind(window.console);
	obj.prototype.logError = window.console.error.bind(window.console);
}

// makeSetters {{{2

export function makeSetters(cls, setterList) {
	_.each(setterList, function (s) {
		cls.prototype[s.name] = function (x, opts) {
			opts = deepDefaults(opts, {
				sendEvent: true,
				dontSendEventTo: [],
			});
			this[s.prop] = x;
			if (s.event != null && opts.sendEvent) {
				this.fire(s.event, {
					notTo: opts.dontSendEventTo
				}, x);
			}
		};
	});
}

// delegate {{{2

export function delegate(from, to, methods) {
	if (!_.isArray(methods)) {
		methods = [methods];
	}
	_.each(methods, function (m, i) {
		if (typeof m !== 'string') {
			throw new Error('Call Error: `methods[' + i + ']` must be a string');
		}
		from.prototype[m] = function () {
			var args = Array.prototype.slice.call(arguments);
			if (this[to] == null) {
				console.error('Delegated property "' + to + '" does not exist.');
				return;
			}
			if (this[to][m] == null) {
				console.error('Delegated method "' + to + '.' + m + '" does not exist.');
				return;
			}
			return this[to][m].apply(this[to], args);
		};
	});
}

// setName {{{2

export function mixinNameSetting(cls) {
	cls.prototype.__namesGenerated = 0;
	cls.prototype.setName = function (name) {
		var self = this;

		if (name != null && !_.isString(name)) {
			self.name = self.constructor.name + ' #' + (++cls.prototype.__namesGenerated);
			self.logWarning(self.makeLogTag() + ' Name provided for this ' + self.constructor.name + ' instance is not a string.');
		}
		else if (name == null || name === '') {
			self.name = self.constructor.name + ' #' + (++cls.prototype.__namesGenerated);
			self.logWarning(self.makeLogTag() + ' Providing a name for this ' + self.constructor.name + ' instance is strongly recommended to improve logging.');
		}
		else {
			self.name = name;
		}
	};
	cls.prototype.getName = function () {
		var self = this;

		return self.name;
	};
}

// Locking {{{1

/**
 * @namespace util.locking
 */

/**
 * Locks exist because we may have multiple asynchronous chunks of JavaScript running at the same
 * time which interfere with each other.
 *
 * A really good example is preferences: loading them into the jQWidgets grid fires the event
 * handlers associated with changing all the items in the prefs.  The preferences contain column
 * widths, so loading them causes all the column resize event handlers to fire.  So we have a lock
 * for preferences.  We engage it when load the preferences, then the event handlers find the lock
 * engaged, so they don't try to save the preferences.  When the preferences are done loading, we
 * disengage the lock, and event handlers are free to save prefs again.
 */

/**
 * Engage the lock with the given name.
 */

export function lock(defn, name) {
	if (defn.locks === undefined) {
		defn.locks = {};
	}

	if (defn.locks[name] === undefined) {
		defn.locks[name] = 0;
	}

	defn.locks[name] += 1;
	debug.info('LOCK', 'Locking ' + name + ' - ' + defn.locks[name]);
}

/**
 * Disengage the lock with the given name.
 */

export function unlock(defn, name) {
	if (defn.locks === undefined) {
		defn.locks = {};
	}

	if (defn.locks[name] === undefined) {
		defn.locks[name] = 1;
	}

	defn.locks[name] -= 1;
	debug.info('LOCK', 'Unlocking ' + name + ' - ' + defn.locks[name]);
}

/**
 * Check to see if the lock with the given name is engaged or not.
 */

export function isLocked(defn, name) {
	return defn.locks && !!defn.locks[name];
}

// HTML {{{1

/**
 * @namespace util.html
 */

// outerHtml {{{2

/**
 * Returns the HTML used to construct the argument.
 */

export function outerHtml(elt) {
	return jQuery('<div>').append(elt).html();
}

// escapeHtml {{{2

/**
 * Escapes HTML metacharacters in a string.
 */

export function escapeHtml(elt) {
	return elt.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll("'", '&apos;');
}

// getText {{{2

/**
 * Get all the next nodes which are direct children of the specified nodes.
 *
 * @param selector jQuery selector used to search for nodes containing text
 * children.
 *
 * @return An array of strings, each element being the text of a node matched
 * by the specified selector.
 */

export function getText(selector) {
	return jQuery(selector).map(function (i, x) {
		return jQuery(x).text();
	});
}

// isVisible {{{2

export function isVisible(elt) {
	return elt.css('display') !== 'none' && elt.css('visibility') === 'visible';
}

// isElement {{{2

export function isElement(x) {
	return x instanceof Element || x instanceof jQuery;
}

// getElement {{{2

export function getElement(x) {
	return x instanceof Element ? x
		: x instanceof jQuery ? x.get(0)
		: null;
}

// isElementInViewport {{{2

/*
 * Taken from --
 *   https://stackoverflow.com/a/7557433/5628
 */

export function isElementInViewport (parent, elt) {
	if (elt instanceof jQuery) {
		elt = elt.get(0);
	}

	var eltRect = elt.getBoundingClientRect();

	if (eltRect.top < 0 || eltRect.left < 0) {
		return false;
	}

	if (parent !== window) {
		if (parent instanceof Element) {
			parent = jQuery(parent);
		}

		var parentRect = parent.get(0).getBoundingClientRect();
		//console.log('top=' + eltRect.top + ', ' +
		//						'left=' + eltRect.left + ', ' +
		//						'bottom=' + eltRect.bottom + ', ' +
		//						'height=' + (parent.innerHeight() + parentRect.top));
		return eltRect.bottom <= parent.innerHeight() + parentRect.top;
	}
	else {
		//console.log('top=' + eltRect.top + ', ' +
		//						'left=' + eltRect.left + ', ' +
		//						'bottom=' + eltRect.bottom + ', ' +
		//						'height=' + window.innerHeight);
		return eltRect.bottom <= window.innerHeight;
	}
}

// onVisibilityChange {{{2

export function onVisibilityChange(parent, elt, callback) {
	var old_visible;
	return function () {
		var visible = isElementInViewport(parent, elt);
		if (visible !== old_visible) {
			if (old_visible !== undefined && typeof callback == 'function') {
				callback(visible);
			}
			old_visible = visible;
		}
	};
}

// addFocusHandler {{{2

export function addFocusHandler(elt, id, cb) {
	jQuery(document).on('click.focus-' + id, function (evt) {
		if (jQuery(evt.target).closest(document).length === 0) {
			// Clicked element no longer on the page; ignore!  This could happen when another click
			// handler on the element (e.g. a button) caused it to be removed (e.g. the clicked button
			// closed a dialog).  In this case, there's nothing for us to do.
			return;
		}
		if (jQuery(evt.target).closest(elt).length === 1) {
			elt.addClass('wcdv-focus');
			cb(true);
		}
		else {
			elt.removeClass('wcdv-focus');
			cb(false);
		}
	});
}

// removeFocusHandler {{{2

export function removeFocusHandler(id) {
	jQuery(document).off('click.focus-' + id);
}

// fontAwesome {{{2

export function fontAwesome(icon, cls, title) {
	var span = jQuery('<span>')
		.addClass('fa');

	if (icon.substr(0, 3) === 'fa-') {
		span.addClass(icon);
	}
	else {
		span.text(String.fromCharCode(parseInt(icon, 16)));
	}

	if (cls != undefined) {
		span.addClass(cls);
	}

	if (title != undefined) {
		span.attr('title', title);
	}

	return span;
}

// loadScript {{{2

/**
 * @function loadScript
 * @description
 *
 * Dynamically load JavaScript from a URL into the page.
 *
 * Here's an example of using the `needAsyncSetup` option:
 *
 * ```
 * return loadScript('https://www.gstatic.com/charts/loader.js', function (wasAlreadyLoaded, k) {
 *   if (!wasAlreadyLoaded) {
 *     google.charts.load('current', {'packages':['corechart']});
 *     google.charts.setOnLoadCallback(k);
 *   }
 *   else {
 *     k();
 *   }
 * }, {
 *   needAsyncSetup: true
 * });
 * ```
 *
 * Calling `k()` *must* be done to properly unlock the loading code (only one file is loaded at a
 * time) but only after everything is fully set up.
 *
 * @param {string} url
 * The URL to load a script file from.
 *
 * @param {function} callback
 * A function that receives at least one argument, a boolean which is true if the script was already
 * loaded in the page.  The callback will not be called until the browser has finished executing the
 * script, so it can safely use anything that the script provides.  If the callback needs to perform
 * any additional setup before the loading is considered "complete" then use the `needAsyncSetup`
 * option as shown below.
 *
 * @param {object} [opts]
 * Additional options (see below).
 *
 * @param {boolean} [opts.needAsyncSetup = false]
 * If true, then the callback function receives an additional argument, another function *which it
 * must call* when finished.  This is specifically to support Google's JS API "loader" script, which
 * requires additional (asynchronous) setup.
 */

export var loadScript = (function () {
	var alreadyLoaded = {};
	var lock = new Lock('LOAD SCRIPT');
	return function (url, callback, opts) {
		_.defaults(opts, {
			needAsyncSetup: false
		});

		// https://stackoverflow.com/a/950146

		var load = function (url, callback) {
			// Adding the script tag to the head as suggested before
			var head = document.getElementsByTagName('head')[0];
			var script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = url;

			// Then bind the event to the callback function.
			// There are several events for cross browser compatibility.
			script.onreadystatechange = callback;
			script.onload = callback;

			// Fire the loading
			head.appendChild(script);
		};

		var makeCb = function (isAlreadyLoaded) {
			var showLoadMsg = function () {
				if (isAlreadyLoaded) {
					console.debug('[DataVis // Load Script] [url = %s] Already loaded', url);
				}
				else {
					console.debug('[DataVis // Load Script] [url = %s] Finished executing loaded script', url);
				}
			};

			if (opts.needAsyncSetup) {
				return function () {
					showLoadMsg();
					callback(isAlreadyLoaded, function () {
						console.debug('[DataVis // Load Script] [url = %s] Exiting control of the script loader', url);
						if (!isAlreadyLoaded) {
							alreadyLoaded[url] = true;
							lock.unlock();
						}
					});
				};
			}
			else {
				return function () {
					showLoadMsg();
					console.debug('[DataVis // Load Script] [url = %s] Exiting control of the script loader', url);
					if (!isAlreadyLoaded) {
						alreadyLoaded[url] = true;
						lock.unlock();
					}
					callback(isAlreadyLoaded);
				};
			}
		};

		lock.onUnlock(function () {
			if (alreadyLoaded[url]) {
				makeCb(true)();
			}
			else {
				lock.lock();
				load(url, makeCb(false));
			}
		}, sprintf.sprintf('Waiting to load [url = %s]', url));
	};
})();

// setTableCell {{{2

/**
 * Set the value of a table cell.
 *
 * @param {jQuery|HTMLTableCellElement} cell
 * @param {Element|jQuery|string|number} value
 * @param {object} opts
 * @param {string} opts.field
 * @param {OrdMap} opts.colConfig
 * @param {OrdMap} opts.typeInfo
 */

export function setTableCell(cell, value, opts) {
	opts = opts || {};

	var fcc = (opts.colConfig instanceof OrdMap && opts.colConfig.get(opts.field)) || opts.colConfig || {};
	var fti = (opts.typeInfo instanceof OrdMap && opts.typeInfo.get(opts.field)) || opts.typeInfo || {};
	var ops = opts.operations || [];

	if (cell instanceof jQuery) {
		cell = cell.get(0);
	}

	if (!(cell instanceof HTMLTableCellElement)) {
		throw new Error('Call Error: `cell` must be a HTMLTableCellElement instance');
	}

	var container = cell
		, wrapper
		, operationDiv;

	if (fcc.maxHeight != null && value !== '') {
		wrapper = document.createElement('div');
		wrapper.classList.add('wcdv_maxheight_wrapper');
		wrapper.style.maxHeight = fcc.maxHeight;

		if (fcc.width) {
			wrapper.classList.add('wcdv_maxheight_wrapper_withwidth');
			wrapper.style.width = fcc.width;
		}

		var showValueBtn = document.createElement('button');
		showValueBtn.setAttribute('title', 'Full value has been truncated; click to show it.');
		showValueBtn.classList.add('wcdv_icon_button');
		showValueBtn.classList.add('wcdv_icon_button_incell');
		showValueBtn.classList.add('wcdv_icon_button_nolabel');
		showValueBtn.classList.add('wcdv_show_full_value');

		var showValueSpan = document.createElement('span');
		showValueSpan.classList.add('fa');
		showValueSpan.classList.add('fa-asterisk');

		operationDiv = document.createElement('div');
		operationDiv.style.display = 'inline-block';
		operationDiv.style.float = 'right';

		_.each(ops, function (op, index) {
			operationDiv.appendChild(makeOperationButton('cell', op, index, {inCell: true}));
		});

		container = document.createElement('div');

		// cell (td)
		//   wrapper (div)
		//     showValueBtn (button)
		//       showValueSpan (span.fa)
		//     operationDiv (div)
		//       (button) (button) (button) ...
		//     container (div) <-- holds the actual data value

		cell.appendChild(wrapper);
		wrapper.appendChild(showValueBtn);
		showValueBtn.appendChild(showValueSpan);
		wrapper.appendChild(operationDiv);
		wrapper.appendChild(container);
	}
	else if (ops.length > 0) {
		wrapper = document.createElement('div');

		operationDiv = document.createElement('div');
		operationDiv.style.display = 'inline-block';
		operationDiv.style.float = 'right';

		_.each(ops, function (op, index) {
			var opBtn = makeOperationButton('cell', op, index, {inCell: true});
			if (op.disableWhen && op.disableWhen(value)) {
				opBtn.disabled = true;
			}
			if (op.hideWhen && op.hideWhen(value)) {
				opBtn.style.display = 'none';
			}

			operationDiv.appendChild(opBtn);
		});

		container = document.createElement('div');

		// cell (td)
		//   wrapper (div)
		//     operationDiv (div)
		//       (button) (button) (button) ...
		//     container (div) <-- holds the actual data value

		cell.appendChild(wrapper);
		wrapper.appendChild(operationDiv);
		wrapper.appendChild(container);
	}

	setElement(container, value, opts);
}

// setElement {{{2

/**
 * Set the value of an element.
 *
 * @param {jQuery|Element} container
 * @param {Element|jQuery|string|number} value
 * @param {object} opts
 * @param {string} opts.field
 * @param {OrdMap} opts.colConfig
 * @param {OrdMap} opts.typeInfo
 */

export function setElement(container, value, opts) {
	opts = opts || {};

	var fcc = (opts.colConfig instanceof OrdMap && opts.colConfig.get(opts.field)) || opts.colConfig || {};
	var fti = (opts.typeInfo instanceof OrdMap && opts.typeInfo.get(opts.field)) || opts.typeInfo || {};

	if (container instanceof jQuery) {
		container = container.get(0);
	}

	if (!(container instanceof Element)) {
		throw new Error('Call Error: `container` must be an Element instance');
	}

	if (value instanceof Element) {
		container.appendChild(value);
	}
	else if (value instanceof jQuery) {
		container.appendChild(value.get(0));
	}
	else if (fcc.allowHtml && fti.type === 'string') {
		container.innerHTML = value;
	}
	else if (value === '') {
		container.innerText = '\u00A0';
	}
	else {
		container.innerText = value;
	}
}

// makeOperationButton {{{2

export function makeOperationButton(type, op, index, opts) {
	opts = opts || {};

	_.defaults(opts, {
		inCell: false
	});

	var btn = document.createElement('button');
	btn.setAttribute('type', 'button');
	btn.setAttribute('data-operation-type', type);
	btn.setAttribute('data-operation-index', index);
	btn.classList.add('wcdv_operation');
	// Cell operations don't get labels, because they would take up too much space.
	if (type === 'cell') {
		btn.classList.add('wcdv_icon_button');
		btn.classList.add('wcdv_icon_button_incell');
		btn.classList.add('wcdv_icon_button_nolabel');
		btn.style.float = 'initial';
		btn.appendChild(fontAwesome(op.icon).get(0));
	}
	else {
		if (op.icon) {
			btn.appendChild(fontAwesome(op.icon).get(0));
		}
		if (op.label) {
			btn.classList.add('wcdv_nowrap');
			btn.append(op.label);
		}
		else {
			btn.classList.add('no_label');
		}
	}
	if (op.tooltip) {
		btn.setAttribute('title', op.tooltip);
	}
	return btn;
}

// makeCheckbox {{{2

export function makeCheckbox(startChecked, onChange, text, parent) {
	var label = jQuery('<label>');
	var input = jQuery('<input>', { 'type': 'checkbox', 'checked': startChecked }).on('change', onChange);

	label.append(input).append(text).appendTo(parent);

	return input;
}

// makeToggleCheckbox {{{2

export function makeToggleCheckbox(rootObj, path, startChecked, text, parent, after) {
	if (rootObj != null) {
		setPropDef(startChecked, rootObj, path);
	}

	return makeCheckbox(rootObj != null ? getProp(rootObj, path) : startChecked, function () {
		var isChecked = jQuery(this).prop('checked');
		if (rootObj != null) {
			console.debug('[DataVis // Grid // Toolbar] Setting `' + path.join('.') + '` to ' + isChecked);
			setProp(isChecked, rootObj, path);
		}
		if (typeof after === 'function') {
			after(isChecked);
		}
	}, text, parent);
}

// makeRadioButtons {{{2

/**
 * @typedef makeRadioButtons_values
 *
 * @property {string} label
 *
 * @property {string} value
 */

/**
 * @param {Object} rootObj
 * Object to update when radio button is selected.
 *
 * @param {string[]} path
 * Path within the object to set the value of the selected radio button.
 *
 * @param {string} def
 * Default value to set in the object.
 *
 * @param {string} [label]
 * Label to put before the group of radio buttons.
 *
 * @param {string} name
 * Name of the form variable.
 *
 * @param {Array.<string|makeRadioButtons_values>} values
 * Possible values to create radio buttons for.
 *
 * @param {function} [conv]
 * Pass selected value through this function to convert it (e.g. "true" -> 1).
 *
 * @param {function} [onChange]
 * Function to call when the value is changed.
 *
 * @param {Element|jQuery} parent
 * Element to place the radio buttons within.
 */

export function makeRadioButtons(rootObj, path, def, label, name, values, conv, onChange, parent) {
	setPropDef(def, rootObj, path);
	var initial = getProp(rootObj, path);

	var root = jQuery('<div>').css('display', 'inline-block').appendTo(parent);

	var handler = function () {
		var selected = root.find('input[type=radio]:checked').val();
		if (typeof conv === 'function') {
			selected = conv(selected);
		}
		console.debug('[DataVis // Grid // Toolbar] Setting `' + path.join('.') + '` to ' + selected);
		setProp(selected, rootObj, path);
		if (typeof onChange === 'function') {
			onChange(selected);
		}
	};

	if (label) {
		jQuery('<label>').text(label).appendTo(root);
	}
	_.each(values, function (v) {
		var label = _.isString(v) ? v : v.label;
		var value = _.isString(v) ? v : v.value;
		jQuery('<label>')
			.append(jQuery('<input>', { 'type': 'radio', 'name': name, 'value': value })
							.on('change', handler))
			.append(label)
			.appendTo(root);
	});
	root.find('input[type=radio]').val([initial]);
	return root;
}

// Input / Output {{{1

/**
 * @namespace util.io
 */

export function valueInfo(value) {
	if (_.isNumber(value)) {
		return [value, ': Number'];
	}
	else if (_.isString(value)) {
		return ['"' + value + '"', ': String'];
	}
	else if (_.isArray(value)) {
		return [value, ': Array'];
	}
	else if (_.isObject(value)) {
		return [value, ': Object'];
	}
	else {
		return [value, ': Unknown'];
	}
}

export function addSrcInfo(srcIndex, field) {
	return ':' + srcIndex + ':' + field;
}

export var logAsync = (function () {
	var ids = {};
	return function (id) {
		ids[id] = ids[id] == null ? 0 : ids[id] + 1;
		id += '[' + ids[id] + ']';
		console.log('~~~ ASYNC: ' + id + ' - START');
		return {
			finish: function () {
				console.log('~~~ ASYNC: ' + id + ' - FINISH');
			}
		};
	};
})();

var decode = function (cell, fti) {
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

var fmtRegexps = {
	toplevel: /\{\{dv\.fmt:(.*?)\}\}(.*?)\{\{\/\}\}/,
	color: /^(fg|bg)=([0-9A-F]{6})$/,
	textStyle: /^ts=([bisu]+)$/,
	cssClass: /^cls=(.*)$/,
};

/**
 * Correctly format a value according to its type and user specification.
 *
 * @param {object} colConfig Configuration object for the column corresponding to this field.
 *
 * @param {object} typeInfo
 *
 * @param {Cell} cell The true value, as used by the View to perform sorting and
 * filtering.
 *
 * @param {object} opts
 * Additional options.
 *
 * @param {boolean} [opts.debug=false]
 * If true, some debugging output is produced.  Turned off by default because it tends to be noisy
 * and thus slow down the browser.
 *
 * @param {string} [opts.overrideType]
 * If true, the type of the data is assumed to be that specified, instead of what's in `typeInfo`.
 * This is often used when outputting aggregate function results that have a different type from the
 * type of the field they're applied on (e.g. "distinct values" always produces a string, even if
 * it's applied over a field that contains dates or currency).
 *
 * @param {boolean} [saferCaching=true]
 * If true, only cache non-Element results from calling the `render` function on a cell.  In the
 * event that the cell is displayed more than once (e.g. group summary or pivot output, where the
 * single cell representing a rowval element is shown in each rowval having it as a member), if we
 * cache the Element, it will be reused, and thus moved around on the page, causing all but one
 * instance of the cell to disappear.
 */

export var format = (function () {
	var defaultNumberFormat = {
		integerPart: {
			grouping: false,
			groupSize: 3,
			groupSeparator: ','
		},
		fractionalPart: {
			grouping: false,
			groupSize: 3,
			groupSeparator: ' '
		},
		radixPoint: '.',
		decimalPlaces: null,
		negativeFormat: 'minus',
		roundingMethod: 'half_up',
	};

	if (window.Intl != null && window.Intl.NumberFormat != null && window.Intl.NumberFormat.prototype.formatToParts != null) {
		// You can't extract information about how to format a number from Intl.NumberFormat, but you
		// can have it format a number and then "parse" the result to figure out e.g. what the grouping
		// and radix point characters are.

		_.each(window.Intl.NumberFormat(window.DATAVIS_LANG).formatToParts('1234.5'), function (o) {
			switch (o.type) {
			case 'group':
				defaultNumberFormat.integerPart.groupSeparator = o.value;
				break;
			case 'decimal':
				defaultNumberFormat.radixPoint = o.value;
			}
		});
	}

	var defaultCurrencyFormat = deepDefaults({
		integerPart: {
			grouping: true
		},
		decimalPlaces: 2,
		negativeFormat: 'parens',
		currencySymbol: '$'
	}, defaultNumberFormat);

	// Convert from a number format string to a number format object.  Originally, there was only one
	// internal representation for a number, using the Numeral library.  The formatting string we
	// accepted was just passed to numeral#format().  Now we support other internal representations
	// and have a generalized object to specify how numbers should be formatted.  But we allow the
	// user to specify the same format strings they always have, convert them to the new object-driven
	// way of doing things, and apply them to all numbers regardless of representation.

	var formatStrToObj = function (formatStr, base) {
		var formatObj = deepCopy(base)
			, m;

		if (formatStr[0] === '$') {
			formatObj.currencySymbol = '$';
			formatStr = formatStr.slice(1);
		}

		//TODO Better way to handle detection of currency symbols.
		//m = formatStr.match(/[\$\x7F-\uD7FF\uDC00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF]/);
		//setProp(m != null ? m[0] : '', formatObj, 'currencySymbol');

		m = formatStr.match(/^0,0/);
		setProp(!!m, formatObj, 'integerPart', 'grouping');

		m = formatStr.match(/\.(0+)$/);
		setProp(m != null ? m[1].length : 0, formatObj, 'decimalPlaces');

		return formatObj;
	};

	return function (fcc, fti, cell, opts) {
		var newVal
			, isNegative = false
			, isSafeToCache = true;

		fcc = fcc || {};
		fti = fti || {};
		opts = opts || {
			decode: true
		};

		_.defaults(opts, {
			debug: false,
			overrideType: null,
			saferCaching: true
		});

		if (opts.debug) {
			console.debug('[DataVis // Format] typeInfo = %O ; colConfig = %O ; cell = %O ; opts = %O', fti, fcc, cell, opts);
		}

		// When we just receive a value instead of a proper data cell, convert it so that code below can
		// be simplified.  These cells are just "pretend" and anything stored in them is going to be
		// discarded when this function is done.

		if ((moment.isMoment(cell))
				|| numeral.isNumeral(cell)
				|| BigNumber.isBigNumber(cell)
				|| cell == null
				|| typeof cell !== 'object'
				|| typeof(cell.value) === 'undefined') {
			cell = {
				value: cell
			};
		}

		// When we've already rendered this cell before, just reuse that.

		if (cell.cachedRender != null) {
			return cell.cachedRender;
		}

		var result = cell.orig || cell.value;

		var t = opts.overrideType || fti.type;
		var format = fcc.format;
		var formatObj;
		var format_dateOnly = fcc.format_dateOnly;

		if (format == null) {
			// Set the default formatting for each non-string type.  The general idea here is to be as
			// precise as possible and let the user specify something more terse if they want to.

			switch (t) {
			case 'number':
				format = deepCopy(defaultNumberFormat);
				break;
			case 'currency':
				format = deepCopy(defaultCurrencyFormat);
				break;
			case 'date':
				format = 'LL';
				break;
			case 'datetime':
				format = 'LLL';
				break;
			case 'time':
				format = 'LTS';
				break;
			}
		}
		else {
			// The user has supplied some formatting that they want to use.  For numeric types, this can be
			// done via an object (powerful but verbose), or via a string (less powerful but terse).  Parse
			// the string if necessary, or merge the object with the default configuration.

			switch (t) {
			case 'number':
				format = typeof format === 'string'
					? formatStrToObj(format, defaultNumberFormat)
					: deepDefaults(format, defaultNumberFormat);
				break;
			case 'currency':
				format = typeof format === 'string'
					? formatStrToObj(format, defaultCurrencyFormat)
					: deepDefaults(format, defaultCurrencyFormat);
				break;
			}
		}

		if (format_dateOnly == null && t === 'datetime') {
			format_dateOnly = 'LL';
		}

		if (result == null || result === '') {
			result = '';
		}
		else if (['date', 'datetime'].indexOf(t) >= 0
			&& ((moment.isMoment(cell.value) && !cell.value.isValid())
				|| ['', '0000-00-00', '0000-00-00 00:00:00'].indexOf(cell.value) >= 0)) {

			// Handle zero dates like Webchart uses all the time.  Turn them into the empty string,
			// otherwise Moment will say "Invalid Date".

			result = '';
		}
		else {
			switch (t) {
			case 'date':
			case 'time':
			case 'datetime':
				if (opts.decode) {
					decode(cell, fti);
				}

				result = types.registry.get(t).format(cell.value, {
					full: format,
					abbrev: t === 'datetime' && fcc.hideMidnight ? format_dateOnly : null
				});
				break;
			case 'number':
			case 'currency':
			case 'duration':
			case 'json':
				if (opts.decode) {
					decode(cell, fti);
				}

				result = types.registry.get(t).format(cell.value, format);
				break;
			case 'string':
				result = cell.value;
				break;
			default:
				console.error('Unable to format - unknown type: { field = "%s", type = "%s", value = "%s" }',
					fti.field, t, cell.value);
			}
		}

		if (fcc.allowFormatting) {
			if (typeof result === 'string') {
				var foundFmtStr = false;
				var fmtResult = ''
					, fmtClass = ''
					, fmtStyle = '';
				var m0 = null;
				while ((m0 = result.match(fmtRegexps.toplevel)) != null) {
					foundFmtStr = true;
					fmtClass = 'wcdv_format_string';
					fmtStyle = '';
					// Extract up to the start of the match, escaping it.
					fmtResult += escapeHtml(result.substring(0, m0.index));
					_.each(m0[1].split(','), function (f) {
						var m1;
						// Foreground and background color.
						m1 = f.match(fmtRegexps.color);
						if (m1 != null) {
							fmtStyle += (m1[1] === 'bg' ? 'background-' : '') + 'color: #' + m1[2] + ';';
							return;
						}
						// Text style and weight.
						m1 = f.match(fmtRegexps.textStyle);
						if (m1 != null) {
							if (m1[1].indexOf('b') >= 0) {
								fmtStyle += 'font-weight: bold;';
							}
							if (m1[1].indexOf('i') >= 0) {
								fmtStyle += 'font-style: italic;';
							}
							if (m1[1].indexOf('u') >= 0) {
								fmtStyle += 'text-decoration: underline;';
							}
							if (m1[1].indexOf('s') >= 0) {
								fmtStyle += 'text-decoration: line-through;';
							}
						}
						// Generic CSS class.
						m1 = f.match(fmtRegexps.cssClass);
						if (m1 != null) {
							fmtClass += (fmtClass.length > 0 ? ' ' : '') + m1[1];
						}
					});
					// Make a span to hold our formatted value.
					fmtResult += '<span';
					if (fmtStyle != null) {
						fmtResult += ' style="' + fmtStyle + '"';
					}
					if (fmtClass != null) {
						fmtResult += ' class="' + fmtClass + '"';
					}
					fmtResult += '>' + escapeHtml(m0[2]) + '</span>';
					// Move along so we can match more text after the {{/}}.
					result = result.substring(m0[0].length);
				}
				// No need to make an element if nothing was formatted.
				if (foundFmtStr) {
					return jQuery('<div>').html(fmtResult);
				}
			}
		}

		// If there's a rendering function, pass the (possibly formatted) value through it to get the new
		// value to display.  If the rendering function returns an Element (possibly built via jQuery),
		// mark the result as unsafe to cache, because an Element can't be on the page more than once, so
		// we need to have the rendering function make it every time, in the event that the same cell is
		// displayed more than once in the grid.

		if (typeof cell.render === 'function') {
			result = cell.render(result);
			if (opts.saferCaching && (result instanceof jQuery || result instanceof Element)) {
				isSafeToCache = false;
			}
		}

		if (isSafeToCache) {
			cell.cachedRender = result;
		}

		return result;
	};
})();

// Date and Time Formatting {{{1

/**
 * @namespace util.datetime
 */

// Initialize date and time format strings from user preferences.  There doesn't seem to be a
// builtin way to convert the magick numbers into format strings, but since they're stored in the
// database it seems safe to assume that they won't change.

var dateFormatString = 'yyyy-MM-dd';
var timeFormatString = 'HH:mm:ss';

/**
 * Initialization function to grab things we need before doing anything else (e.g. user
 * preferences).  This function is asynchronous and requires that you pass it a continuation.
 */

export function init(cont) {
	switch (miecgictrl.dateformat) {
	case 1:
		dateFormatString = 'MM-dd-yyyy';
		break;
	case 2:
		dateFormatString = 'dd-MM-yyyy';
		break;
	case 3:
		dateFormatString = 'yyyy-MM-dd';
		break;
	default:
		dateFormatString = 'yyyy-MM-dd';
	}
	timeFormatString = miecgictrl.militaryTime ? 'HH:mm:ss' : 'hh:mm:ss tt';
	cont();
}

/**
 * Format a Date object according to the user's date formatting preferences.  To be accurate, you
 * need to call the init() function first.
 *
 * @param {Date} d The date to format.
 * @returns {string} The date formatted according to the user's preference.
 */

export function formatDate(d) {
	var convert = {
		'MM': function (x) {
			var m = x.getMonth() + 1;
			return m > 9 ? m : '0' + m;
		},
		'dd': function (x) {
			var d = x.getDate();
			return d > 9 ? d : '0' + d;
		},
		'yyyy': function (x) {
			return x.getFullYear();
		}
	};
	return _.map(dateFormatString.split('-'), function (fmt) {
		if (convert[fmt]) {
			return convert[fmt](d);
		}
		else {
			return '[UNKNOWN]';
		}
	}).join('-');
}

/**
 * Format a Date object according to the user's time formatting preferences.  To be accurate, you
 * need to call the init() function first.
 *
 * @param {Date} t The time to format.
 * @returns {string} The time formatted according to the user's preference.
 */

export function formatTime(t) {
	var convert = {
		'HH': function (x) {
			var h = x.getHours();
			return h > 9 ? h : '0' + h;
		},
		'hh': function (x) {
			var h = x.getHours();
			if (h === 0) {
				h = 12;
			}
			else if (h > 12) {
				h = h - 12;
			}
			return h > 9 ? h : '0' + h;
		},
		'mm': function (x) {
			var m = x.getMinutes();
			return m > 9 ? m : '0' + m;
		},
		'ss': function (x) {
			var s = x.getSeconds();
			return s > 9 ? s : '0' + s;
		},
		'tt': function (x) {
			var h = x.getHours();
			return h < 12 ? 'AM' : 'PM';
		}
	};
	return timeFormatString.replace(/[A-Za-z]+/g, function (fmt) {
		if (convert[fmt]) {
			return convert[fmt](t);
		}
	});
}

/**
*/

export function formatDateTime(d) {
	return formatDate(d) + ' ' + formatTime(d);
}

/**
*/

export function formatDateString(s) {
	if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
		return '[UNKNOWN]';
	}
	return formatDate(new Date(s));
}

/**
*/

export function formatTimeString(s) {
	if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
		return '[UNKNOWN]';
	}
	return formatTime(new Date(s));
}

/**
*/

export function formatDateTimeString(s) {
	if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00') {
		return '[UNKNOWN]';
	}
	formatDateTime(new Date(s));
}

/**
*/

export function removeZeroDates(x) {
	return x === '0000-00-00' ? '' : x;
}

/**
*/

export function removeZeroDateTimes(x) {
	return x === '0000-00-00 00:00:00' ? '' : x;
}

var DATE_ONLY_REGEXP = /^\d\d\d\d-\d\d-\d\d$/;

/**
*/

export function addTimeComponent(x) {
	return (typeof x === 'string' && DATE_ONLY_REGEXP.test(x)) ? x + ' 00:00:00' : x;
}


// Blocking {{{1

/**
 * @namespace util.blocking
 */

var BLOCK_CONFIG = {
	message: null,
	overlayCSS: {
		opacity: 0.9,
		backgroundColor: '#FFF'
	}
};

/**
 * Block the grid.  If the grid has already been blocked, then nothing happens.
 *
 * @param {object} defn The definition of the report that created the grid to block.
 * @param {function} fn If present, that function will be used as BlockUI's onBlock event handler.
 * @param {string} info Message that can be logged when blocking.
 */

export function blockGrid(defn, fn, info) {
	var grid;
	var blockConfig;
	var output;

	if (defn.table.blockCount === undefined) {
		defn.table.blockCount = 0;
	}

	defn.table.blockCount += 1;

	console.debug('[DataVis // Blocking // Push] COUNT =', defn.table.blockCount, '> INFO =', info);

	if (defn.table.blockCount === 1) {
		output = getProp(defn, 'table', 'output', 'method');

		switch (output) {
		case 'jqwidgets':
			grid = jQuery(document.getElementById(defn.table.id)).children('div [role="grid"]');
			break;
		case 'pivot':
			grid = jQuery(document.getElementById(defn.table.id));
			break;
		default:
			grid = null;
		}

		if (grid !== null) {
			blockConfig = {
				message: null,
				overlayCSS: {
					opacity: 0.9,
					backgroundColor: '#FFF'
				}
			};

			if (typeof fn === 'function') {
				blockConfig.onBlock = fn;
			}

			grid.block(blockConfig);
		}
		else {
			fn();
		}
	}
	else if (typeof fn === 'function') {
		fn();
	}
}

/**
 * Unblock the grid.  If the grid has been blocked by more events then it has been unblocked by,
 * then the block will remain.
 *
 * @param {object} defn The definition of the report that created the grid to block.
 * @param {string} info Message that can be logged when unblocking.
 */

export function unblockGrid(defn, info) {
	var grid;
	var output;

	if (defn.table.blockCount === undefined) {
		defn.table.blockCount = 0;
	}

	if (defn.table.blockCount > 0) {
		defn.table.blockCount -= 1;
		console.debug('[DataVis // Blocking // Pop] COUNT =', defn.table.blockCount, '> INFO =', info);
		if (defn.table.blockCount === 0) {
			output = getProp(defn, 'table', 'output', 'method');

			switch (output) {
			case 'jqwidgets':
				grid = jQuery(document.getElementById(defn.table.id)).children('div [role="grid"]');
				break;
			case 'pivot':
				grid = jQuery(document.getElementById(defn.table.id));
				break;
			default:
				grid = null;
			}

			if (grid !== null) {
				grid.unblock();
			}
		}
	}
}

/**
 * Check to see if a grid is blocked.
 *
 * @param {object} defn The definition of the report that created the grid we want to check.
 *
 * @return {boolean} True if the grid is blocked, false if it is not.
 */

export function gridIsBlocked(defn) {
	return defn.table.blockCount > 0;
}

/**
 * Wrap a function to execute while the grid is blocked.  Blocks the grid, calls the function, and
 * unblocks immediately afterward.  You probably only want to use this is the function you provide
 * is not asynchronous (otherwise the grid will unblock "early" when the function returns).
 *
 * @param {object} defn The definition of the report that created the grid to block.
 *
 * @param {function} fn A zero-arity function to call after the grid has been blocked.  After this
 * function returns, the grid is unblocked.
 *
 * @param {string} info Message that can be logged when blocking/unblocking.
 */

export function withGridBlock(defn, fn, info) {
	if (typeof fn !== 'function') {
		throw Error('Call Error: `fn` must be a function');
	}

	blockGrid(defn, function () {
		// This shouldn't be necessary because we're doing it in BlockUI's onBlock event handler, but
		// for whatever reason it doesn't always work... oftentimes, when fn() executes, the element
		// is not visually blocked.  This seems to be much more consistent in how it looks.

		window.setTimeout(function () {
			fn();
			unblockGrid(defn, info);
		}, jQuery.blockUI.defaults.fadeIn);
	}, info);
}

// Timing {{{1

export function Timing() {
	var self = this;

	self.data = {};
	self.events = {};
	self.eventCount = {};
}

// #start {{{2

Timing.prototype.start = function (what) {
	var self = this
		, subject = what[0]
		, event = what[1];

	setPropDef([], self.events, subject);
	setPropDef(0, self.eventCount, subject, event);
	setPropDef({}, self.data, subject);

	self.eventCount[subject][event] += 1;

	if (self.eventCount[subject][event] > 1) {
		event += ' (#' + self.eventCount[subject][event] + ')';
	}

	self.events[subject].push(event);

	console.debug('[DataVis // Timing] Received <START> event for [' + subject + ' ] ' + event);

	setProp(Date.now(), self.data, subject, event, 'start');
};

// #stop {{{2

Timing.prototype.stop = function (what) {
	var self = this
		, subject = what[0]
		, event = what[1];

	setPropDef(0, self.eventCount, subject, event);

	if (self.eventCount[subject][event] > 1) {
		event += ' (#' + self.eventCount[subject][event] + ')';
	}

	console.debug('[DataVis // Timing] Received <STOP> event for [' + subject + ' ] ' + event);

	if (getProp(self.data, subject, event, 'start') === undefined) {
		console.warn('Received <STOP> event for [' + subject + ' : ' + event + '] with no <START> event');
		return;
	}

	setProp(Date.now(), self.data, subject, event, 'end');
};

// #getSubjects {{{2

Timing.prototype.getSubjects = function () {
	return _.keys(this.events);
};

// #dump {{{2

Timing.prototype.dump = function (subject) {
	var self = this;

	var f = function (sub) {
		if (isNothing(self.events[sub])) {
			throw new Error('Unknown subject: ' + sub);
		}

		_.each(self.events[sub], function (evt) {
			var start = getProp(self.data, sub, evt, 'start')
				, end = getProp(self.data, sub, evt, 'end');

			console.log('[TIMING] ' + sub + ' : ' + evt + ' >> ' + (end - start) + 'ms');
		});
	};

	if (subject != null) {
		f(subject);
	}
	else {
		_.each(self.getSubjects(), f);
	}
};

// }}}1

// https://stackoverflow.com/questions/901115/

export function getParamsFromUrl() {
	var match, key, val,
		pl     = /\+/g,  // Regex for replacing addition symbol with a space
		search = /([^&=]+)=?([^&]*)/g,
		decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
		query  = window.location.search.substring(1),
		params = {};

	// eslint-disable-next-line no-cond-assign
	while (match = search.exec(query)) {
		key = decode(match[1]);
		val = decode(match[2]);
		if (params[key]) {
			if (!_.isArray(params[key])) {
				params[key] = [params[key]];
			}
			params[key].push(val);
		}
		else {
			params[key] = val;
		}
	}

	return params;
}

export function validateColConfig(colConfig, data) {
	if (!(colConfig instanceof OrdMap)) {
		throw new Error('Call Error: `colConfig` must be an OrdMap instance');
	}

	if (data == null) {
		console.warn('Unable to validate column configuration without data');
		return false;
	}

	if (!data.isPlain) {
		console.log('Can only validate column config for plain output');
		return false;
	}

	if (data.data.length === 0) {
		console.log('Unable to validate column configuration using data with no rows');
		return false;
	}

	colConfig.each(function (fcc, field) {
		if (data.data[0].rowData[field] === undefined) {
			console.warn('Column configuration refers to field "' + field + '" which does not exist in the data');
			return false;
		}
	});

	return true;
}

/**
 * Determine which columns should be shown in plain or grouped output, based on information from
 * several sources.
 *
 * If the user has set `defn.table.columns`, then it will be used to figure out what fields are to
 * be shown.  Otherwise, the fields come from the source's type info, and fields starting with an
 * underscore are omitted.
 *
 * @todo What do we do when the data has been pivotted?
 *
 * @param {Grid~Defn} defn
 *
 * @param {array} data
 *
 * @param {Source~TypeInfo} typeInfo
 *
 * @returns {Array.<string>} An array of the names of the fields that should constitute the columns
 * in the output.  This is not necessarily the same as the headers to be shown in the output.
 */

export function determineColumns(colConfig, data, typeInfo) {
	var columns = [];

	if (!(colConfig instanceof OrdMap)) {
		throw new Error('Call Error: `colConfig` must be an OrdMap instance');
	}

	if (!(typeInfo instanceof OrdMap)) {
		throw new Error('Call Error: `typeInfo` must be an OrdMap instance');
	}

	validateColConfig(colConfig, data);

	// FIXME: Checking _keys.length is a stand-in for saying "this OrdMap has never had anything added
	// to it" and should be implemented in a way that doesn't use knowledge of OrdMap's internals.
	//
	// The reason for not just checking size is this test:
	//
	//   - defn: columns = ['A', 'B']
	//   - source: columns = ['X', 'Y', 'Z']
	//
	// The defn colConfig is stripped of fields not in the source, making it [].  Here, an empty
	// colConfig means to show all source fields.  But that defies the purpose of defn colConfig,
	// which is to limit what is visible: the correct behavior is to show nothing.  The fix is to
	// check instead that the OrdMap has never been changed, meaning it wasn't set by defn, and
	// therefore it's OK to show all fields.

	if (colConfig._keys.length > 0) {
		var notHidden = colConfig.filter(function (cc) {
			return !cc.isHidden;
		});
		var pinned = notHidden.filter(function (cc) {
			return cc.isPinned;
		}).keys();
		var notPinned = notHidden.filter(function (cc) {
			return !cc.isPinned;
		}).keys();
		columns = pinned.concat(notPinned);
	}
	else if (typeInfo.size() > 0) {
		columns = _.reject(typeInfo.keys(), function (field) {
			return field.charAt(0) === '_';
		});
	}
	else if (data != null) {
		if (data.isPlain && data.data.length > 0) {
			columns = _.keys(data.data[0].rowData);
		}
		else if (data.isGroup && data.data[0].length > 0) {
			columns = _.keys(data.data[0][0].rowData);
		}
		else if (data.isPivot && data.data[0][0].length > 0) {
			columns = _.keys(data.data[0][0][0].rowData);
		}
	}

	console.debug('[DataVis // Determine Columns] Columns = %O', columns);

	return columns;
}

// Downloading {{{1

/**
 * Present a blob as a download.  This works even in IE10!
 *
 * @param {Blob} blob
 * The content to download.
 *
 * @param {string} fileName
 * Default name to use for the file.
 */

export function presentDownload(blob, fileName) {
	if (!(blob instanceof Blob)) {
		throw new Error('Call Error: `blob` must be a Blob');
	}

	// IE11 supports Blob, but doesn't allow you to fake a click on the download link.  Fortunately
	// for us, it has a function which does all of that for you in one step!

	if (window.navigator.msSaveBlob != null) {
		window.navigator.msSaveBlob(blob, fileName);
	}
	else {
		var a = document.createElement('a');
		a.download = fileName;
		a.href = URL.createObjectURL(blob);
		jQuery(document.body).append(a);
		a.click();
		a.remove();
	}
}

// https://stackoverflow.com/a/12300351

/**
 * Convert a data URI to a blob which can be downloaded.  This works even in IE10!
 *
 * @param {string} dataURI
 * The URI to convert into a blob.
 *
 * @return {Blob}
 * A blob that can be downloaded.
 */

export function dataURItoBlob(dataURI) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  var byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  var ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([ab], {type: mimeString});
  return blob;

}

// Misc {{{1

// https://stackoverflow.com/a/2117523

export function uuid() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

// sleep {{{2

export function sleep(ms) {
	var start = new Date();
	var end;
	do {
		end = new Date();
	}
	while (end - start < ms);
}

// EagerPipeline {{{1

export var EagerPipeline = makeSubclass('EagerPipeline', Object, function (x) {
	this.x = x;
});

// #andThen {{{2

EagerPipeline.prototype.andThen = function (f) {
	var x = this.x;
	return new EagerPipeline(f(x));
};

// #andThenCurry {{{2

EagerPipeline.prototype.andThenCurry = function () {
	var f = curry.apply(null, arguments);
	return this.andThen(f);
};

// #done {{{2

EagerPipeline.prototype.done = function () {
	return this.x;
};

// Polyfills {{{1

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat

if (!String.prototype.repeat) {
  String.prototype.repeat = function(count) {
    'use strict';
    if (this == null) { // check if `this` is null or undefined
      throw new TypeError('can\'t convert ' + this + ' to object');
    }
    var str = '' + this;
    // To convert string to integer.
    count = +count;
    if (count < 0) {
      throw new RangeError('repeat count must be non-negative');
    }
    if (count == Infinity) {
      throw new RangeError('repeat count must be less than infinity');
    }
    count |= 0; // floors and rounds-down it.
    if (str.length == 0 || count == 0) {
      return '';
    }
    // Ensuring count is a 31-bit integer allows us to heavily optimize the
    // main part. But anyway, most current (August 2014) browsers can't handle
    // strings 1 << 28 chars or longer, so:
    if (str.length * count >= (1 << 28)) {
      throw new RangeError('repeat count must not overflow maximum string size');
    }
		// eslint-disable-next-line no-cond-assign
    while (count >>= 1) { // shift it by multiple of 2 because this is binary summation of series
       str += str; // binary summation
    }
    str += str.substring(0, str.length * count - str.length);
    return str;
  };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith

if (!String.prototype.startsWith) {
    Object.defineProperty(String.prototype, 'startsWith', {
        value: function(search, rawPos) {
            var pos = rawPos > 0 ? rawPos|0 : 0;
            return this.substring(pos, pos + search.length) === search;
        }
    });
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(search, this_len) {
    if (this_len === undefined || this_len > this.length) {
      this_len = this.length;
    }
    return this.substring(this_len - search.length, this_len) === search;
  };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN

Number.isNaN = Number.isNaN || function(value) {
	return value !== value;
};

// https://developer.mozilla.org/en-US/docs/Web/API/Element/closest

if (!Element.prototype.matches) {
  Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

if (!Element.prototype.closest) {
  Element.prototype.closest = function(s) {
    var el = this;

    do {
      if (el.matches(s)) return el;
      el = el.parentElement || el.parentNode;
    } while (el !== null && el.nodeType === 1);
    return null;
  };
}

export { deepCopy };
