/**
 * PhishNet Interaction History Graph and Lineage Engine
 *
 * Implements:
 * - Structured event DAG (nodes = events, edges = parent links)
 * - Claim tracing: Who originally introduced this claim? Which agents repeated it?
 * - Source convergence analysis: Distinguish multi-agent echo chamber from genuine independent corroboration!
 */

import type { EventEnvelope, Actor, Claim } from '../../core/src/schemas.ts';

export interface GraphNode {
  event: EventEnvelope;
  actor?: Actor;
  children: string[]; // eventIds that reference this node as parent
}

export class InteractionGraph {
  public nodes: Map<string, GraphNode> = new Map();
  public actors: Map<string, Actor> = new Map();

  constructor(actors?: Actor[], events?: EventEnvelope[]) {
    if (actors) {
      for (const a of actors) this.actors.set(a.actorId, a);
    }
    if (events) {
      for (const e of events) this.addEvent(e);
    }
  }

  public addEvent(event: EventEnvelope): void {
    if (this.nodes.has(event.eventId)) {
      return; // Idempotent
    }

    const node: GraphNode = {
      event,
      actor: this.actors.get(event.actorId),
      children: []
    };
    this.nodes.set(event.eventId, node);

    // Link parents to this child
    for (const parentId of event.parentEventIds) {
      const parentNode = this.nodes.get(parentId);
      if (parentNode) {
        if (!parentNode.children.includes(event.eventId)) {
          parentNode.children.push(event.eventId);
        }
      }
    }
  }

  /**
   * Find ancestor events for an event by walking parentEventIds recursively
   */
  public getAncestors(eventId: string): EventEnvelope[] {
    const visited = new Set<string>();
    const ancestors: EventEnvelope[] = [];
    const queue = [eventId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const node = this.nodes.get(currentId);
      if (!node) continue;

      for (const parentId of node.event.parentEventIds) {
        if (!visited.has(parentId)) {
          visited.add(parentId);
          const parentNode = this.nodes.get(parentId);
          if (parentNode) {
            ancestors.push(parentNode.event);
            queue.push(parentId);
          }
        }
      }
    }
    return ancestors;
  }

  /**
   * Analyze Claim Provenance:
   * Traces a claim (e.g. "wallet address changed to 0x2222...") to its original event.
   * If Agent A repeats it and Agent B repeats it, detects that BOTH trace back to the same
   * single external event, proving "Source Convergence / Echo Chamber".
   */
  public analyzeClaimLineage(targetPhraseOrKey: string): {
    originEvent: EventEnvelope | null;
    repeatingEvents: EventEnvelope[];
    isEchoChamber: boolean;
    independentCorroboration: boolean;
  } {
    const matchingEvents: EventEnvelope[] = [];

    // Find all events mentioning the phrase or key in payload
    for (const node of this.nodes.values()) {
      const payloadStr = JSON.stringify(node.event.payload).toLowerCase();
      if (payloadStr.includes(targetPhraseOrKey.toLowerCase())) {
        matchingEvents.push(node.event);
      }
    }

    if (matchingEvents.length === 0) {
      return {
        originEvent: null,
        repeatingEvents: [],
        isEchoChamber: false,
        independentCorroboration: false
      };
    }

    // Sort matching events by timestamp / chronological order
    matchingEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const originEvent = matchingEvents[0];
    const repeatingEvents = matchingEvents.slice(1);

    // Check if repeating events depend directly or transitively on originEvent
    let allDependOnOrigin = true;
    for (const rep of repeatingEvents) {
      const ancestors = this.getAncestors(rep.eventId);
      const hasOriginAsAncestor = ancestors.some((anc) => anc.eventId === originEvent.eventId);
      if (!hasOriginAsAncestor && rep.parentEventIds.length > 0) {
        allDependOnOrigin = false;
      }
    }

    // Check if any event has sourceTrust: "verified_external" from a distinct channel/actor
    const hasIndependentChannel = matchingEvents.some(
      (e) =>
        e.sourceTrust === 'verified_external' &&
        e.actorId !== originEvent.actorId &&
        e.channel !== originEvent.channel
    );

    const isEchoChamber = repeatingEvents.length >= 1 && allDependOnOrigin && !hasIndependentChannel;

    return {
      originEvent,
      repeatingEvents,
      isEchoChamber,
      independentCorroboration: hasIndependentChannel
    };
  }
}
