import 'core-js/es/string/replace-all';

import _ from 'underscore';
import sprintf from 'sprintf-js';
import jQuery from 'jquery';

import BigNumber from 'bignumber.js';
import numeral from 'numeral';
import moment from 'moment';

import JSONFormatter from 'json-formatter-js';

import OrdMap from './util/ordmap.js';
import EXPERIMENTAL_FEATURES from './flags.js';

var types = {};

types.registry = new OrdMap();
types.registry.setInsertOrder('prepend');

// types.guess {{{1

types.guess = function (val) {
	var typeNames = types.registry.keys();
	for (var i = 0; i < typeNames.length; i += 1) {
		if (types.registry.get(typeNames[i]).matches(val)) {
			return typeNames[i];
		}
	}
};

// types.universalCmp {{{1

types.universalCmp = function (a, b) {
	return a === b ? 0 : a < b ? -1 : 1;
};

// String {{{1

(function () {

	// matches {{{2

	function matches(str) {
		return true;
	}

	// parse {{{2

	function parse(str) {
		return str;
	}

	// decode {{{2

	function decode(val, ir) {
		if (typeof val === 'string') {
			return parse(val, ir);
		}
		else {
			console.error('[DataVis // Type(String) // Decode] Call Error: unsupported conversion: %s', ir);
			return null;
		}
	}

	// format {{{2

	function format(val) {
		return val;
	}

	// natRep {{{2

	function natRep(val) {
		return val;
	}

	// compare {{{2

	var compare;

	if (window.Intl != null && window.Intl.Collator != null) {
		var collator = window.Intl.Collator(undefined, { usage: 'sort', sensitivity: 'base' });

		compare = function (a, b) {
			if (a == null || b == null) {
				return a == b ? 0 : a == null ? -1 : 1;
			}

			return collator.compare(a, b);
		};
	}
	else {
		compare = function (a, b) {
			if (a == null || b == null) {
				return a == b ? 0 : a == null ? -1 : 1;
			}

			return a < b ? -1 : a > b ? 1 : 0;
		};
	}

	// register {{{2

	types.registry.set('string', {
		matches: matches,
		parse: parse,
		decode: decode,
		format: format,
		natRep: natRep,
		compare: compare,
		supports: {
			group: true
		}
	});
})();

// Number {{{1

