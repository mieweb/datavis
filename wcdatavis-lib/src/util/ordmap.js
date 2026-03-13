import _ from 'underscore';
import jQuery from 'jquery';
import JSONFormatter from 'json-formatter-js';

import deepCopy from './deepCopy.js';

// OrdMap {{{1

/**
 * Create a map (a.k.a. dictionary) where the order of the keys added to the data structure is
 * maintained.
 *
 * @class
 *
 * @property {Array<string>} keys List of all keys, in the order they were inserted.
 * @property {Object<string, number>} keyIndex Associates key with the index it was inserted at.
 * @property {Object} map Contains all the data inserted.
 * @property {number} size Number of elements in the map.
 */

function OrdMap() {
	this._keys = [];
	this._keyIndex = {};
	this._map = {};
	this._size = 0;
	this._setHandlers = {};
	this._prepend = false;
}

Object.defineProperty(OrdMap, 'name', {value: 'OrdMap'});
OrdMap.prototype = Object.create(Object.prototype);
OrdMap.prototype.constructor = OrdMap;

// .fromArray {{{2

/**
 * Construct a new OrdMap from an array of values.
 *
 * @method
 *
 * @param {Array.<object>} values The values to add to the new OrdMap.
 * @param {string} keyField Name of the field to use as the key.
 * @returns {OrdMap} An OrdMap containing the values.
 */

OrdMap.fromArray = function (values, keyField) {
	var o = new OrdMap();

	if (!_.isArray(values)) {
		throw new Error('Call Error: `values` must be an array');
	}
	if (!_.isString(keyField) && !_.isNumber(keyField)) {
		throw new Error('Call Error: `keyField` must be a string or number');
	}

	for (var i = 0; i < values.length; i += 1) {
		o.set(values[i][keyField], values[i]);
	}

	return o;
};

// .fromMerge {{{2

/**
 * Construct a new OrdMap by merging several OrdMaps together.
 *
 * @param {Array.<OrdMap>} maps
 * The OrdMaps to merge.
 */

OrdMap.fromMerge = function (maps) {
	var o = new OrdMap();

	for (var i = 0; i < maps.length; i += 1) {
		if (!(maps[i] instanceof OrdMap)) {
			throw new Error('Call Error: `maps[' + i + ']` must be an OrdMap');
		}
		maps[i].each(function (v, k) {
			if (!o.isSet(k)) {
				o.set(k, v);
			}
		});
	}

	return o;
};

// .deserialize {{{2

OrdMap.deserialize = function (x) {
	var result = new OrdMap();

	if (typeof x === 'string') {
		x = JSON.parse(x);
	}

	for (var i = 0; i < x._keys.length; i += 1) {
		if (x._map[x._keys[i]] !== undefined) {
			result.set(x._keys[i], x._map[x._keys[i]]);
		}
	}

	return result;
};

OrdMap.fromJSON = OrdMap.deserialize;

// #setInsertOrder {{{2

/**
 * Allows the insertion order to be reversed.
 *
 * @param {string} dir
 * Set the insertion order to 'append' or 'prepend' to control how adding items to the map works.
 */

OrdMap.prototype.setInsertOrder = function (dir) {
	switch (dir) {
	case 'append':
		this._prepend = false;
		break;
	case 'prepend':
		this._prepend = true;
		break;
	default:
		throw new Error('Call Error: `dir` must be either "append" or "prepend"');
	}
};

// #get {{{2

/**
 * Retrieve a key/value association from the map.
 *
 * @method
 *
 * @param {string} k The key to retrieve.
 * @param {any} d The default to return if `k` is not set.
 * @returns {any} The value associated with that key.
 */

OrdMap.prototype.get = function (k, d) {
	return this.isSet(k) ? this._map[k] : d;
};

// #set {{{2

/**
 * Create a key/value association in the map.
 *
 * @method
 *
 * @param {string} k The key to use.
 * @param {any} v The value to use.
 */

OrdMap.prototype.set = function (k, v) {
	if (!this.isSet(k)) {
		if (this._prepend) {
			this._keys.unshift(k);
		}
		else {
			this._keys.push(k);
		}
		this._keyIndex[k] = this._keys.length - 1;
		this._size += 1;
	}

	this._map[k] = v;

	// Invoke all the handlers for when this value was set.

	if (this._setHandlers[k] != null) {
		for (var i = 0; i < this._setHandlers[k].length; i += 1) {
			this._setHandlers[k][i](v);
		}
		this._setHandlers[k] = null;
	}
};

// #append {{{2

OrdMap.prototype.append = function (k, v) {
	if (this.isSet(k)) {
		if (!Array.isArray(this._map[k])) {
			this._map[k] = [this._map[k]];
		}
		this._map[k].push(v);
	}
	else {
		this.set(k, [v]);
	}
};

// #unset {{{2

/**
 * Remove a key/value association from the map.
 *
 * @method
 *
 * @param {string} k The key for the association to remove.
 */

OrdMap.prototype.unset = function (k) {
	delete this._keyIndex[k];
	delete this._map[k];
	this._size -= 1;
};

// #isSet {{{2

/**
 * Indicate if there is an association set for the specified key.
 *
 * @method
 *
 * @param {string} k The key to check on.
 * @returns {boolean} True if there is an association for this key, false if there is not.
 */

