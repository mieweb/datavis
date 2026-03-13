// Vendored subset of @mieweb/wcdatavis
// Only exports the symbols used by datavis NITRO.
// Skips jQuery UI plugin initialization (block-ui, flatpickr, etc.)

import jQuery from 'jquery';
import original_jQuery from './global-jquery.js';

import './wcdatavis.css';

import OrdMap from './src/util/ordmap.js';
import { ParamInput } from './src/source_param.js';
import { Source } from './src/source.js';
import { ComputedView } from './src/computed_view.js';
import { Prefs } from './src/prefs.js';
import { PrefsBackend, PREFS_BACKEND_REGISTRY } from './src/prefs_backend.js';
import { Perspective } from './src/perspective.js';
import { Aggregate, AggregateInfo, AGGREGATE_REGISTRY } from './src/aggregates.js';
import * as Util from './src/util/misc.js';
import Lock from './src/util/lock.js';

if (original_jQuery != null) {
  window.jQuery = original_jQuery;
}
else {
  delete window.jQuery;
}

export {
  Source,
  ParamInput,
  ComputedView,
  Prefs,
  PrefsBackend,
  Perspective,
  jQuery,
  OrdMap,
  Lock,
  Util,
  Aggregate,
  AggregateInfo,
  AGGREGATE_REGISTRY,
  PREFS_BACKEND_REGISTRY
};