(function () {

  var re_number = new RegExp(/(^-?[1-9]{1}[0-9]{0,2}(,?\d{3})*(\.\d+)?(e[+-]?\d+)?$)|(^0(e[+-]?\d+)?$)|(^-?0?\.\d+(e[+-]?\d+)?$)/);
	var re_comma = new RegExp(/,/g);

	// default formatting options {{{2

	var formatOpts = {
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
		currencySymbol: ''
	};

	// Overwrite the defaults with locale-specific formatting options gleaned from Intl.

	if (window.Intl != null && window.Intl.NumberFormat != null && window.Intl.NumberFormat.prototype.formatToParts != null) {
		// You can't extract information about how to format a number from Intl.NumberFormat, but you
		// can have it format a number and then "parse" the result to figure out e.g. what the grouping
		// and radix point characters are.

		_.each(window.Intl.NumberFormat(window.DATAVIS_LANG).formatToParts('1234.5'), function (o) {
			switch (o.type) {
			case 'group':
				formatOpts.integerPart.groupSeparator = o.value;
				break;
			case 'decimal':
				formatOpts.radixPoint = o.value;
			}
		});
	}

	// matches {{{2

	function matches(val) {
		return (typeof val === 'number') || (typeof val === 'string' && re_number.test(val));
	}

	// parse {{{2

  function _parse(str, resultType) {
    if (str.charAt(0) === '(' && str.charAt(-1) === ')') {
      return _parse(str.substring(1, str.length - 1)) * -1;
    }
		else {
			var noCommas = str.replace(re_comma, '');
			return resultType === 'string' ? noCommas
				: str.indexOf('.') >= 0 || str.indexOf('e') >= 0 ? parseFloat(noCommas)
				: parseInt(noCommas);
		}
  }

	function parse(str, ir) {
		var parsed;

		if (typeof str !== 'string') {
			console.error('[DataVis // Type(Number) // Parse] Call Error: `str` must be a string');
			return null;
		}

		switch (ir) {
		case 'primitive':
			return _parse(str, 'number');
		case 'numeral':
			parsed = _parse(str, 'number');
			if (parsed == null) {
				return null;
			}
			return numeral(parsed);
		case 'bignumber':
			parsed = _parse(str, 'string');
			if (parsed == null) {
				return null;
			}
			return new BigNumber(parsed);
		default:
			console.error('[DataVis // Type(Number) // Parse] Call Error: invalid internal representation: %s', ir);
			return null;
		}
	}

	// decode {{{2

	function decode(val, ir) {
		if (typeof val === 'string') {
			return parse(val, ir);
		}
		else if (typeof val === 'number') {
			switch (ir) {
			case 'primitive':
				return val;
			case 'bignumber':
				return new BigNumber(val);
			case 'numeral':
				return numeral(val);
			default:
				console.error('[DataVis // Type(Number) // Decode] Call Error: invalid internal representation: %s', ir);
				return null;
			}
		}
		else {
			console.error('[DataVis // Type(Number) // Decode] Call Error: unsupported conversion: %s to %s', typeof val, ir);
			return null;
		}
	}

	// format {{{2

	// numeral {{{3

	function numeralFormat(fmt) {
		var result = '';

		result += fmt.integerPart.grouping ? '0,0' : '0';

		if (fmt.decimalPlaces == null) {
			result += '[.][0000000000000000]';
		}
		else if (fmt.decimalPlaces > 0) {
			result += '.';
			result += '0'.repeat(fmt.decimalPlaces);
		}

		return result;
	}

	// bignumber {{{3

	function bigNumberFormat(fmt) {
		var obj = {
			prefix: '',
			decimalSeparator: fmt.radixPoint,
			secondaryGroupSize: 0,
			suffix: ''
		};

		if (fmt.integerPart.grouping) {
			obj.groupSeparator = fmt.integerPart.groupSeparator;
			obj.groupSize = fmt.integerPart.groupSize;
		}
		else {
			obj.groupSize = 0;
		}
		if (fmt.fractionalPart.grouping) {
			obj.fractionGroupSeparator = fmt.fractionalPart.groupSeparator;
			obj.fractionGroupSize = fmt.fractionalPart.groupSize;
		}
		else {
			obj.fractionGroupSize = 0;
		}

		return obj;
	}

	function bigNumberRoundingMode(fmt) {
		switch (fmt.roundingMethod) {
		case 'up': // away from zero
			return BigNumber.ROUND_UP;
		case 'down': // towards zero
			return BigNumber.ROUND_DOWN;
		case 'ceil': // towards infinity
			return BigNumber.ROUND_CEIL;
		case 'floor': // towards negative infinity
			return BigNumber.ROUND_FLOOR;
		case 'half_up':
			// towards nearest neighbor; halfway point goes away from zero
			//   -2.5 => -3    -1.5 => -2    1.5 => 2    2.5 => 3
			return BigNumber.ROUND_HALF_UP;
		case 'half_down':
			// towards nearest neighbor: halfway point goes towards zero
			//   -2.5 => -2    -1.5 => -1    1.5 => 1    2.5 => 2
			return BigNumber.ROUND_HALF_DOWN;
		case 'half_even':
			// towards nearest neighbor: halfway point goes to even neighbor
			//   -2.5 => -2    -1.5 => -2    1.5 => 2    2.5 => 2
			return BigNumber.ROUND_HALF_EVEN;
		case 'half_ceil':
			// towards nearest neighbor: halfway point goes towards infinity
			//   -2.5 => -2    -1.5 => -1    1.5 => 2    2.5 => 3
			return BigNumber.ROUND_HALF_CEIL;
		case 'half_floor':
			// towards nearest neighbor: halfway point goes towards negative infinity
			//   -2.5 => -3    -1.5 => -2    1.5 => 1    2.5 => 2
			return BigNumber.ROUND_HALF_FLOOR;
		}
	}

	// primitive {{{3

	function _format_primitive(val, fmt) {
		var method = window.Intl != null && window.Intl.NumberFormat != null ? 'intl' : 'bignumber';

		switch (method) {
		case 'intl':
			var config = {
				useGrouping: fmt.integerPart.grouping
			};

			if (fmt.decimalPlaces != null) {
				config.minimumFractionDigits = fmt.decimalPlaces;
				config.maximumFractionDigits = fmt.decimalPlaces;
			}
			else {
				config.minimumFractionDigits = 0;
				config.maximumFractionDigits = 17;
			}

			return window.Intl.NumberFormat(window.DATAVIS_LANG, config).format(val);
		case 'bignumber':
			return new BigNumber(val).toFormat(
				fmt.decimalPlaces,
				bigNumberRoundingMode(fmt),
				bigNumberFormat(fmt)
			);
		case 'numeral':
			return numeral(val).format(numeralFormat(fmt));
		default:
			console.error('[DataVis // Type(Number) // Format] Unsupported primitive value formatting method: %s', method);
		}
	}

	// main {{{3

	/**
	 * Formats a number.
	 *
	 * @param {number|Numeral|BigNumber} val
	 * The value that we're going to decode to a string.
	 *
	 * @param {Object} [fmt]
	 * Additional formatting options.
	 */

	function format(val, fmt, isCurrency) {
		var isNegative = false
			, str;

		// Number formatting works like this:
		//
		//   1. Is the value undefined, null, or NaN?
		//      Return the empty string.
		//
		//   2. Is the value negative?
		//      Format the positive value, then apply formatting for negative numbers.  This could be
		//      putting a minus sign in front, or surrounding with parens (e.g. for accounting).

		if (val == null) {
			return '';
		}
		else if (typeof val === 'number') {
			if (Number.isNaN(val)) {
				return '';
			}
			if (val < 0) {
				isNegative = true;
				val = val * -1;
			}
			str = _format_primitive(val, fmt);
		}
		else if (numeral.isNumeral(val)) {
			// Numeral doesn't wrap NaN.
			if (val.value() < 0) {
				isNegative = true;
				val = val.multiply(-1);
			}
			str = val.format(numeralFormat(fmt));
		}
		else if (BigNumber.isBigNumber(val)) {
			if (val.isNaN()) {
				return '';
			}
			if (val.isNegative()) {
				isNegative = true;
				val = val.abs();
			}
			str = val.toFormat(fmt.decimalPlaces, bigNumberRoundingMode(fmt), bigNumberFormat(fmt));
		}
		else {
			console.error('[DataVis // Type(Number) // Format] Unsupported value type: %s', val);
			return '';
		}

		if (isNegative) {
			switch (fmt.negativeFormat) {
			case 'minus':
				str = (isCurrency ? fmt.currencySymbol : '') + '-' + str;
				break;
			case 'parens':
				str = '(' + (isCurrency ? fmt.currencySymbol : '') + str + ')';
				break;
			}
		}
		else {
			str = (isCurrency ? fmt.currencySymbol : '') + str;
		}

		return str;
	}

	// natRep {{{2

	function natRep(val) {
		if (numeral.isNumeral(val)) {
			return val.value();
		}
		else if (moment.isMoment(val)) {
			return val.unix();
		}
		else {
			return val;
		}
	}

	// compare {{{2

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

	function compare(a, b) {
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
				return types.universalCmp(a, b);
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
				return types.universalCmp(a, b);
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
				return types.universalCmp(a, b);
			}
		}
		else {
			return types.universalCmp(a, b);
		}
	}

	// register {{{2

	types.registry.set('number', {
		matches: matches,
		parse: parse,
		decode: decode,
		format: format,
		natRep: natRep,
		compare: compare,
		supports: {
			group: true
		}
	});
})();

