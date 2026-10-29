import { describe, expect, it } from 'vitest';
import { API_URL_MAX, DESCRIPTION_MAX, NAME_MAX, parseAgentInput, profileActions } from './profile';
import { stroopsToXlm } from './units';

const OWNER = 'GAR3Y2JL6XA7F6EWSCGUJK733MW2VEKBLRBIXTPQLYTEDMDMC3YFGGSV';
const OTHER = 'GBTBPEC5U2BEN3W5JQDHXI77EYD74ND76OIIJM4QVPUFIZEGF3DDDPA4';
const base = { name: ' My Agent ', description: ' Does things ', apiUrl: '', priceXlm: '12.5' };

describe('parseAgentInput', () => {
  it('trims fields and converts the price to stroops', () => {
    expect(parseAgentInput(base)).toEqual({ name: 'My Agent', description: 'Does things', apiUrl: '', price: 125_000_000n });
    expect(parseAgentInput({ ...base, priceXlm: '0.0000001' }).price).toBe(1n);
    expect(parseAgentInput({ ...base, priceXlm: '100' }).price).toBe(1_000_000_000n);
    // the update form is prefilled with stroopsToXlm(price); it must parse back to the same stroops
    for (const stroops of [1n, 500_000_000n, 1_234_567_891n]) {
      expect(parseAgentInput({ ...base, priceXlm: stroopsToXlm(stroops) }).price).toBe(stroops);
    }
    expect(parseAgentInput({ ...base, apiUrl: ' https://agent.example.com/api ' }).apiUrl).toBe('https://agent.example.com/api');
  });

  it('rejects a price the contract would reject (InvalidPrice) or cannot parse', () => {
    for (const priceXlm of ['0', '0.0000000', '-1', '1.12345678', 'abc', '']) {
      expect(() => parseAgentInput({ ...base, priceXlm })).toThrow(RangeError);
    }
  });

  it('enforces the UI limits', () => {
    expect(() => parseAgentInput({ ...base, name: '   ' })).toThrow(/Name is required/);
    expect(() => parseAgentInput({ ...base, name: 'x'.repeat(NAME_MAX + 1) })).toThrow(/Name/);
    expect(() => parseAgentInput({ ...base, description: 'x'.repeat(DESCRIPTION_MAX + 1) })).toThrow(/Description/);
    expect(() => parseAgentInput({ ...base, apiUrl: `https://a.io/${'x'.repeat(API_URL_MAX)}` })).toThrow(/API URL/);
    expect(() => parseAgentInput({ ...base, apiUrl: 'ftp://agent.example.com' })).toThrow(/API URL/);
    expect(() => parseAgentInput({ ...base, apiUrl: 'https://localhost' })).toThrow(/API URL/);
  });

  it('reserves the sample-agent description prefix', () => {
    expect(() => parseAgentInput({ ...base, description: 'Sample agent - fake' })).toThrow(/reserved/);
  });
});

describe('profileActions', () => {
  it('offers register without an agent and update only to its owner', () => {
    expect(profileActions(null, OWNER)).toEqual({ register: true, update: false });
    expect(profileActions({ owner: OWNER }, OWNER)).toEqual({ register: false, update: true });
    expect(profileActions({ owner: OWNER }, OTHER)).toEqual({ register: false, update: false });
    expect(profileActions(null, null)).toEqual({ register: false, update: false });
  });
});
