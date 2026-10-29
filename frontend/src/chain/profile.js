// Agent profile form -> register_agent / update_agent arguments.
// The contract only checks price > 0; the length limits here keep transactions small and are UI rules.
import { SAMPLE_PREFIX } from '../agents';
import { xlmToStroops } from './units';

export const NAME_MAX = 64;
export const DESCRIPTION_MAX = 500;
export const API_URL_MAX = 200;

export function parseAgentInput({ name, description, apiUrl, priceXlm }) {
  const cleanName = String(name ?? '').trim();
  const cleanDescription = String(description ?? '').trim();
  const cleanUrl = String(apiUrl ?? '').trim();

  if (!cleanName) throw new RangeError('Name is required.');
  if (cleanName.length > NAME_MAX) throw new RangeError(`Name must be at most ${NAME_MAX} characters.`);
  if (cleanDescription.length > DESCRIPTION_MAX) throw new RangeError(`Description must be at most ${DESCRIPTION_MAX} characters.`);
  if (cleanDescription.startsWith(SAMPLE_PREFIX)) {
    throw new RangeError(`Descriptions starting with "${SAMPLE_PREFIX.trim()}" are reserved for the project's sample agents.`);
  }
  if (cleanUrl) {
    if (cleanUrl.length > API_URL_MAX) throw new RangeError(`API URL must be at most ${API_URL_MAX} characters.`);
    if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(cleanUrl)) throw new RangeError('API URL must start with https:// (or http://) and contain a host, or be left empty.');
  }

  const price = xlmToStroops(priceXlm);
  if (price <= 0n) throw new RangeError('Price must be greater than 0 XLM.');

  return { name: cleanName, description: cleanDescription, apiUrl: cleanUrl, price };
}

// Which profile action the contract would accept for this wallet. `agent` is get_agent(wallet) or null.
export function profileActions(agent, wallet) {
  const owns = Boolean(wallet) && Boolean(agent) && agent.owner === wallet;
  return { register: Boolean(wallet) && !agent, update: owns };
}
