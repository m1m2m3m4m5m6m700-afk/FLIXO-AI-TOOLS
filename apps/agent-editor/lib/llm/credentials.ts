import { createDecipheriv } from "node:crypto";
import type { LLMProviderName } from "./types";

type EncryptedCredential = {
  iv: string;
  tag: string;
  data: string;
};

const ENV_NAMES: Partial<Record<LLMProviderName, string>> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};

const MODEL_ENV_NAMES: Partial<Record<LLMProviderName, string>> = {
  openai: "FLIXO_LLM_OPENAI_MODEL",
  anthropic: "FLIXO_LLM_ANTHROPIC_MODEL",
  gemini: "FLIXO_LLM_GEMINI_MODEL",
};

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, "base64");
}

function readEncryptedCredential(provider: LLMProviderName): string | undefined {
  const encodedKeys = process.env.FLIXO_LLM_KEYS_ENCRYPTED?.trim();
  const encryptionKey = process.env.FLIXO_LLM_KEY_ENCRYPTION_KEY?.trim();

  if (!encodedKeys || !encryptionKey) return undefined;

  try {
    const parsed = JSON.parse(encodedKeys) as Record<string, EncryptedCredential>;
    const record = parsed[provider];
    if (!record || typeof record !== "object") return undefined;

    const key = decodeBase64(encryptionKey);
    if (key.length !== 32) {
      throw new Error("FLIXO_LLM_KEY_ENCRYPTION_KEY must decode to 32 bytes.");
    }

    const iv = decodeBase64(record.iv);
    const tag = decodeBase64(record.tag);
    const ciphertext = decodeBase64(record.data);
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error("Invalid encrypted LLM credential envelope.");
    }

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid encrypted credential.";
    throw new Error(`LLM credential decryption failed: ${message}`);
  }
}

export function getProviderApiKey(provider: LLMProviderName): string | undefined {
  const encrypted = readEncryptedCredential(provider)?.trim();
  if (encrypted) return encrypted;

  const directName = ENV_NAMES[provider];
  const direct = directName ? process.env[directName]?.trim() : undefined;

  if (process.env.NODE_ENV === "production" && directName && direct) {
    throw new Error(
      `PLAINTEXT_LLM_CREDENTIAL_DISABLED: production provider key '${directName}' must be supplied through FLIXO_LLM_KEYS_ENCRYPTED.`,
    );
  }

  return direct || undefined;
}

export function getProviderModel(provider: LLMProviderName): string | undefined {
  const modelName = MODEL_ENV_NAMES[provider];
  const model = modelName ? process.env[modelName]?.trim() : undefined;
  return model || undefined;
}
