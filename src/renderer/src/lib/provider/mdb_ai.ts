import { CompletionConfig, Provider, ProviderMessage } from "@/lib/provider/provider";
import { Result } from "@shared/types";

interface ChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  system_fingerprint: string;
  choices: Choice[];
  usage: Usage;
}
interface Choice {
  index: number;
  message: Message;
  logprobs: null;
  finish_reason: string;
}
interface Message {
  role: "user" | "assistant";
  content: string;
}
interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

async function getModels(): Promise<Result<string[], Error>> {
  const models = ["claude-3-haiku", "codellama-70b", "dbrx", "firefunction-v1", "firellava-13b", "gemini-1.5-pro", "gemma-7b", "gpt-3.5-turbo", "hermes-2-pro", "llama-2-13b", "llama-2-70b", "llama-2-7b", "llama-3-70b", "llama-3-8b", "mistral-7b", "mixtral-8x7b", "neuralhermes", ""];
  return { kind: "ok", value: models };
}

/**
 * Sends a request to the OpenAI API to get a chat completion based on the provided messages and configuration.
 * @param messages - The messages to use as context for the chat completion.
 * @param config - The configuration options for the chat completion request.
 * @returns A promise that resolves to a Result containing the chat completion string if successful, or an Error if the request fails.
 */ async function getChatCompletion(
  messages: ProviderMessage[],
  config: CompletionConfig
): Promise<Result<string, Error>> {
  // Get API key from either config or secret store
  let key: string;
  if (!config.apiKey) {
    const keyRes = await window.api.secret.get("mdb.ai");
    if (keyRes.kind == "err") {
      return keyRes;
    }
    key = keyRes.value;
  } else {
    key = config.apiKey;
  }

  const url = "https://llm.mdb.ai/chat/completions";
  const headers = {
    Authorization: `Bearer ${key}`
  };

  // Append a system prompt if specified
  const reqMessages = config.system ? [{ role: "system", content: config.system }, ...messages] : messages;
  const body: any = {
    model: config.model,
    messages: reqMessages
  };
  if (config.maxTokens !== undefined) {
    body.max_tokens = config.maxTokens;
  }
  if (config.stop !== undefined) {
    body.stop = config.stop;
  }
  if (config.temperature !== undefined) {
    body.temperature = config.temperature;
  }
  if (config.topP !== undefined) {
    body.top_p = config.topP;
  }

  const completionRes = await window.api.xfetch.post(url, body, headers);
  if (completionRes.kind == "err") {
    return completionRes;
  }

  const completion = completionRes.value as ChatCompletion;
  return { kind: "ok", value: completion.choices[0].message.content };
}

async function streamChatCompletion(): Promise<any> {
  throw new Error("Not implemented");
}

async function getTextCompletion(): Promise<Result<string, Error>> {
  throw new Error("Not implemented");
}

export const mdbAI: Provider = {
  getModels,
  getChatCompletion,
  streamChatCompletion,
  getTextCompletion
};
