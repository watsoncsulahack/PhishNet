import {createHash} from 'node:crypto';
import {canonical} from './contract.js';
export const sha=value=>createHash('sha256').update(value).digest('hex');
export function eventDigest(event){const copy=structuredClone(event);delete copy.integrity.eventDigest;return sha('phishnet.event.v1\n'+canonical(copy));}
