import OpenAI from 'openai';
import type { ESheetAIProvider, GenerateFormInput } from '../types.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Configuration for the OpenAI provider.
 */
export interface OpenAIProviderConfig {
  /** OpenAI API key. */
  apiKey: string;
  /** Model to use (default: 'gpt-4o-mini'). */
  model?: string;
  /** Organization ID (optional). */
  organization?: string;
  /** Base URL for API (optional, for proxies/custom endpoints). */
  baseURL?: string;
}

/**
 * OpenAI provider implementing the ESheetAIProvider interface.
 *
 * Uses OpenAI's Structured Outputs with JSON Schema for reliable
 * schema generation.
 *
 * @example
 * ```ts
 * import { OpenAIProvider } from '@esheet/ai-gateway';
 *
 * const provider = new OpenAIProvider({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: 'gpt-4o', // optional, defaults to gpt-4o-mini
 * });
 * ```
 */
export class OpenAIProvider implements ESheetAIProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseURL,
      dangerouslyAllowBrowser: true,
    });
    this.defaultModel = config.model ?? DEFAULT_MODEL;
  }

  async generateStructuredForm(input: GenerateFormInput): Promise<unknown> {
    const { prompt, schema, systemPrompt, model } = input;

    const response = await this.client.chat.completions.create({
      model: model ?? this.defaultModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
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
      throw new Error('No content in OpenAI API response');
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