OrdMap.prototype.isSet = function (k) {
	return this._keyIndex[k] !== undefined;
};

// #each {{{2

/**
 * Iterate over the map in the order of the keys inserted.  This is the principle way in which
 * OrdMap differs from a regular JavaScript object.
 *
 * @method
 *
 * @param {function} f A function called for each existing association.  The function is invoked
 * like this: f(VALUE, KEY, KEY-NUMBER).
 */

OrdMap.prototype.each = function (f) {
	var i, j = 0,
		k, v, keyLen = this._keys.length;
	for (i = 0; i < keyLen; i += 1) {
		k = this._keys[i];
		if (this._keyIndex[k] === i) {
			v = this._map[k];
			f(v, k, j);
			j += 1;
		}
	}
};

// #keys {{{2

/**
 * Get a list of the keys used, in the order they were inserted.
 *
 * @method
 *
 * @returns {array} All the keys in order.
 */

OrdMap.prototype.keys = function () {
	var i, k, result = [], keyLen = this._keys.length;
	for (i = 0; i < keyLen; i += 1) {
		k = this._keys[i];
		if (this._keyIndex[k] === i) {
			result.push(k);
		}
	}
	return result;
};

// #toString {{{2

OrdMap.prototype.toString = function () {
	var s = '';
	this.each(function (v, k) {
		v = JSON.stringify(v);
		if (v == null) {
			v = 'null';
		}
		if (s !== '') {
			s += ', ';
		}
		s += '"' + k + '": ' + v;
	});
	return '{' + s + '}';
};

// #asMap {{{2

/**
 * Returns the internal representation of this ordered map as a regular JS object (a map with no
 * way to tell the order).  Changing the return value will change the internal representation of
 * this ordered map, so adding/removing keys will completely screw the `OrdMap` instance up!
 */

OrdMap.prototype.asMap = function () {
	return this._map;
};

// #asHtmlDefnList {{{2

OrdMap.prototype.asHtmlDefnList = function () {
	var dl = jQuery('<dl>');
	this.each(function (v, k) {
		var dt = jQuery('<dt>').text(k);
		var dd = jQuery('<dd>');
		if (v instanceof jQuery || v instanceof Element) {
			dd.append(v);
		}
		else if (_.isObject(v)) {
			dd.append(new JSONFormatter(v, 0).render());
		}
		else {
			dd.text(v);
		}
		jQuery('<div>')
			.append(dt)
			.append(dd)
			.appendTo(dl);
	});
	return dl;
};

// #serialize / #toJSON {{{2

OrdMap.prototype.serialize = function () {
	return {
		_keys: this.keys(),
		_map: this.asMap()
	};
};

OrdMap.prototype.toJSON = OrdMap.prototype.serialize;

// #size {{{2

/**
 * Tells the number of keys.
 */

OrdMap.prototype.size = function () {
	return this._size;
};

/**
 * Call an event handler when a key is set in this map.  If the key is already set, then the handler
 * is invoked immediately.
 *
 * @param {string} k
 * The key to monitor.
 *
 * @param {function} h
 * The handler to set.
 */

OrdMap.prototype.whenSet = function (k, h, opts) {
	opts = opts || {};

	if (opts.prepend == null) {
		opts.prepend = false;
	}

	if (this.isSet(k)) {
		return h(this.get(k));
	}

	if (this._setHandlers[k] == null) {
		this._setHandlers[k] = [];
	}

	if (opts.prepend) {
		this._setHandlers[k].unshift(h);
	}
	else {
		this._setHandlers[k].push(h);
	}
};

// #filter {{{2

OrdMap.prototype.filter = function (test) {
	var result = new OrdMap();

	this.each(function (v, k) {
		if (test(v, k)) {
			result.set(k, v);
		}
	});

	return result;
};

// #clone {{{2

OrdMap.prototype.clone = function () {
	var result = new OrdMap();

	this.each(function (v, k) {
		result.set(k, deepCopy(v));
	});

	return result;
};

// #clear {{{2

OrdMap.prototype.clear = function () {
	this._keys = [];
	this._keyIndex = {};
	this._map = {};
	this._size = 0;
};

// #replaceWith {{{2

OrdMap.prototype.replaceWith = function (o) {
	var self = this;

	if (!(o instanceof OrdMap)) {
		throw new Error('Call Error: `o` must be an instance of OrdMap');
	}

	self.clear();
	o.each(function (v, k) {
		self.set(k, v);
	});
};

// #mergeWith {{{2

OrdMap.prototype.mergeWith = function (o) {
	var self = this;
	var numSet = 0;

	if (!(o instanceof OrdMap)) {
		throw new Error('Call Error: `o` must be an instance of OrdMap');
	}

	o.each(function (v, k) {
		if (!self.isSet(k)) {
			self.set(k, v);
			numSet += 1;
		}
	});

	return numSet;
};

// #_changeKeyIndex {{{2

OrdMap.prototype._changeKeyIndex = function (oldIndex, newIndex) {
	var self = this;

	var key = self._keys[oldIndex];
	self._keys.splice(oldIndex, 1);
	self._keys.splice(newIndex, 0, key);
};

// Exports {{{1

export default OrdMap;
