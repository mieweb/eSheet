import type { FormDefinition } from '@esheet/core';
import { generateESheetForm } from './generate-esheet-form.js';
import { ESheetAIGenerationError } from './errors.js';
import type { ESheetAIProvider, GenerateFormInput } from './types.js';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

/** Valid minimal FormDefinition for testing. */
const validForm: FormDefinition = {
  id: 'test-form',
  title: 'Test Form',
  fields: [
    {
      id: 'q1',
      fieldType: 'text',
      question: 'What is your name?',
    },
  ],
};

/** Invalid form (missing required 'id' field). */
const invalidFormMissingId = {
  title: 'Bad Form',
  fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
};

/** Invalid form with wrong fieldType. */
const invalidFormWrongType = {
  id: 'bad-form',
  title: 'Bad Form',
  fields: [{ id: 'q1', fieldType: 'unknownType', question: 'Name?' }],
};

// ---------------------------------------------------------------------------
// Mock Provider Factory
// ---------------------------------------------------------------------------

function createMockProvider(
  responses: unknown[]
): ESheetAIProvider & { calls: GenerateFormInput[] } {
  let callIndex = 0;
  const calls: GenerateFormInput[] = [];

  return {
    calls,
    async generateStructuredForm(input: GenerateFormInput): Promise<unknown> {
      calls.push(input);
      if (callIndex >= responses.length) {
        throw new Error('Mock provider exhausted - no more responses');
      }
      return responses[callIndex++];
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateESheetForm', () => {
  describe('valid schema generation', () => {
    it('returns form directly when AI generates valid schema', async () => {
      const provider = createMockProvider([validForm]);

      const result = await generateESheetForm({
        prompt: 'Create a simple form',
        provider,
      });

      expect(result.form).toEqual(validForm);
      expect(result.repaired).toBe(false);
      expect(provider.calls).toHaveLength(1);
    });

    it('passes custom model to provider', async () => {
      const provider = createMockProvider([validForm]);

      await generateESheetForm({
        prompt: 'Create a form',
        provider,
        model: 'gpt-4o',
      });

      expect(provider.calls[0].model).toBe('gpt-4o');
    });

    it('passes custom systemPrompt to provider', async () => {
      const provider = createMockProvider([validForm]);
      const customPrompt = 'You are a helpful form builder.';

      await generateESheetForm({
        prompt: 'Create a form',
        provider,
        systemPrompt: customPrompt,
      });

      expect(provider.calls[0].systemPrompt).toBe(customPrompt);
    });
  });

  describe('invalid schema without repair', () => {
    it('throws ESheetAIGenerationError when schema is invalid', async () => {
      const provider = createMockProvider([invalidFormMissingId]);

      await expect(
        generateESheetForm({
          prompt: 'Create a form',
          provider,
          repair: false,
        })
      ).rejects.toThrow(ESheetAIGenerationError);
    });

    it('includes validation errors in thrown error', async () => {
      const provider = createMockProvider([invalidFormMissingId]);

      try {
        await generateESheetForm({
          prompt: 'Create a form',
          provider,
          repair: false,
        });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ESheetAIGenerationError);
        const error = err as ESheetAIGenerationError;
        expect(error.validationErrors.length).toBeGreaterThan(0);
        expect(error.invalidSchema).toEqual(invalidFormMissingId);
        expect(error.repairAttempted).toBe(false);
      }
    });

    it('does not attempt repair when repair=false (default)', async () => {
      const provider = createMockProvider([invalidFormMissingId]);

      await expect(
        generateESheetForm({ prompt: 'Create a form', provider })
      ).rejects.toThrow();

      // Only one call - no repair attempt
      expect(provider.calls).toHaveLength(1);
    });
  });

  describe('repair flow', () => {
    it('repairs invalid schema and returns valid form', async () => {
      // First call returns invalid, second call (repair) returns valid
      const provider = createMockProvider([invalidFormMissingId, validForm]);

      const result = await generateESheetForm({
        prompt: 'Create a form',
        provider,
        repair: true,
      });

      expect(result.form).toEqual(validForm);
      expect(result.repaired).toBe(true);
      expect(provider.calls).toHaveLength(2);
    });

    it('throws when repair also fails', async () => {
      // Both calls return invalid schemas
      const provider = createMockProvider([
        invalidFormMissingId,
        invalidFormWrongType,
      ]);

      try {
        await generateESheetForm({
          prompt: 'Create a form',
          provider,
          repair: true,
        });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ESheetAIGenerationError);
        const error = err as ESheetAIGenerationError;
        expect(error.repairAttempted).toBe(true);
      }
    });

    it('repair prompt includes validation errors', async () => {
      const provider = createMockProvider([invalidFormMissingId, validForm]);

      await generateESheetForm({
        prompt: 'Create a form',
        provider,
        repair: true,
      });

      // Second call should be the repair
      const repairCall = provider.calls[1];
      expect(repairCall.prompt).toContain('invalid');
      expect(repairCall.prompt).toContain('Validation errors');
    });
  });

  describe('error handling', () => {
    it('propagates provider errors', async () => {
      const provider: ESheetAIProvider = {
        generateStructuredForm: () =>
          Promise.reject(new Error('API rate limit exceeded')),
      };

      await expect(
        generateESheetForm({ prompt: 'Create a form', provider })
      ).rejects.toThrow('API rate limit exceeded');
    });

    it('handles null/undefined AI response gracefully', async () => {
      const provider = createMockProvider([null]);

      await expect(
        generateESheetForm({ prompt: 'Create a form', provider })
      ).rejects.toThrow(ESheetAIGenerationError);
    });

    it('handles non-object AI response', async () => {
      const provider = createMockProvider(['not an object']);

      await expect(
        generateESheetForm({ prompt: 'Create a form', provider })
      ).rejects.toThrow(ESheetAIGenerationError);
    });
  });
});
