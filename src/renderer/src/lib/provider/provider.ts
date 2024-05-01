
import { Result } from "@shared/types";
import { gemini } from "./gemini";

export interface ProviderMessage {
  role: string;
  content: string;
}

export interface CompletionConfig {
  apiKey?: string;
  model: string;
  system?: string;
  stop?: string[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface Provider {
  getModels(): Promise<Result<string[], Error>>;
  getChatCompletion(messages: ProviderMessage[], config: CompletionConfig): Promise<Result<string, Error>>;
  streamChatCompletion(): any;
  getTextCompletion(): Promise<Result<string, Error>>;
}

export enum ProviderE {
  GEMINI = "gemini"
}
export function getProvider(provider: ProviderE): Provider {
  switch (provider) {
    case ProviderE.GEMINI:
      return gemini;
    default:
      throw new Error("Invalid provider given to getProvider()");
  }
}

export interface NameAndValue {
  name: string;
  value: ProviderE;
}

/**
 * Returns an array of `NameAndValue` objects representing the available providers.
 * Each object has a `name` property with the human-readable name of the provider,
 * and a `value` property with the corresponding `ProviderE` enum value.
 * @returns {NameAndValue[]} An array of `NameAndValue` objects.
 */
export function getProvidersNameAndValue(): NameAndValue[] {
  return [
    { name: "Gemini", value: ProviderE.GEMINI }
  ];
}
