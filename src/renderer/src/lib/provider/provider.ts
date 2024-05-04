
import { Result } from "@shared/types";
import { gemini } from "./gemini";
import { anthropic } from "./anthropic";
import { mistral } from "./mistral";
import { togetherAI } from "./together_ai";
import { openAI } from "./openai";
import { mdbAI } from "./mdb_ai";

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
  GEMINI = "gemini",
  ANTHROPHIC = "anthrophic",
  MISTRAL = "mistral",
  OPENAI = "openAI",
  TOGETHER_AI = "togetherAI",
  MDB_AI = "mdb.ai",
}
export function getProvider(provider: ProviderE): Provider {
  switch (provider) {
    case ProviderE.GEMINI:
      return gemini;
    case ProviderE.ANTHROPHIC:
      return anthropic;
    case ProviderE.MISTRAL:
      return mistral;
    case ProviderE.OPENAI:
      return openAI;
    case ProviderE.TOGETHER_AI:
      return togetherAI;
    case ProviderE.MDB_AI:
      return mdbAI;
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
    { name: "Gemini", value: ProviderE.GEMINI },
    { name: "Anthropic", value: ProviderE.ANTHROPHIC },
    { name: "Mistral", value: ProviderE.MISTRAL },
    { name: "OpenAI", value: ProviderE.OPENAI },
    { name: "Together AI", value: ProviderE.TOGETHER_AI },
    { name: "mdb.ai", value: ProviderE.MDB_AI },
  ];
}
