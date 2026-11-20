/**
 * PhishNet Deterministic Policy Engine
 *
 * Implements strict non-LLM transaction verification:
 * - Recipient matching (normalized)
 * - Amount bounds
 * - Cumulative budget & consumed budget
 * - Expiration & validity windows
 * - Asset & Chain verification
 * - Nonce replay protection
 * - Independent verification requirement for payee changes
 * - Human sign-off enforcement for high-value transactions
 *
 * INVARIANT: LLM risk recommendations NEVER override this engine!
 */

import type { PaymentMandate, PaymentProposal, PreflightDecision, ReasonCode } from './schemas.ts';

export interface PolicyEvaluationContext {
  proposal: PaymentProposal;
  mandate: PaymentMandate;
  consumedNonces: Set<string>;
  cumulativeSpentBaseUnits: bigint;
  independentVerificationEvents: Array<{
    eventId: string;
    targetRecipient: string;
    verifiedByChannel: string;
    isIndependent: boolean;
  }>;
  humanApprovalGranted?: boolean;
  currentTimeUtc?: string; // Optional override for testing
}

export function evaluatePaymentPolicy(ctx: PolicyEvaluationContext): PreflightDecision {
  const { proposal, mandate, consumedNonces, cumulativeSpentBaseUnits, independentVerificationEvents, humanApprovalGranted } = ctx;
  const now = new Date(ctx.currentTimeUtc || new Date().toISOString());
  const reasons: ReasonCode[] = [];
  let decision: 'ALLOW' | 'HOLD' | 'DENY' = 'ALLOW';

  // 1. Check Mandate Expiry and Validity Window
  const validUntil = new Date(mandate.validUntil);
  const validAfter = new Date(mandate.validAfter);

  if (now > validUntil) {
    reasons.push('EXPIRED_MANDATE');
    decision = 'DENY';
  }

  if (now < validAfter) {
    reasons.push('MANDATE_NOT_YET_VALID');
    decision = 'DENY';
  }

  // 2. Check Chain ID
  if (proposal.chainId !== mandate.chainId) {
    reasons.push('CHAIN_NOT_ALLOWED');
    decision = 'DENY';
  }

  // 3. Check Asset Contract / Currency
  if (proposal.assetContract.toUpperCase() !== mandate.assetContract.toUpperCase()) {
    reasons.push('ASSET_NOT_ALLOWED');
    decision = 'DENY';
  }

  // 4. Check Nonce Replay
  const proposalNonce = proposal.nonce || mandate.nonce;
  if (consumedNonces.has(proposalNonce)) {
    reasons.push('REPLAY_NONCE');
    decision = 'DENY';
  }

  // 5. Check Amount Limits
  const proposalAmount = BigInt(proposal.amountBaseUnits);
  const maxAmount = BigInt(mandate.amountMaxBaseUnits);
  if (proposalAmount > maxAmount) {
    reasons.push('AMOUNT_EXCEEDS_LIMIT');
    decision = 'DENY';
  }

  // 6. Check Cumulative Budget
  const cumulativeBudget = BigInt(mandate.cumulativeBudgetBaseUnits);
  const totalProjected = cumulativeSpentBaseUnits + proposalAmount;
  if (totalProjected > cumulativeBudget) {
    reasons.push('BUDGET_EXHAUSTED');
    decision = 'DENY';
  }

  // 7. Check Recipient Match
  const normalizedProposalRecipient = proposal.recipient.trim().toLowerCase();
  const normalizedMandateRecipient = mandate.allowedRecipient.trim().toLowerCase();

  const recipientMatches = normalizedProposalRecipient === normalizedMandateRecipient;

  if (!recipientMatches) {
    // If recipient does NOT match the mandate's allowed recipient:
    // Check if there is a valid independent verification for this new payee
    const hasIndependentVerification = independentVerificationEvents.some(
      (v) => v.targetRecipient.trim().toLowerCase() === normalizedProposalRecipient && v.isIndependent
    );

    if (hasIndependentVerification) {
      // If there is independent verification, it requires a fresh human approval or signed mandate
      if (!humanApprovalGranted) {
        reasons.push('NEW_PAYEE_UNVERIFIED');
        if (decision !== 'DENY') decision = 'HOLD';
      }
    } else {
      reasons.push('RECIPIENT_MISMATCH');
      decision = 'DENY';
    }
  }

  // 8. Purpose code check
  if (mandate.purposeCode && proposal.purposeCode && mandate.purposeCode !== proposal.purposeCode) {
    reasons.push('PURPOSE_AND_AMOUNT_OUTSIDE_SCOPE');
    decision = 'DENY';
  }

  // 9. High-value human approval check (e.g. >= $50, which is 50,000,000 base units for USDC)
  const isHighValue = proposalAmount >= 50000000n;
  const humanApprovalRequired = isHighValue || !recipientMatches;

  if (decision === 'ALLOW') {
    if (humanApprovalRequired && !humanApprovalGranted) {
      decision = 'HOLD';
      reasons.push('MISSING_REQUIRED_APPROVAL');
    } else {
      reasons.push('AUTHORIZED_AND_VERIFIED');
    }
  }

  const decisionId = `dec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  return {
    requestId: proposal.requestId,
    decisionId,
    decision,
    reasonCodes: reasons,
    policyVersion: 'phishnet-v1.0.0-strict',
    claimIds: [],
    evidenceIds: proposal.sourceEventIds || [],
    issuedAt: now.toISOString(),
    authoritativeDetails: {
      recipient: proposal.recipient,
      amountBaseUnits: proposal.amountBaseUnits,
      asset: proposal.assetContract,
      chainId: proposal.chainId,
      humanApprovalRequired,
      humanApprovalGranted: !!humanApprovalGranted
    }
  };
}
