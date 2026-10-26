import { APICallError, wrapLanguageModel } from 'ai';
import type { LanguageModelV4Middleware, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { google } from '@ai-sdk/google';

export const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

// Each Gemini model has its own free-tier quota, so the fallback must be a *different* model.
export const FALLBACK_MODEL_ID =
  process.env.GEMINI_FALLBACK_MODEL ||
  (MODEL_ID === 'gemini-3.5-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash-lite');

const fallbackModel = google(FALLBACK_MODEL_ID);

// Circuit breaker: after the primary model is rate limited, skip it for a minute instead of
// spending one failed request on it at the start of every agent step.
const COOLDOWN_MS = 60_000;
let primaryCooldownUntil = 0;

/** 429 = quota or rate limit hit, 503 = model overloaded. Both are worth trying another model for. */
function shouldFallBack(error: unknown) {
  return APICallError.isInstance(error) && (error.statusCode === 429 || error.statusCode === 503);
}

/**
 * Middleware wraps the model's doStream call (one call per agent step). If the primary model
 * rejects the request, the same request is sent to the fallback model, so the step succeeds
 * and the agent loop carries on as if nothing happened.
 */
const fallbackOnRateLimit: LanguageModelV4Middleware = {
  specificationVersion: 'v4',
  wrapStream: async ({ doStream, params }) => {
    if (Date.now() >= primaryCooldownUntil) {
      try {
        return await doStream();
      } catch (error) {
        if (!shouldFallBack(error)) throw error;
        primaryCooldownUntil = Date.now() + COOLDOWN_MS;
        console.warn(
          JSON.stringify({
            event: 'model_fallback',
            from: MODEL_ID,
            to: FALLBACK_MODEL_ID,
            status: (error as APICallError).statusCode,
          }),
        );
      }
    }
    const { stream, ...rest } = await fallbackModel.doStream(params);
    // Gemini doesn't report the model id in its stream, so the step would be labelled with the
    // primary's id. Tag it so logs and the UI show which model actually answered.
    return { ...rest, stream: stream.pipeThrough(tagModelId(FALLBACK_MODEL_ID)) };
  },
};

function tagModelId(modelId: string) {
  let tagged = false;
  return new TransformStream<LanguageModelV4StreamPart, LanguageModelV4StreamPart>({
    transform(part, controller) {
      controller.enqueue(part);
      if (!tagged) {
        tagged = true;
        controller.enqueue({ type: 'response-metadata', modelId });
      }
    },
  });
}

export const scoutModel = wrapLanguageModel({ model: google(MODEL_ID), middleware: fallbackOnRateLimit });
