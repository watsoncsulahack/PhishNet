/**
 * Circle Arc Testnet Payment Adapter
 *
 * Network Parameters (Verified from official Circle documentation):
 * - Chain ID: 5042002 (Hex: 0x4CEF52)
 * - RPC URL: https://rpc.testnet.arc.io
 * - Native Token: USDC
 * - Block Explorer: https://explorer.testnet.arc.io
 */

import type { ExecutionReceipt, PaymentProposal, PreflightDecision } from '../../core/src/schemas.ts';
import type { PaymentAdapter } from './payment-adapter.ts';
import { SimulatedPaymentAdapter } from './simulator.ts';

export class ArcTestnetAdapter implements PaymentAdapter {
  public chainId = '5042002';
  public networkName = 'Circle Arc Testnet';
  public isSimulated: boolean;
  private rpcUrl: string;
  private explorerUrl: string;
  private privateKey?: string;
  private simulator: SimulatedPaymentAdapter;

  constructor(options?: {
    rpcUrl?: string;
    explorerUrl?: string;
    privateKey?: string;
    allowLiveTestnet?: boolean;
  }) {
    this.rpcUrl = options?.rpcUrl || 'https://rpc.testnet.arc.io';
    this.explorerUrl = options?.explorerUrl || 'https://explorer.testnet.arc.io';
    this.privateKey = options?.privateKey;
    this.isSimulated = !(options?.allowLiveTestnet && this.privateKey);
    this.simulator = new SimulatedPaymentAdapter('5042002', 'Circle Arc Testnet');
  }

  public async executePayment(
    proposal: PaymentProposal,
    preflight: PreflightDecision
  ): Promise<ExecutionReceipt> {
    // ENFORCEMENT INVARIANT: Only ALLOW decisions can be executed
    if (preflight.decision !== 'ALLOW') {
      throw new Error(
        `PAYMENT EXECUTION BLOCKED: Preflight status is ${preflight.decision} (Reasons: ${preflight.reasonCodes.join(', ')}). The signing engine strictly refuses to sign or broadcast unauthorized transactions.`
      );
    }

    if (this.isSimulated) {
      return await this.simulator.executePayment(proposal, preflight);
    }

    // Fail closed: the former placeholder fabricated a SETTLED receipt without
    // signing, broadcasting, or checking a receipt. Never claim settlement here.
    throw new Error('Live Arc payments are not implemented. No transaction was signed or broadcast.');
  }
}
