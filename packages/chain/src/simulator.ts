/**
 * Deterministic Payment Simulator
 *
 * Provides safe local testing without testnet credentials.
 * Explicitly marks all receipts as `isSimulated: true` and status `SIMULATED`.
 */

import type { ExecutionReceipt, PaymentProposal, PreflightDecision } from '../../core/src/schemas.ts';
import type { PaymentAdapter } from './payment-adapter.ts';

export class SimulatedPaymentAdapter implements PaymentAdapter {
  public chainId: string;
  public networkName: string;
  public isSimulated = true;

  constructor(chainId = '5042002', networkName = 'Circle Arc Testnet (Simulated)') {
    this.chainId = chainId;
    this.networkName = networkName;
  }

  public async executePayment(
    proposal: PaymentProposal,
    preflight: PreflightDecision
  ): Promise<ExecutionReceipt> {
    if (preflight.decision !== 'ALLOW') {
      throw new Error(
        `POLICY REFUSAL: Simulated payment rejected because preflight decision is ${preflight.decision}. Reasons: ${preflight.reasonCodes.join(', ')}`
      );
    }

    const mockHash = '0xsim' + Array.from({ length: 60 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    return {
      receiptId: `sim-rcpt-${Date.now()}`,
      requestId: proposal.requestId,
      chainId: this.chainId,
      txHash: mockHash,
      blockNumber: 999999,
      status: 'SIMULATED',
      asset: proposal.assetContract,
      recipient: proposal.recipient,
      amountBaseUnits: proposal.amountBaseUnits,
      executedAt: new Date().toISOString(),
      explorerUrl: undefined,
      isSimulated: true
    };
  }
}
