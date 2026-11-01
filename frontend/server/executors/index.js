// Executor registry (docs/fase5-design.md §10.2). AGERO_EXECUTOR picks one by id.
// An executor gets the parsed input and an ExecContext {signal, network, job}; it never receives the
// agent key, the store or a request object. Hashing and deliver_job belong to the pipeline.
// A future LLM executor adds one file and one entry here, with kind 'llm', `model` and `estimate`.
import { createContractInspector } from './contract-inspector.js';

const FACTORIES = Object.freeze({
  'contract-inspector': createContractInspector,
});

export const EXECUTOR_IDS = Object.freeze(Object.keys(FACTORIES));

// `deps` is passed to the factory (tests inject fake readers)
export function getExecutor(id, deps) {
  const factory = FACTORIES[id];
  if (!factory) throw new RangeError(`Unknown executor "${id}" (known: ${EXECUTOR_IDS.join(', ')}).`);
  const spec = factory(deps);
  if (spec.kind === 'llm' && (!spec.model || typeof spec.estimate !== 'function')) {
    throw new RangeError(`Executor "${id}" is an LLM executor without model or estimate.`);
  }
  return spec;
}