// Currency {{{1

(function () {

	// matches {{{2

	/**
	 * Recognize values that start with a dollar sign or are surrounded by parentheses as currency.
	 */

	// FIXME: We should recognize any symbol or abbreviation in any position, e.g. ¥400, 99 USD.

	function matches(val) {
		if (typeof val !== 'string') {
			console.error('[DataVis // Types // Currency // Parse] Call Error: `val` must be a string');
			return false;
		}

		if (val.charAt(0) === '$') {
			return types.registry.get('number').matches(val.substring(1));
		}
		else if (val.startsWith('(') && val.endsWith(')')) {
			return types.registry.get('number').matches(val.substring(1, val.length - 1));
    }
		return false;
	}

	// parse {{{2

	var re_comma = new RegExp(/,/g);

  function _parse(str, resultType) {
    if (str.charAt(0) === '$') {
      return _parse(str.substring(1));
    }
    else if (str.charAt(0) === '(' && str.charAt(-1) === ')') {
      return _parse(str.substring(1, str.length - 1)) * -1;
    }
    else if (!types.registry.get('number').matches(str)) {
			return null;
		}
		else {
			var noCommas = str.replace(re_comma, '');
			return resultType === 'string' ? noCommas
				: str.indexOf('.') >= 0 || str.indexOf('e') >= 0 ? parseFloat(noCommas)
				: parseInt(noCommas);
		}
  }

	function parse(str, ir) {
		var parsed;

		if (typeof str !== 'string') {
			console.error('[DataVis // Type(Currency) // Parse] Call Error: `val` must be a string');
			return null;
		}

		switch (ir) {
		case 'primitive':
			return _parse(str, 'number');
		case 'numeral':
			parsed = _parse(str, 'number');
			if (parsed == null) {
				return null;
			}
			return numeral(parsed);
		case 'bignumber':
			parsed = _parse(str, 'string');
			if (parsed == null) {
				return null;
			}
			return new BigNumber(parsed);
		default:
			console.error('[DataVis // Type(Currency) // Parse] Call Error: invalid internal representation: %s', ir);
			return null;
		}
	}

	// decode {{{2

	function decode(val, ir) {
		if (typeof val === 'string') {
			return parse(val, ir);
		}
		else if (typeof val === 'number') {
			switch (ir) {
			case 'primitive':
				return val;
			case 'bignumber':
				return new BigNumber(val);
			case 'numeral':
				return numeral(val);
			default:
				console.error('[DataVis // Type(Currency) // Decode] Call Error: invalid internal representation: %s', ir);
				return null;
			}
		}
		else {
			console.error('[DataVis // Type(Currency) // Decode] Call Error: unsupported conversion: %s to %s', typeof val, ir);
			return null;
		}
	}

	// format {{{2

	function format(val, fmt) {
		return types.registry.get('number').format(val, fmt, true);
	}

	// register {{{2

	types.registry.set('currency', {
		matches: matches,
		parse: parse,
		decode: decode,
		format: format,
		natRep: types.registry.get('number').natRep,
		compare: types.registry.get('number').compare,
		supports: {
			group: true
		}
	});
})();

