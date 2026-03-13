import _ from 'underscore';

// Lock {{{1
// Constructor {{{2

/**
 * An implementation of a counting semaphore for JavaScript.
 * @class
 */

export var Lock = function (name, opts) {
	var self = this;

	opts = opts || {};

	self._name = name || '#' + (Lock._id++);
	self._lockCount = opts.start || 0;
	self._onUnlock = [];
};

Lock._id = 1;

// #lock {{{2

/**
 * Engage the lock.  A lock can be engaged multiple times.  Each lock operation must be unlocked
 * separately to fully disengage the lock.
 *
 * @method
 */

Lock.prototype.lock = function (why) {
	var self = this;

	this._lockCount += 1;

	var msg = 'Locking to level: ' + self._lockCount;

	if (why != null) {
		msg += ' - ' + why;
	}

	console.debug('[DataVis // Lock(%s)] %s', self._name, msg);
};

// #unlock {{{2

/**
 * Disengage the lock.  A lock can be engaged multiple times.  Each lock operation must be unlocked
 * separately to fully disengage the lock.
 *
 * @method
 */

Lock.prototype.unlock = function (msg) {
	var self = this;

	self._lockCount -= 1;
	if (msg != null) {
		console.debug('[DataVis // Lock(%s)] Unlocking to level %s: %s', self._name, self._lockCount, msg);
	}
	else {
		console.debug('[DataVis // Lock(%s)] Unlocking to level %s', self._name, self._lockCount);
	}

	// If we're completely unlocked, start going through the functions that were registered to be run.
	// The only problem is that these functions can cause us to be locked again.  If that happens, we
	// abort.  The functions to run are a queue, and when we become unlocked we'll just resume running
	// the functions in the queue.

	var onUnlockLen = self._onUnlock.length;
	var i = 0;

	while (self._onUnlock.length > 0 && !self.isLocked()) {
		i += 1;
		var onUnlock = self._onUnlock.shift();
		console.debug('[DataVis // Lock(%s)] Running onUnlock function (%d of %d) - %s',
			self._name, i, onUnlockLen, onUnlock.info || '[NO INFO]');
		onUnlock.f();
	}
};

// #completelyUnlock {{{2

Lock.prototype.completelyUnlock = function () {
	var self = this;

	while (self.isLocked()) {
		self.unlock();
	}
};

// #isLocked {{{2

/**
 * Check to see if the lock is engaged.
 *
 * @method
 *
 * @returns {boolean} True if the lock is engaged, false if it's disengaged.
 */

Lock.prototype.isLocked = function () {
	var self = this;

	return self._lockCount !== 0;
};

// #onUnlock {{{2

/**
 * Register a function to call when the lock is fully disengaged (i.e. all locks have been
 * unlocked).
 *
 * @method
 *
 * @param {function} f Function to call when the lock is disengaged.
 */

Lock.prototype.onUnlock = function (f, info) {
	var self = this;

	// If we're not already locked, there's no point in queueing it up, just do it.  This can simplify
	// logic in callers (i.e. they don't have to do the check).

	if (!self.isLocked()) {
		return f();
	}

	self._onUnlock.push({
		f: f,
		info: info
	});

	console.debug('[DataVis // Lock(%s)] Saved onUnlock function (#%d) - %s',
		self._name, self._onUnlock.length, info || '[NO INFO]');
};

// #flushUnlockQueue

Lock.prototype.flushUnlockQueue = function () {
	var self = this;
	var count = self._onUnlock.length;
	if (count > 0) {
		var info = _.map(_.pluck(self._onUnlock, 'info'), function (i) {
			return i || '[NO INFO]';
		});
		console.debug('[DataVis // Lock(%s)] Flushing %d onUnlock functions: %O',
			self._name, count, info);
		self._onUnlock = [];
	}
};

// #clear {{{2

Lock.prototype.clear = function () {
	var self = this;
	self.flushUnlockQueue();
	self.completelyUnlock();
};

export default Lock;
