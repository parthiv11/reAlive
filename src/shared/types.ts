import { ProviderE } from "@/lib/provider/provider";
import { config } from "@shared/config";
import { Message, Profile } from "@shared/db_types";
import { z } from "zod";
// TODO: refactor data types to be more consistent

export interface UserInput {
  query: string;
  media?: { mimeType: string; data: string };
}
// Card
// =====================================
// data.json inside the card's directory
export interface CardData {
  spec: string;
  spec_version: string;
  character: Character;
  // world: World;
  meta: {
    // title: string;
    created_at: string;
    updated_at?: string;
    creator: {
      card: string;
      character: string;
      world: string;
    };
    notes: string;
    // tagline: string;
    tags: string[];
  };
}

export interface Character {
  name: string;
  description: string;
}
export interface World {
  description: string;
}
// Contents of the card's directory
// Edit this type to also include the card
export interface CardBundle {
  id: number;
  data: CardData;
  avatarURI: string;
  bannerURI: string;
}

export interface CardBundleWithoutID {
  data: CardData;
  avatarURI: string;
  bannerURI: string;
}

// Profile
// =====================================
export interface ProfileData extends Profile { } // Updated interface name

// Contents of the profile's directory
export interface ProfileBundleWithoutData { // Updated interface name
  avatarURI: string;
}

export interface ProfileBundle extends ProfileBundleWithoutData { // Updated interface name
  data: ProfileData; // Updated interface name
}

// Settings from settings.json
export interface Settings {
  chat: {
    provider: ProviderE;
    model: string;
    temperature: number;
    topP: number;
    topK: number;
    maxReplyTokens: number;
    maxContextTokens: number;
    jailbreak: string;
    streaming: boolean;
  };
}

// Forms
// ===========================================
export const profileFormSchema = z.object({ // Updated variable name
  name: z
    .string()
    .min(config.profile.nameMinChars) // Updated field name
    .max(config.profile.nameMaxChars) // Updated field name
    .regex(/^[a-zA-Z0-9 -]*$/, "Name can only contain letters, numbers, spaces, and hyphens"),
  description: z.string().max(config.profile.descriptionMaxChars), // Updated field name
  isDefault: z.boolean(),
  avatarURI: z.string().optional(),
  // TODO: implement profile banners
  bannerURI: z.string().optional()
});
export type ProfileFormData = z.infer<typeof profileFormSchema>; // Updated type name

const characterFormSchema = z.object({
  name: z
    .string()
    .min(config.card.nameMinChars)
    .max(config.card.nameMaxChars)
    .regex(/^[a-zA-Z0-9 -]*$/, "Name can only contain letters, numbers, spaces, and hyphens"),
  description: z.string().min(config.card.descriptionMinChars).max(config.card.descriptionMaxChars),
  // greeting: z.string().min(config.card.greetingMinChars).max(config.card.greetingMaxChars),
  // msg_examples: z.string().min(config.card.msgExamplesMinChars).max(config.card.msgExamplesMaxChars),
  avatarURI: z.string().optional(),
  bannerURI: z.string().optional()
});

const worldFormSchema = z.object({
  description: z.string().min(config.card.descriptionMinChars).max(config.card.descriptionMaxChars)
});

const cardMetaSchema = z.object({
  // title: z.string().min(config.card.titleMinChars).max(config.card.titleMaxChars),
  notes: z.string().min(config.card.notesMinChars).max(config.card.notesMaxChars),
  // tagline: z.string().min(config.card.tagLineMinChars).max(config.card.taglineMaxChars),
  // TODO: this should be z.array(z.string()) instead, this is hacky
  tags: z
    .string()
    .min(1)
    .max(256)
    .regex(/^(\w+)(,\s*\w+)*$/, "Tags must be a comma separated list of words without spaces.")
});

export const cardFormSchema = z.object({
  character: characterFormSchema,
  // world: worldFormSchema,
  meta: cardMetaSchema
});
export type CardFormData = z.infer<typeof cardFormSchema>;
export type Result<T, E> = { kind: "ok"; value: T } | { kind: "err"; error: E };
