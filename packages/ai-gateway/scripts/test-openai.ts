/**
 * Integration test script for @esheet/ai-gateway with OpenAI.
 *
 * This script actually calls the OpenAI API to test end-to-end generation.
 *
 * -----------------------------------------------------------------------------
 * HOW TO RUN:
 * -----------------------------------------------------------------------------
 *
 * 1. Set your OpenAI API key:
 *
 *    Option A: Create a .env file in the repository root:
 *      OPENAI_API_KEY=sk-...
 *
 *    Option B: Set as environment variable:
 *      # PowerShell
 *      $env:OPENAI_API_KEY = "sk-..."
 *
 *      # Bash
 *      export OPENAI_API_KEY="sk-..."
 *
 * 2. Run from the repository root:
 *
 *    npx tsx packages/ai-gateway/scripts/test-openai.ts
 *
 *    Or with a specific model:
 *
 *    npx tsx packages/ai-gateway/scripts/test-openai.ts --model gpt-4o
 *
 * -----------------------------------------------------------------------------
 * EXPECTED OUTPUT:
 * -----------------------------------------------------------------------------
 *
 * - Success: Logs the generated form definition and whether repair was needed
 * - Failure: Logs the error with validation details
 *
 * -----------------------------------------------------------------------------
 */

// Load .env.local from repo root before any code reads process.env
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// Try .env.local first (gitignored), then .env
config({ path: resolve(__dirname, '../../../.env.local') });
config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../../../.env') });

import { generateESheetForm, OpenAIProvider } from '../src/index.js';

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const modelIndex = args.indexOf('--model');
  const model = modelIndex !== -1 ? args[modelIndex + 1] : undefined;

  // Validate API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
    console.error('');
    console.error('Set it with:');
    console.error('  PowerShell: $env:OPENAI_API_KEY = "sk-..."');
    console.error('  Bash:       export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  // Create provider
  const provider = new OpenAIProvider({ apiKey });

  console.log('='.repeat(60));
  console.log('@esheet/ai-gateway OpenAI Integration Test');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Model: ${model ?? 'gpt-4o-mini (default)'}`);
  console.log('');

  // Test 1: Simple form generation
  console.log('Test 1: Generate a simple contact form');
  console.log('-'.repeat(40));

  try {
    const result = await generateESheetForm({
      prompt: `Create a simple contact form with:
- Full name (required)
- Email address (required)
- Message (multiline text)`,
      provider,
      model,
      repair: true,
    });

    console.log('✓ SUCCESS');
    console.log(`  Repaired: ${result.repaired}`);
    console.log(`  Form ID:  ${result.form.id}`);
    console.log(`  Title:    ${result.form.title}`);
    console.log(`  Fields:   ${result.form.fields.length}`);
    console.log('');
    console.log('Generated form:');
    console.log(JSON.stringify(result.form, null, 2));
  } catch (err) {
    console.error('✗ FAILED');
    if (err instanceof Error) {
      console.error(`  Error: ${err.message}`);
      if ('validationErrors' in err) {
        console.error(
          `  Validation errors:`,
          (err as { validationErrors: string[] }).validationErrors
        );
      }
    }
    process.exit(1);
  }

  console.log('');
  console.log('='.repeat(60));

  // Test 2: More complex form with various field types
  console.log('');
  console.log('Test 2: Generate a patient intake form');
  console.log('-'.repeat(40));

  try {
    const result = await generateESheetForm({
      prompt: `Create a patient intake form with:
- Patient name (text, required)
- Date of birth (date picker)
- Gender (radio: Male, Female, Other)
- Known allergies (checkboxes: Penicillin, Sulfa, Latex, None)
- Rate your current pain level (slider 0-10)`,
      provider,
      model,
      repair: true,
    });

    console.log('✓ SUCCESS');
    console.log(`  Repaired: ${result.repaired}`);
    console.log(`  Form ID:  ${result.form.id}`);
    console.log(`  Title:    ${result.form.title}`);
    console.log(`  Fields:   ${result.form.fields.length}`);
    console.log('');
    console.log('Field types used:');
    result.form.fields.forEach((f) => {
      console.log(`  - ${f.id}: ${f.fieldType}`);
    });
  } catch (err) {
    console.error('✗ FAILED');
    if (err instanceof Error) {
      console.error(`  Error: ${err.message}`);
    }
    process.exit(1);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('All tests passed!');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
