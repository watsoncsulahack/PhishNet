/**
 * Cryptographic Canonical Hashing for PhishNet Events
 *
 * Implements domain separation (RFC 9162 style):
 * - Event digest: SHA256("phishnet.event.v1:" || canonicalJson(eventWithoutSignature))
 * - Leaf digest:  SHA256("phishnet.leaf.v1:" || index || ":" || eventDigest)
 * - Node digest:  SHA256("phishnet.node.v1:" || leftHash || rightHash)
 */

import type { EventEnvelope } from '../../core/src/schemas.ts';

// Stable key-sorted canonical JSON serialization
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    return JSON.stringify(key) + ':' + canonicalJsonStringify(val);
  });
  return '{' + pairs.join(',') + '}';
}

// Simple browser/node cross-compatible SHA256 helper
export async function sha256Hex(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js crypto fallback
    const cryptoModule = await import('crypto');
    return cryptoModule.createHash('sha256').update(message, 'utf8').digest('hex');
  }
}

// Compute canonical event digest excluding signature
export async function computeEventDigest(event: EventEnvelope): Promise<string> {
  const eventToDigest = {
    schemaVersion: event.schemaVersion,
    domain: 'phishnet.event.v1',
    eventId: event.eventId,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
    actorId: event.actorId,
    actorKind: event.actorKind,
    channel: event.channel,
    eventType: event.eventType,
    sourceTrust: event.sourceTrust,
    payload: event.payload,
    parentEventIds: event.parentEventIds
  };
  const canonical = canonicalJsonStringify(eventToDigest);
  return await sha256Hex('phishnet.event.v1:' + canonical);
}

// Compute leaf hash
export async function computeLeafHash(index: number, eventDigest: string): Promise<string> {
  return await sha256Hex(`phishnet.leaf.v1:${index}:${eventDigest}`);
}

// Compute parent node hash
export async function computeNodeHash(left: string, right: string): Promise<string> {
  return await sha256Hex(`phishnet.node.v1:${left}:${right}`);
}
