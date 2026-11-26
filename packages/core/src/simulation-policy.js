/** Shared simulation policy. verifiedTransactionApproval is an internal verifier result, never a request field. */
export function evaluateDeterministicPolicy(proposal, mandate, options = {}) {
  const amountFields = [proposal?.amountBaseUnits, mandate?.amountMaxBaseUnits, mandate?.cumulativeBudgetBaseUnits, mandate?.spentBaseUnits ?? '0'];
  const invalid = !proposal || !mandate || amountFields.some(v => typeof v !== 'string' || !/^(0|[1-9][0-9]{0,29})$/.test(v)) ||
    !/^0x[0-9a-f]{40}$/i.test(proposal.recipient ?? '') || !/^0x[0-9a-f]{40}$/i.test(mandate.allowedRecipient ?? '') ||
    !proposal.nonce || !mandate.validAfter || !mandate.validUntil || !Number.isFinite(Date.parse(mandate.validAfter)) || !Number.isFinite(Date.parse(mandate.validUntil));
  if (invalid) return { decision: 'DENY', reasonCodes: ['INVALID_INPUT'], policyVersion: '1.0.0-deterministic' };
  const {
    consumedNonces = new Set(),
    cumulativeSpent = BigInt(mandate.spentBaseUnits || '0'),
    currentTimeUtc = new Date().toISOString()
  } = options;

  const reasons = [];
  let decision = 'ALLOW';
  const now = new Date(currentTimeUtc);

  // 1. Mandate expiration & validity
  if (mandate.validUntil && now > new Date(mandate.validUntil)) {
    reasons.push('EXPIRED_MANDATE');
    decision = 'DENY';
  }
  if (mandate.validAfter && now < new Date(mandate.validAfter)) {
    reasons.push('MANDATE_NOT_YET_VALID');
    decision = 'DENY';
  }

  // 2. Chain ID match
  if (String(proposal.chainId) !== String(mandate.chainId)) {
    reasons.push('CHAIN_NOT_ALLOWED');
    decision = 'DENY';
  }

  // 3. Asset contract match
  if ((proposal.assetContract || '').toUpperCase() !== (mandate.assetContract || '').toUpperCase()) {
    reasons.push('ASSET_NOT_ALLOWED');
    decision = 'DENY';
  }

  // 4. Nonce replay check
  const nonce = proposal.nonce || mandate.nonce;
  if (nonce && consumedNonces.has(nonce)) {
    reasons.push('REPLAY_NONCE');
    decision = 'DENY';
  }

  // 5. Amount limit
  const proposalAmount = BigInt(proposal.amountBaseUnits || '0');
  const maxAmount = BigInt(mandate.amountMaxBaseUnits || '0');
  if (proposalAmount <= 0n) {
    reasons.push('INVALID_AMOUNT');
    decision = 'DENY';
  }
  if (proposalAmount > maxAmount) {
    reasons.push('AMOUNT_EXCEEDS_LIMIT');
    decision = 'DENY';
  }

  // 6. Cumulative budget check
  const cumulativeBudget = BigInt(mandate.cumulativeBudgetBaseUnits || '0');
  const projectedSpend = cumulativeSpent + proposalAmount;
  if (projectedSpend > cumulativeBudget) {
    reasons.push('BUDGET_EXHAUSTED');
    decision = 'DENY';
  }

  // 7. Exact normalized recipient match
  const pRecipient = (proposal.recipient || '').trim().toLowerCase();
  const mRecipient = (mandate.allowedRecipient || '').trim().toLowerCase();
  const recipientMatches = pRecipient === mRecipient;

  if (!recipientMatches) {
    reasons.push('RECIPIENT_MISMATCH');
    decision = 'DENY';
  }

  // 8. High-value transaction approval requirement ($50.00 = 50,000,000 minor)
  const isHighValue = proposalAmount >= 50000000n;
  const humanApprovalRequired = isHighValue || !recipientMatches;

  if (decision === 'ALLOW') {
    if (humanApprovalRequired && !options.verifiedTransactionApproval) {
      decision = 'HOLD';
      reasons.push('MISSING_REQUIRED_APPROVAL');
    } else {
      reasons.push('SIMULATION_WITHIN_POLICY');
    }
  }

  return {
    requestId: proposal.requestId || `req-${Date.now()}`,
    decisionId: `dec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    decision,
    reasonCodes: reasons,
    policyVersion: '1.0.0-deterministic',
    issuedAt: new Date().toISOString()
  };
}