// Date {{{1

(function () {

	var re_date = new RegExp(/^\d{4}-\d{2}-\d{2}$/);

	// matches {{{2

	function matches(val) {
		return re_date.test(val);
	}

	// parse {{{2

	function parse(val, ir, fmt) {
		var parsed;

		ir = ir || 'string';
		fmt = fmt || {};

		if (typeof val !== 'string') {
			console.error('[DataVis // Type(Date) // Parse] Call Error: `val` must be a string');
			return null;
		}

		switch (ir) {
		case 'string':
			return val;
		case 'native':
			return Date.parse(val);
		case 'moment':
			return moment(val, fmt);
		default:
			return null;
		}
	}

	// decode {{{2

	function decode(val, ir, fmt) {
		if (typeof val === 'string') {
			return parse(val, ir, fmt);
		}
	}

	// format {{{2

	function format(val, fmt) {
		if (val == null) {
			return '';
		}

		if (typeof val === 'string') {
			if (['', '0000-00-00', '0000-00-00 00:00:00'].indexOf(val) >= 0) {
				return '';
			}
			val = moment(val, 'YYYY-MM-DD');
		}
		else if (val instanceof Date) {
			val = moment(val);
		}

		if (!moment.isMoment(val)) {
			console.error('[DataVis // Type(Date) // Format] Unsupported value: %s', val);
			return '';
		}

		if (!val.isValid()) {
			return '';
		}

		return val.format(fmt.full);
	}

	// natRep {{{2

	// The native representation of a date is the same as the string representation, i.e. YYYY-MM-DD.

	function natRep(val) {
		if (typeof val === 'string') {
			return val;
		}
		else if (val instanceof Date) {
			return sprintf.sprintf('%04d-%02d-%02d', val.getFullYear(), val.getMonth() + 1, val.getDate());
		}
		else if (moment.isMoment(val)) {
			return val.format('YYYY-MM-DD');
		}
		else {
			return '';
		}
	}

	// compare {{{2

	function compare(a, b) {
		return types.registry.get('string').compare(natRep(a), natRep(b));
	}

	// register {{{2

	types.registry.set('date', {
		matches: matches,
		parse: parse,
		decode: decode,
		format: format,
		natRep: natRep,
		compare: compare,
		supports: {
			group: true
		}
	});
})();

