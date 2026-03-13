import jQuery from 'jquery';

/**
 * Create a deep copy of an object.
 *
 * @memberof util.data_structures
 * @inner
 *
 * @param {any} x0
 * The thing to copy.
 *
 * @return {any}
 * A clean copy of the argument.
 */

export default function (x0) {
	var depth = 0;
	var depthLimit = 99;
	var path = [];

	if (x0 == null) {
		return {};
	}

	function recursive(x, depth) {
		if (depth > depthLimit) {
			throw new Error('deepCopy: Maximum recursion depth exceeded');
		}

		var result;

		if (jQuery.isArray(x)) {
			result = [];

			for (var i = 0; i < x.length; i += 1) {
				path.push(i);
				result[i] = recursive(x[i], depth + 1);
				path.pop();
			}

			return result;
		}
		else if (jQuery.isPlainObject(x)) {
			result = {};

			for (var k in x) {
				if (Object.prototype.hasOwnProperty.call(x, k)) {
					path.push(k);
					result[k] = recursive(x[k], depth + 1);
					path.pop();
				}
			}

			return result;
		}
		else {
			return x;
		}
	}

	return recursive(x0, 0);
};
