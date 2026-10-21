import fraAdopted from '../data/adopted-gih-fra.json' with { type: 'json' };
import {withGihRange as fraWithGihRange} from './gih-range.mjs';
import {makeAdoptedGih} from './adopted-gih-core.mjs';

export {makeAdoptedGih};
const fra = makeAdoptedGih(fraAdopted, fraWithGihRange);
export const applyAdoptedGih = fra.applyAdoptedGih;
export const adoptedGihVersion = fra.adoptedGihVersion;