// Date/Time {{{1

(function () {

	var re_datetime = new RegExp(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

	// matches {{{2

	function matches(str) {
		return re_datetime.test(str);
	}

	// parse {{{2

	function parse(str, ir, fmt) {
		var parsed;

		ir = ir || 'string';
		fmt = fmt || {};

		if (typeof str !== 'string') {
			console.error('[DataVis // Type(Date) // Parse] Call Error: `str` must be a string');
			return null;
		}

		switch (ir) {
		case 'string':
			return str;
		case 'native':
			return Date.parse(str);
		case 'moment':
			return moment(str, fmt);
		default:
			return null;
		}
	}

	// decode {{{2

	function decode(val, ir) {
		if (typeof val === 'string') {
			return parse(val, ir);
		}
		else {
			console.error('[DataVis // Type(Datetime) // Decode] Call Error: unsupported conversion: %s to %s', typeof val, ir);
			return null;
		}
	}

	// format {{{2

	// format {{{2

	function format(val, fmt) {
		if (val == null) {
			return '';
		}

		if (typeof val === 'string') {
			if (['', '0000-00-00', '0000-00-00 00:00:00'].indexOf(val) >= 0) {
				return '';
			}
			val = moment(val, 'YYYY-MM-DD HH:mm:ss');
		}
		else if (val instanceof Date) {
			val = moment(val);
		}

		if (!moment.isMoment(val)) {
			console.error('[DataVis // Type(Date) // Format] Unsupported value: %s', val);
			return '';
		}

		if (!val.isValid()) {
			return '';
		}

		if (fmt.abbrev && val.hour() === 0 && val.minute() === 0 && val.second() === 0) {
			return val.format(fmt.abbrev);
		}
		else {
			return val.format(fmt.full);
		}
	}

	// natRep {{{2

	// The native representation of a date is the same as the string representation, i.e. YYYY-MM-DD
	// HH:mm:ss.  It's an open design question for me whether or not we should include milliseconds.
	// In the current use cases, milliseconds aren't really used; they'd probably be more useful for
	// durations than for date/times.

	function natRep(val) {
		if (typeof val === 'string') {
			return val;
		}
		else if (val instanceof Date) {
			return sprintf.sprintf('%04d-%02d-%02d %02d:%02d:%02d',
				val.getFullYear(), val.getMonth() + 1, val.getDate(),
				val.getHours(), val.getMinutes(), val.getSeconds());
		}
		else if (moment.isMoment(val)) {
			return val.format('YYYY-MM-DD HH:mm:ss');
		}
		else {
			return '';
		}
	}

	// compare {{{2

	function compare(a, b) {
		return types.registry.get('string').compare(natRep(a), natRep(b));
	}

	// register {{{2

	types.registry.set('datetime', {
		matches: matches,
		parse: parse,
		decode: decode,
		format: format,
		natRep: natRep,
		compare: compare,
		supports: {
			group: true
		}
	});
})();

// Time {{{1

(function () {

	var re_time = new RegExp(/^\d{2}:\d{2}:\d{2}$/);

	// matches {{{2

	function matches(str) {
		return re_time.test(str);
	}

	// parse {{{2

	function parse(str, ir, fmt) {
		var parsed;

		ir = ir || 'string';

		if (typeof str !== 'string') {
			console.error('[DataVis // Type(Time) // Parse] Call Error: `str` must be a string');
			return null;
		}

		switch (ir) {
		case 'string':
			return str;
		case 'native':
			return Date.parse('2000-01-01T' + str + '.000Z');
		case 'moment':
			return moment('2000-01-01 ' + str, 'YYYY-MM-DD ' + (fmt || 'HH:mm:ss'));
		default:
			return null;
		}
	}

	// decode {{{2

	function decode(val, ir) {
		if (typeof val === 'string') {
			return parse(val, ir);
		}
		else {
			console.error('[DataVis // Type(Time) // Decode] Call Error: unsupported conversion: %s to %s', typeof val, ir);
			return null;
		}
	}

	// format {{{2

	function format(val, fmt) {
		if (val == null) {
			return '';
		}

		if (typeof val === 'string') {
			if (['', '0000-00-00', '0000-00-00 00:00:00'].indexOf(val) >= 0) {
				return '';
			}
			val = moment('2000-01-01 ' + val, 'YYYY-MM-DD HH:mm:ss');
		}
		else if (val instanceof Date) {
			val = moment(val);
		}

		if (!moment.isMoment(val)) {
			console.error('[DataVis // Type(Date) // Format] Unsupported value: %s', val);
			return '';
		}

		if (!val.isValid()) {
			return '';
		}

		return val.format(fmt.full);
	}

	// natRep {{{2

	function natRep(val) {
		if (typeof val === 'string') {
			return val;
		}
		else if (val instanceof Date) {
			return sprintf.sprintf('%02d:%02d:%02d',
				val.getHours(), val.getMinutes(), val.getSeconds());
		}
		else if (moment.isMoment(val)) {
			return val.format('HH:mm:ss');
		}
		else {
			return '';
		}
	}

	// compare {{{2

	function compare(a, b) {
		return types.registry.get('string').compare(natRep(a), natRep(b));
	}

	// register {{{2

	types.registry.set('time', {
		matches: matches,
		parse: parse,
		decode: decode,
		format: format,
		natRep: natRep,
		compare: compare,
		supports: {
			group: true
		}
	});
})();

// Duration {{{1

(function () {

	var matchRegexp = /^(\d+y\s*)?(\d+d\s*)?(\d+h\s*)?(\d+m\s*)?(\d+s\s*)?(\d+t\s*)?(\d+u)?$/;

	function maybeToInt(x) {
		var r = parseInt(x, 10);
		return isNaN(r) ? null : r;
	}

	function normalize(o) {
		// Normalize, e.g. 28h 65s = 1d 4h 1m 5s

		if (o.u >= 1000) { o.t += Math.floor(o.u / 1000); o.u = o.u % 1000; }
		if (o.t >= 1000) { o.s += Math.floor(o.t / 1000); o.t = o.t % 1000; }
		if (o.s >= 60)   { o.m += Math.floor(o.s / 60);   o.s = o.s % 60;   }
		if (o.m >= 60)   { o.h += Math.floor(o.m / 60);   o.m = o.m % 60;   }
		if (o.h >= 24)   { o.d += Math.floor(o.h / 24);   o.h = o.h % 24;   }
		if (o.d >= 365)  { o.y += Math.floor(o.d / 365);  o.d = o.d % 365;  }
	}

	// matches {{{2

	function matches(val) {
		return typeof val === 'string' && val.matches(matchRegexp);
	}

	// parse {{{2

	var parseRegexps = {};

	function compileParseRegexp(fmt) {
		var re = '';
		var spec = [];
		for (var i = 0; i < fmt.length; i += 1) {
			if (fmt[i] === '%') {
				spec.push(fmt[i+1]);
				re += '(\\d+)';
				i += 1;
			}
			else {
				if (['\\', '*', '+', '?', '.', '[', ']', '{', '}', '(', ')'].indexOf(fmt[i])) {
					// Escape regexp metacharacters
					re += '\\';
				}
				re += fmt[i];
			}
		}
		parseRegexps[fmt] = {
			re: new RegExp('^' + re + '$'),
			spec: spec
		};
	}

	function parse(str, ir, fmt) {
		var parsed;
		var m, o;

		ir = ir || 'object';

		if (typeof str !== 'string') {
			console.error('[DataVis // Type(Duration) // Parse] Call Error: `str` must be a string');
			return null;
		}

		if (fmt != null) {
			if (parseRegexps[fmt] == null) {
				compileParseRegexp(fmt);
			}

			m = str.match(parseRegexps[fmt].re);
			if (m == null) {
				return null;
			}
			o = { y: 0, d: 0, h: 0, m: 0, s: 0, t: 0, u: 0 };
			_.each(parseRegexps[fmt].spec, function (spec, i) {
				if (m[i+1] != null) {
					o[spec] = maybeToInt(m[i+1]) || 0;
				}
			});
		}
		else {
			m = str.match(matchRegexp);
			o = {
				y: maybeToInt(m[1]) || 0,
				d: maybeToInt(m[2]) || 0,
				h: maybeToInt(m[3]) || 0,
				m: maybeToInt(m[4]) || 0,
				s: maybeToInt(m[5]) || 0,
				t: maybeToInt(m[6]) || 0,
				u: maybeToInt(m[7]) || 0
			};
		}

		normalize(o);

		switch (ir) {
		case 'object':
			return o;
		default:
			console.error('[DataVis // Type(Duration) // Parse] Error: unsupported internal representation: ' + ir);
			return null;
		}
	}

	// decode {{{2

	function decode(val, ir, fmt) {
		if (typeof val === 'string') {
			return parse(val, ir, fmt);
		}
		else if (typeof val === 'object') {
			return val;
		}
	}

	// format {{{2

	var formatFuns = {};

	function compileFormatFun(fmt) {
		var fields = [];
		var s = '';
		for (var i = 0; i < fmt.length; i += 1) {
			if (fmt[i] === '%') {
				if (fmt[i+1] === '%') {
					s += '%%';
					i += 1;
				}
				else if (fmt[i+1] === '[') {
					s += '%%[';
					i += 1;
				}
				else {
					var m = fmt.substr(i+1).match(/^0?(\d*)([ydhmstu])/);
					if (m == null) {
						// Unrecognized format sequence.
						continue;
					}
					s += '%';
					if (m[0][0] === '0') {
						s += '0';
					}
					if (m[1].length > 0) {
						s += +m[1];
					}
					s += 'd';
					fields.push(m[2]);
					i += m[0].length;
				}
			}
			else {
				s += fmt[i];
			}
		}
		formatFuns[fmt] = function (val) {
			var args = [s];
			_.each(fields, function (f) {
				args.push(val[f]);
			});
			var r = sprintf.sprintf.apply(null, args);
			return r.replaceAll(/%\[([ydhmstu]):(.+?)\]/g, function (m, f, t) {
				return val[f] === 0 ? '' : t;
			});
		};
	}

	function format(val, fmt) {
		if (fmt != null) {
			if (formatFuns[fmt] == null) {
				compileFormatFun(fmt);
			}

			return formatFuns[fmt](val);
		}
		else {
			return val.y + 'y ' + val.d + 'd ' + val.h + 'h ' + val.m + 'm ' + val.s + 's ' + val.t + 't ' + val.u + 'u';
		}
	}

	// natRep {{{2

	function natRep(val) {
		return format(val);
	}

	// compare {{{2

	function compare(a, b) {
		if (typeof a === 'string') {
			a = decode(a, 'object');
		}
		if (typeof b === 'string') {
			b = decode(b, 'object');
		}

		if (a == null) return -1;
		if (b == null) return 1;

		if (a.y !== b.y) return a.y < b.y ? -1 : 1;
		if (a.d !== b.d) return a.d < b.d ? -1 : 1;
		if (a.h !== b.h) return a.h < b.h ? -1 : 1;
		if (a.m !== b.m) return a.m < b.m ? -1 : 1;
		if (a.s !== b.s) return a.s < b.s ? -1 : 1;
		if (a.t !== b.t) return a.t < b.t ? -1 : 1;
		if (a.u !== b.u) return a.u < b.u ? -1 : 1;
	}

	// add {{{2

	function add(a, b) {
		var r = { y: 0, d: 0, h: 0, m: 0, s: 0, t: 0, u: 0 };
		r.u = a.u + b.u;
		r.t = a.t + b.t;
		r.s = a.s + b.s;
		r.m = a.m + b.m;
		r.h = a.h + b.h;
		r.d = a.d + b.d;
		r.y = a.y + b.y;
		normalize(r);
		return r;
	}

	// register {{{2

	types.registry.set('duration', {
		matches: matches,
		parse: parse,
		decode: decode,
		format: format,
		natRep: natRep,
		compare: compare,
		add: add,
		supports: {
			group: true
		}
	});
})();

// JSON {{{1

(function () {

	// matches {{{2

	function matches(val) {
		return typeof val === 'string' && (
				(val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))
			);
	}

	// parse {{{2

	function parse(str, ir, fmt) {
		var parsed;

		ir = ir || 'obj';
		fmt = fmt || {};

		if (typeof str !== 'string') {
			console.error('[DataVis // Type(JSON) // Parse] Call Error: `str` must be a string');
			return null;
		}

		switch (ir) {
		case 'obj':
			try {
				return JSON.parse(str);
			}
			catch (e) {
				console.error('[DataVis // Type(JSON) // Parse] Failed to parse value: %s', e.toString());
				return null;
			}
		default:
			return null;
		}
	}

	// decode {{{2

	function decode(val, ir, fmt) {
		if (typeof val === 'string') {
			return parse(val, ir, fmt);
		}
		else if (typeof val === 'object') {
			return val;
		}
	}

	// format {{{2

	function format(val, opts) {
		if (val == null) {
			return '[invalid JSON]';
		}
		else if (typeof val === 'string') {
			return val;
		}
		else {
			return new JSONFormatter(val, 0, {
				onToggle: function (isOpen) {
					if (window.TableTool) {
						window.TableTool.update();
					}
				}
			}).render();
		}
	}

	// natRep {{{2
	// compare {{{2

	types.registry.set('json', {
		matches: matches,
		parse: parse,
		decode: decode,
		format: format,
		natRep: null,
		compare: null,
		supports: {
			group: false
		}
	});
})();

// Exports {{{1

export default types;
