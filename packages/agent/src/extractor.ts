/**
 * PhishNet Risk Analysis and Structured Claim Extraction Engine
 *
 * Evaluates interaction histories for:
 * - Claim provenance (attributing claims to original sources)
 * - Source convergence / Echo chamber detection
 * - Social engineering & persuasion indicators
 * - Discrepancies between initial human intent and proposed financial action
 * - Unsupported verification claims
 */

import type { EventEnvelope, RiskAnalysis, Claim, ManipulationIndicator } from '../../core/src/schemas.ts';
import { InteractionGraph } from '../../provenance/src/graph.ts';

export function analyzeInteractionHistory(
  sessionId: string,
  events: EventEnvelope[],
  graph?: InteractionGraph
): RiskAnalysis {
  const g = graph || new InteractionGraph(undefined, events);
  const observedEventIds = events.map((e) => e.eventId);
  const claims: Claim[] = [];
  const manipulationIndicators: ManipulationIndicator[] = [];
  const missingInformation: string[] = [];
  let sourceConvergenceDetected = false;
  let convergenceDetails = '';

  // 1. Scan events for claims, recipient changes, urgency, and persuasion
  const recipientClaims: Array<{ eventId: string; actorId: string; recipient: string; rawText: string }> = [];
  let originalAuthorizedRecipient: string | null = null;
  let originalAuthorizedAmount: string | null = null;

  for (const event of events) {
    const payload = event.payload;

    // Detect initial authorization
    if (event.eventType === 'authorization') {
      if (payload.recipient) originalAuthorizedRecipient = String(payload.recipient);
      if (payload.amountMinor || payload.amountBaseUnits) {
        originalAuthorizedAmount = String(payload.amountMinor || payload.amountBaseUnits);
      }
    }

    // Detect message claims
    if (event.eventType === 'message' || event.eventType === 'claim') {
      const claimText = String(payload.claim || payload.text || payload.message || '');
      const recipient = payload.recipient ? String(payload.recipient) : null;

      if (recipient) {
        recipientClaims.push({
          eventId: event.eventId,
          actorId: event.actorId,
          recipient,
          rawText: claimText
        });
      }

      // Check for urgency manipulation
      const urgencyKeywords = ['urgent', 'immediately', 'asap', 'within 1 hour', 'action required', 'suspend'];
      if (urgencyKeywords.some((kw) => claimText.toLowerCase().includes(kw))) {
        manipulationIndicators.push({
          type: 'urgency',
          evidenceEventIds: [event.eventId],
          explanation: `Linguistic urgency pressure detected: "${claimText.slice(0, 80)}..."`
        });
      }

      // Check for authority claims
      const authorityKeywords = ['accounting department', 'official notice', 'head of finance', 'ceo', 'security team'];
      if (authorityKeywords.some((kw) => claimText.toLowerCase().includes(kw))) {
        manipulationIndicators.push({
          type: 'authority_claim',
          evidenceEventIds: [event.eventId],
          explanation: `Authority role assertion without verified organizational credential: "${claimText.slice(0, 80)}..."`
        });
      }
    }
  }

  // 2. Analyze Recipient Claims & Provenance
  if (recipientClaims.length > 0) {
    const latestRecipientClaim = recipientClaims[recipientClaims.length - 1];
    const lineage = g.analyzeClaimLineage(latestRecipientClaim.recipient);

    const isDifferentFromOrigin =
      originalAuthorizedRecipient &&
      latestRecipientClaim.recipient.toLowerCase() !== originalAuthorizedRecipient.toLowerCase();

    if (isDifferentFromOrigin) {
      manipulationIndicators.push({
        type: 'payment_detail_change',
        evidenceEventIds: recipientClaims.map((r) => r.eventId),
        explanation: `Payment recipient mutated from originally authorized ${originalAuthorizedRecipient} to ${latestRecipientClaim.recipient}.`
      });
    }

    if (lineage.isEchoChamber) {
      sourceConvergenceDetected = true;
      convergenceDetails = `Recipient ${latestRecipientClaim.recipient} was repeated by ${lineage.repeatingEvents.length} agent(s), but all trace back to single unverified origin ${lineage.originEvent?.eventId}.`;
      manipulationIndicators.push({
        type: 'source_convergence',
        evidenceEventIds: [lineage.originEvent?.eventId || '', ...lineage.repeatingEvents.map((e) => e.eventId)].filter(Boolean),
        explanation: convergenceDetails
      });
      missingInformation.push('Independent out-of-band verification from established counterparty channel.');
    }

    // Add structured claim
    claims.push({
      claimId: `claim-${latestRecipientClaim.eventId}`,
      quotedSpan: latestRecipientClaim.rawText || `Recipient changed to ${latestRecipientClaim.recipient}`,
      originatingEventId: lineage.originEvent?.eventId || latestRecipientClaim.eventId,
      repeatedByEventIds: lineage.repeatingEvents.map((e) => e.eventId),
      evidenceIds: lineage.independentCorroboration ? [latestRecipientClaim.eventId] : [],
      verification: lineage.independentCorroboration ? 'verified' : (lineage.isEchoChamber ? 'unverified' : 'unknown'),
      attributedActorId: latestRecipientClaim.actorId
    });
  }

  // 3. Determine Overall Risk Recommendation (Advisory only)
  let recommendation: 'ADVISORY_CLEAR' | 'REVIEW' | 'ESCALATE' = 'ADVISORY_CLEAR';

  if (manipulationIndicators.some((m) => m.type === 'source_convergence' || m.type === 'payment_detail_change')) {
    recommendation = 'ESCALATE';
  } else if (manipulationIndicators.length > 0 || missingInformation.length > 0) {
    recommendation = 'REVIEW';
  }

  return {
    sessionId,
    modelId: 'phishnet-risk-extractor-v1',
    observedEventIds,
    claims,
    manipulationIndicators,
    missingInformation,
    recommendation,
    sourceConvergenceDetected,
    convergenceDetails: convergenceDetails || undefined
  };
}
