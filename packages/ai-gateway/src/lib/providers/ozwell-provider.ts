import OpenAI from 'openai';
import type { ESheetAIProvider, GenerateFormInput } from '../types.js';

const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_BASE_URL =
  'https://ozwell-dev-refserver.opensource.mieweb.org/v1';

/**
 * Configuration for the Ozwell provider.
 */
export interface OzwellProviderConfig {
  /** Ozwell API key. */
  apiKey: string;
  /** Model to use (default: 'gpt-4.1-mini'). */
  model?: string;
  /** Base URL for API (default: Ozwell dev server). */
  baseURL?: string;
}

/**
 * Ozwell provider implementing the ESheetAIProvider interface.
 *
 * Uses the OpenAI SDK since Ozwell is OpenAI-compatible.
 *
 * @example
 * ```ts
 * import { OzwellProvider } from '@esheet/ai-gateway';
 *
 * const provider = new OzwellProvider({
 *   apiKey: import.meta.env.VITE_OZWELL_API_KEY,
 *   model: 'gpt-4.1-mini',
 * });
 * ```
 */
export class OzwellProvider implements ESheetAIProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: OzwellProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL ?? DEFAULT_BASE_URL,
      dangerouslyAllowBrowser: true, // Required for client-side demo
    });
    this.defaultModel = config.model ?? DEFAULT_MODEL;
  }

  async generateStructuredForm(input: GenerateFormInput): Promise<unknown> {
    const { prompt, schema, systemPrompt, model } = input;

    const response = await this.client.chat.completions.create({
      model: model ?? this.defaultModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'form_definition',
          description: 'A valid eSheet FormDefinition',
          schema: schema,
          strict: true,
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in Ozwell API response');
    }

    return JSON.parse(content);
  }

  /**
   * Create a chat completion with optional tools.
   * Used by ChatService for conversational interactions.
   *
   * @example
   * ```ts
   * const response = await provider.createChatCompletion({
   *   messages: [
   *     { role: 'system', content: 'You are a form builder assistant.' },
   *     { role: 'user', content: 'Add a text field for name' },
   *   ],
   *   tools: [
   *     {
   *       type: 'function',
   *       function: {
   *         name: 'create_field',
   *         description: 'Create a new field',
   *         parameters: { ... },
   *       },
   *     },
   *   ],
   * });
   * ```
   */
  async createChatCompletion(options: {
    messages: OpenAI.ChatCompletionMessageParam[];
    tools?: OpenAI.ChatCompletionTool[];
    model?: string;
  }): Promise<OpenAI.ChatCompletion> {
    return this.client.chat.completions.create({
      model: options.model ?? this.defaultModel,
      messages: options.messages,
      tools: options.tools,
    });
  }
}
