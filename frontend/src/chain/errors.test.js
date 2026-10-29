import { describe, expect, it } from 'vitest';
import { CONTRACT_ERRORS, METHOD_ERRORS, ChainError, describeSimulationError, describeWalletError, friendlyError } from './errors';

const AGERO = 'CA5CMRJJHCJZIKVGFIOEV3BGVNTQVOI6KYV4S3GOROHUS7HLUUYLBDFB';
const XLM = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const ids = { contractId: AGERO, tokenId: XLM };

// Real simulateTransaction error strings captured from Testnet on 2026-10-29
const BELOW_PRICE = `HostError: Error(Contract, #8)

Event log (newest first):
   0: [Diagnostic Event] contract:${AGERO}, topics:[error, Error(Contract, #8)], data:"escalating Ok(ScErrorType::Contract) frame-exit to Err"
   1: [Diagnostic Event] topics:[fn_call, ${AGERO}, create_job], data:[GBTB, GAR3, 1, 3600]
`;
const INSUFFICIENT_BALANCE = `HostError: Error(Contract, #10)

Event log (newest first):
   0: [Diagnostic Event] contract:${AGERO}, topics:[error, Error(Contract, #10)], data:"escalating error to VM trap from failed host function call: call"
   1: [Diagnostic Event] contract:${AGERO}, topics:[error, Error(Contract, #10)], data:["contract call failed", transfer, [GBTB, ${AGERO}, 10000000000000000]]
   2: [Failed Diagnostic Event (not emitted)] contract:${XLM}, topics:[error, Error(Contract, #10)], data:["resulting balance is not within the allowed range", 10000000, -9999900010502769, 9223372036854775807]
   3: [Diagnostic Event] contract:${AGERO}, topics:[fn_call, ${XLM}, transfer], data:[GBTB, ${AGERO}, 10000000000000000]
`;
const INVALID_STATE = `HostError: Error(Contract, #10)

Event log (newest first):
   0: [Diagnostic Event] contract:${AGERO}, topics:[error, Error(Contract, #10)], data:"escalating Ok(ScErrorType::Contract) frame-exit to Err"
   1: [Diagnostic Event] topics:[fn_call, ${AGERO}, refund_job], data:[1, GBTB]
`;

describe('describeSimulationError', () => {
  it('maps every contract error code 1..14', () => {
    for (let code = 1; code <= 14; code++) {
      const text = `HostError: Error(Contract, #${code})\n   0: [Diagnostic Event] contract:${AGERO}, topics:[error, Error(Contract, #${code})], data:""`;
      expect(describeSimulationError(text, ids)).toEqual({ kind: 'contract', code, message: CONTRACT_ERRORS[code] });
    }
  });

  it('reads real contract errors', () => {
    expect(describeSimulationError(BELOW_PRICE, ids)).toMatchObject({ kind: 'contract', code: 8, message: "Amount is below the agent's price." });
    expect(describeSimulationError(INVALID_STATE, ids)).toMatchObject({ kind: 'contract', code: 10 });
  });

  it('tells an XLM token failure apart from the same code in the Agero contract', () => {
    const d = describeSimulationError(INSUFFICIENT_BALANCE, ids);
    expect(d.kind).toBe('token');
    expect(d.code).toBe(10);
    expect(d.message).toMatch(/Insufficient XLM balance/);
  });

  it('falls back to the head line when there is no event log', () => {
    expect(describeSimulationError('HostError: Error(Contract, #13)', ids)).toMatchObject({ kind: 'contract', code: 13 });
  });

  it('reports auth and unknown failures', () => {
    expect(describeSimulationError('HostError: Error(Auth, InvalidAction)', ids).kind).toBe('auth');
    expect(describeSimulationError('HostError: Error(Budget, ExceededLimit)', ids).kind).toBe('rpc');
    expect(describeSimulationError('weird failure\nmore', ids)).toEqual({ kind: 'unknown', code: null, message: 'Simulation failed: weird failure' });
    expect(describeSimulationError('', ids).message).toBe('Simulation failed.');
  });

  it('uses method-specific wording for the agent-side calls', () => {
    const err = (code) => `HostError: Error(Contract, #${code})\n   0: [Diagnostic Event] contract:${AGERO}, topics:[error, Error(Contract, #${code})], data:""`;
    const msg = (method, code) => describeSimulationError(err(code), { ...ids, method }).message;
    expect(msg('register_agent', 3)).toMatch(/already has a registered agent/);
    expect(msg('register_agent', 6)).toMatch(/greater than 0 XLM/);
    expect(msg('update_agent', 1)).toMatch(/Register it first/);
    expect(msg('deliver_job', 10)).toMatch(/no longer be delivered/);
    expect(msg('release_job', 11)).toMatch(/72-hour review window/);
    expect(msg('refund_job', 4)).toMatch(/client or its agent/);
    expect(msg('refund_job', 11)).toMatch(/after the deadline/);
    // codes without an override and unknown methods fall back to the generic table
    expect(msg('deliver_job', 2)).toBe(CONTRACT_ERRORS[2]);
    expect(msg('no_such_method', 10)).toBe(CONTRACT_ERRORS[10]);
    for (const table of Object.values(METHOD_ERRORS)) {
      for (const code of Object.keys(table)) expect(CONTRACT_ERRORS[code]).toBeDefined();
    }
  });

  it('keeps the token origin when a method is given', () => {
    expect(describeSimulationError(INSUFFICIENT_BALANCE, { ...ids, method: 'refund_job' }).kind).toBe('token');
  });

  it('does not attribute an unrelated contract error to Agero', () => {
    const other = 'CBEIINKJWTVYY3WNJGWFWJECNLZHT2RA3YXATDLTGKZGFN5ZOMDRBW5X';
    const d = describeSimulationError(`x\n 0: [Diagnostic Event] contract:${other}, topics:[error, Error(Contract, #3)], data:""`, ids);
    expect(d.kind).toBe('unknown');
  });
});

describe('describeWalletError', () => {
  it('detects user rejection', () => {
    expect(describeWalletError({ code: -4, message: 'The user rejected this request.' })).toMatch(/rejected in Freighter/);
    expect(describeWalletError('User declined access')).toMatch(/rejected in Freighter/);
  });

  it('passes other messages through', () => {
    expect(describeWalletError({ code: -1, message: 'Internal error' })).toBe('Freighter: Internal error');
    expect(describeWalletError(undefined)).toMatch(/unknown error/);
  });
});

describe('friendlyError', () => {
  it('handles ChainError, network and missing account errors', () => {
    expect(friendlyError(new ChainError('Nice message'))).toBe('Nice message');
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/Cannot reach the Stellar RPC/);
    expect(friendlyError(new Error('Account not found: GABC'))).toMatch(/Friendbot/);
    expect(friendlyError(new RangeError('bad amount'))).toBe('bad amount');
    expect(friendlyError(null)).toBe('Something went wrong.');
  });
});
