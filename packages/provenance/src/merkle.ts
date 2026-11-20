/**
 * Merkle Tree and Cryptographic Inclusion Proofs for PhishNet
 *
 * Implements deterministic append-only Merkle tree calculation,
 * proof path generation, and proof verification.
 */

import { computeLeafHash, computeNodeHash, sha256Hex } from './hash.ts';

export interface MerklePathElement {
  position: 'left' | 'right';
  hash: string;
}

export interface MerkleInclusionProof {
  eventId: string;
  leafIndex: number;
  leafHash: string;
  rootHash: string;
  proofPath: MerklePathElement[];
}

export class MerkleTree {
  private leaves: string[] = [];
  private eventIds: string[] = [];

  constructor(eventDigests: Array<{ eventId: string; digest: string }>) {
    this.buildTree(eventDigests);
  }

  private async buildTree(eventDigests: Array<{ eventId: string; digest: string }>) {
    this.leaves = [];
    this.eventIds = [];
    for (let i = 0; i < eventDigests.length; i++) {
      const leaf = await computeLeafHash(i, eventDigests[i].digest);
      this.leaves.push(leaf);
      this.eventIds.push(eventDigests[i].eventId);
    }
  }

  public async getRoot(leafHashes?: string[]): Promise<string> {
    let currentLevel = leafHashes || this.leaves;
    if (currentLevel.length === 0) {
      return await sha256Hex('phishnet.empty_root');
    }

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          const node = await computeNodeHash(currentLevel[i], currentLevel[i + 1]);
          nextLevel.push(node);
        } else {
          // Odd leaf: promote with itself or duplicate
          const node = await computeNodeHash(currentLevel[i], currentLevel[i]);
          nextLevel.push(node);
        }
      }
      currentLevel = nextLevel;
    }
    return currentLevel[0];
  }

  public async generateProof(eventId: string): Promise<MerkleInclusionProof | null> {
    const index = this.eventIds.indexOf(eventId);
    if (index === -1) return null;

    let currentLevel = [...this.leaves];
    let currentIndex = index;
    const proofPath: MerklePathElement[] = [];

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        const node = await computeNodeHash(left, right);
        nextLevel.push(node);

        if (i === currentIndex) {
          proofPath.push({ position: 'right', hash: right });
        } else if (i + 1 === currentIndex) {
          proofPath.push({ position: 'left', hash: left });
        }
      }
      currentIndex = Math.floor(currentIndex / 2);
      currentLevel = nextLevel;
    }

    const rootHash = currentLevel[0];
    return {
      eventId,
      leafIndex: index,
      leafHash: this.leaves[index],
      rootHash,
      proofPath
    };
  }

  public static async verifyProof(proof: MerkleInclusionProof): Promise<boolean> {
    let currentHash = proof.leafHash;
    for (const step of proof.proofPath) {
      if (step.position === 'left') {
        currentHash = await computeNodeHash(step.hash, currentHash);
      } else {
        currentHash = await computeNodeHash(currentHash, step.hash);
      }
    }
    return currentHash.toLowerCase() === proof.rootHash.toLowerCase();
  }
}
