/**
 * PhishNet Payment Adapter Interface and Execution Controller
 */

import type { ExecutionReceipt, PaymentProposal, PreflightDecision } from '../../core/src/schemas.ts';

export interface PaymentAdapter {
  chainId: string;
  networkName: string;
  isSimulated: boolean;

  executePayment(
    proposal: PaymentProposal,
    preflight: PreflightDecision
  ): Promise<ExecutionReceipt>;
}
