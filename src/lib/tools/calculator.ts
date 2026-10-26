import { tool } from 'ai';
import { z } from 'zod';
import { evaluate } from 'mathjs';

/** LLMs are bad at arithmetic, so the agent delegates math to a real evaluator. */
export const calculator = tool({
  description:
    'Evaluate a math expression exactly, e.g. "(4.2e9 - 3.1e9) / 3.1e9 * 100" or "sqrt(144) + 2^10". ' +
    'Always use this for percentages, growth rates, unit conversions and any non-trivial arithmetic.',
  inputSchema: z.object({ expression: z.string().max(300) }),
  execute: async ({ expression }) => {
    const result = evaluate(expression);
    return { expression, result: String(result) };
  },
});
