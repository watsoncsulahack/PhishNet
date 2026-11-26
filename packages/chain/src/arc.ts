/** Arc configuration placeholder. Live execution is disabled until signing and receipt gates are tested. */
import type { ExecutionReceipt, PaymentProposal, PreflightDecision } from '../../core/src/schemas.ts';
import type { PaymentAdapter } from './payment-adapter.ts';
import { SimulatedPaymentAdapter } from './simulator.ts';

export class ArcTestnetAdapter implements PaymentAdapter {
  public chainId = '5042002';
  public networkName = 'Arc configuration (SIMULATED; no network connection)';
  public readonly isSimulated = true;
  private simulator = new SimulatedPaymentAdapter(this.chainId, this.networkName);

  constructor(options?: {rpcUrl?: string; explorerUrl?: string; privateKey?: string; allowLiveTestnet?: boolean}) {
    if (options?.allowLiveTestnet) {
      throw new Error('LIVE_EXECUTION_DISABLED: independent authorization, isolated signing and verified settlement are not implemented.');
    }
  }

  public async executePayment(proposal: PaymentProposal, preflight: PreflightDecision): Promise<ExecutionReceipt> {
    return this.simulator.executePayment(proposal, preflight);
  }
}
