import { CompletionConfig, Provider, ProviderMessage } from "@/lib/provider/provider";
import { Result } from "@shared/types";

interface ChatCompletion {
  candidates: Candidate[];
  promptFeedback: any;
}

interface Candidate {
  content: Content | null;
  finishReason: 'STOP' | 'FINISH_REASON_UNSPECIFIED' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
  safetyRatings: SafetyRating[];
  citationMetadata: any;
  tokenCount: number;
  groundingAttributions: any;
  index: number;
}

interface Content {
  parts: Part[];
  role: string;
}

interface Part {
  text: string;
}

interface SafetyRating {
  category: any;
  probability: any;
  blocked: boolean;
}

async function getModels(): Promise<Result<string[], Error>> {
  return { kind: "ok", value: ["gemini-1.5-pro-latest"] };
}

async function getChatCompletion(
  messages: ProviderMessage[],
  config: CompletionConfig
): Promise<Result<string, Error>> {
  // Get API key from either config or secret store
  let key: string;
  if (!config.apiKey) {
    const keyRes = await window.api.secret.get("gemini");
    if (keyRes.kind == "err") {
      return keyRes;
    }
    key = keyRes.value;
  } else {
    key = config.apiKey;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${key}`;
  const headers = {};

  const formattedMessages = messages.map(item => ({
    role: item.role === 'user' ? item.role : 'model',
    parts: [{ text: item.content }]
  }));

  const body: any = {
    contents: formattedMessages,
    generationConfig: {}
  };

  if (config.system) {
    body.systemInstruction = {
      parts: [{ text: config.system }],
      role: "system"
    };
  }

  if (config.maxTokens !== undefined) {
    body.generationConfig.maxOutputTokens = config.maxTokens;
  }

  if (config.temperature !== undefined) {
    body.generationConfig.temperature = config.temperature;
  }

  if (config.topP !== undefined) {
    body.generationConfig.topP = config.topP;
  }

  if (config.topK !== undefined) {
    body.generationConfig.topK = config.topK;
  }

  const completionRes = await window.api.xfetch.post(url, body, headers);
  if (completionRes.kind == "err") {
    return completionRes;
  }
  const completion = completionRes.value as ChatCompletion;
  const candidate = completion.candidates[0];

  // Check safety ratings
  const harmfulCategories = candidate.safetyRatings.filter(rating => rating.probability === "HIGH").map(rating => rating.category);
  if (harmfulCategories.length > 0) {
    const errorMessage = `The input prompt contains potentially harmful content related to: ${harmfulCategories.join(', ')}. Please provide a different prompt.`;
    throw new Error(errorMessage);
  }

  return { kind: "ok", value: candidate.content!.parts[0].text };
}

async function streamChatCompletion(): Promise<any> {
  throw new Error("Not implemented");
}

async function getTextCompletion(): Promise<Result<string, Error>> {
  throw new Error("Not implemented");
}

export const gemini: Provider = {
  getModels,
  getChatCompletion,
  streamChatCompletion,
  getTextCompletion
};
