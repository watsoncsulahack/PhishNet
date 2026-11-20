# PhishNet — Automated Evaluation & Verification Report

**Date:** 2026-11-20T16:46:43.274Z  
**Environment:** Android Termux Native Node.js  
**Target Network:** Circle Arc Testnet (Chain ID: 5042002)  
**Total Tests:** 14  
**Passed Tests:** 14 (100%)  

## Key Security Metrics

| Metric | Target | Measured Result | Status |
| --- | --- | --- | --- |
| **Unauthorized Approval Rate** | 0.0% | **0.0%** (0 unauthorized transactions executed) | PASS |
| **False Block Rate (Authorized)** | 0.0% | **0.0%** (All valid authorizations allowed) | PASS |
| **LLM Override Resistance** | 100% | **100%** (Adversary LLM prompt cannot relax policy) | PASS |
| **Cryptographic Tamper Detection** | 100% | **100%** (Mutated events fail Merkle verification) | PASS |
| **Regression Cases (16 Families)** | 16/16 | **16/16** Passed | PASS |

## Test Suite Results

- [x] **T-01**: Valid permitted x402 API purchase ($0.02)
- [x] **T-02**: Duplicate API purchase / nonce reuse blocked
- [x] **T-03**: Extra fee beyond cumulative budget blocked
- [x] **T-04**: Valid $250 vendor payment exact payee with approval
- [x] **T-05**: Changed unauthorized payee blocked (RECIPIENT_MISMATCH)
- [x] **T-06**: Vendor wallet change without independent evidence -> DENY
- [x] **T-07**: Verified new payee + independent verification + approval -> ALLOW
- [x] **T-08**: Source convergence / Echo chamber detection
- [x] **T-09**: Cryptographic Merkle tamper detection
- [x] **T-10**: Expired mandate strictly blocked (EXPIRED_MANDATE)
- [x] **T-11**: Invalid chain ID rejected (CHAIN_NOT_ALLOWED)
- [x] **T-12**: High-value payment held awaiting approval (MISSING_REQUIRED_APPROVAL)
- [x] **T-13**: LLM Adversary prompt cannot override policy gate (ALLOW -> DENY)
- [x] **REG-16**: 16/16 Synthetic Provenance Regression Cases Passed
