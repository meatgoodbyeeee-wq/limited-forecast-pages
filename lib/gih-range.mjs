import fraRange from '../data/gih-range-fra.json' with { type: 'json' };
import {makeGihRange, typeGroup} from './gih-range-core.mjs';

// FRA's per-card GIH WR forecast range (nominal 80%), fitted on the adopted model's 28-set out-of-fold residuals (research/production_c3).
// Research and pre-registered selection: 17lands-limited-forecast-data/research/gih_interval/. Other sets: scripts/build-set-forecast.mjs.
export {typeGroup};
const fra = makeGihRange(fraRange);
export const gihRadius = fra.gihRadius;
export const withGihRange = fra.withGihRange;
export const gihRangeVersion = fra.gihRangeVersion;
