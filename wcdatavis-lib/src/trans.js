/**
 * Legacy translation bridge — delegates to the shared i18next instance so
 * there is a single source of truth for all translations.
 *
 * Callers that still use sprintf-style positional args
 *   trans('SOME.KEY', val0, val1)
 * are automatically mapped to i18next named interpolation:
 *   i18n.t('SOME.KEY', { param0: val0, param1: val1 })
 */
import i18n from 'i18next';

function trans(/* key, ...sprintfArgs */) {
	var args = Array.prototype.slice.call(arguments);
	var key = args.shift();

	if (args.length > 0) {
		var params = {};
		for (var i = 0; i < args.length; i++) {
			params['param' + i] = args[i];
		}
		return i18n.t(key, params);
	}

	return i18n.t(key);
}

export {
	trans,
};
