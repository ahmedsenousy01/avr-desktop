import type { LogicalRole } from "./roles";

type EnvSchemaField = {
  key: string;
  required: boolean;
  secret?: boolean;
  defaultValue?: string;
};

export type ImageSpec = {
  dockerImage: string;
  role: LogicalRole;
  defaultEnv?: Readonly<Record<string, string>>;
  envSchema?: readonly EnvSchemaField[];
  defaultPorts?: readonly string[];
  defaultVolumes?: readonly string[];
  wsPort?: number; // Only for STS images
};

export type ImageKey =
  | "avr-core"
  | "avr-ami"
  | "avr-asterisk"
  | "avr-sts-openai"
  | "avr-sts-deepgram"
  | "avr-sts-ultravox"
  | "avr-sts-gemini"
  | "avr-sts-elevenlabs"
  | "avr-asr-deepgram"
  | "avr-asr-vosk"
  | "avr-asr-google-cloud-speech"
  | "avr-tts-deepgram"
  | "avr-tts-google-cloud-tts"
  | "avr-llm-openai"
  | "avr-llm-openrouter"
  | "avr-llm-anthropic"
  | "avr-llm-n8n"
  | "avr-n8n";

// Note: Depends on IMAGES definition; placed after IMAGES below

const IMAGES_INIT = {
  "avr-core": {
    dockerImage: "agentvoiceresponse/avr-core",
    role: "infra",
    defaultEnv: { PORT: "5001" },
    envSchema: [
      { key: "PORT", required: true },
      { key: "STS_URL", required: false },
      { key: "ASR_URL", required: false },
      { key: "LLM_URL", required: false },
      { key: "TTS_URL", required: false },
      { key: "INTERRUPT_LISTENING", required: false, defaultValue: "false" },
      { key: "SYSTEM_MESSAGE", required: false },
    ],
    defaultPorts: ["5001:5001"],
  },
  "avr-ami": {
    dockerImage: "agentvoiceresponse/avr-ami",
    role: "infra",
    defaultEnv: {
      PORT: "6006",
      AMI_HOST: "avr-asterisk",
      AMI_PORT: "5038",
      AMI_USERNAME: "avr",
      AMI_PASSWORD: "avr",
    },
    envSchema: [
      { key: "PORT", required: true },
      { key: "AMI_HOST", required: false },
      { key: "AMI_PORT", required: false },
      { key: "AMI_USERNAME", required: false },
      { key: "AMI_PASSWORD", required: false },
    ],
    defaultPorts: ["6006:6006"],
  },
  "avr-asterisk": {
    dockerImage: "agentvoiceresponse/avr-asterisk",
    role: "infra",
    defaultPorts: ["5038:5038", "5060:5060", "8088:8088", "10000-10050:10000-10050/udp"],
    defaultVolumes: [
      "./asterisk/conf/manager.conf:/etc/asterisk/my_manager.conf",
      "./asterisk/conf/pjsip.conf:/etc/asterisk/my_pjsip.conf",
      "./asterisk/conf/extensions.conf:/etc/asterisk/my_extensions.conf",
      "./asterisk/conf/queues.conf:/etc/asterisk/my_queues.conf",
      "./asterisk/conf/ari.conf:/etc/asterisk/my_ari.conf",
    ],
  },
  // STS providers
  "avr-sts-openai": {
    dockerImage: "agentvoiceresponse/avr-sts-openai",
    role: "sts",
    defaultEnv: { PORT: "6030" },
    envSchema: [
      { key: "PORT", required: true },
      { key: "OPENAI_API_KEY", required: true, secret: true },
      { key: "OPENAI_MODEL", required: false },
      { key: "OPENAI_INSTRUCTIONS", required: false },
      { key: "AMI_URL", required: false },
    ],
    wsPort: 6030,
  },
  "avr-sts-deepgram": {
    dockerImage: "agentvoiceresponse/avr-sts-deepgram",
    role: "sts",
    defaultEnv: { PORT: "6033" },
    envSchema: [
      { key: "PORT", required: true },
      { key: "DEEPGRAM_API_KEY", required: true, secret: true },
      { key: "AGENT_PROMPT", required: false },
    ],
    wsPort: 6033,
  },
  "avr-sts-ultravox": {
    dockerImage: "agentvoiceresponse/avr-sts-ultravox",
    role: "sts",
    defaultEnv: { PORT: "6031" },
    envSchema: [
      { key: "PORT", required: true },
      { key: "ULTRAVOX_AGENT_ID", required: true },
      { key: "ULTRAVOX_API_KEY", required: true, secret: true },
    ],
    wsPort: 6031,
  },
  "avr-sts-gemini": {
    dockerImage: "agentvoiceresponse/avr-sts-gemini",
    role: "sts",
    defaultEnv: {
      PORT: "6037",
      GEMINI_MODEL: "gemini-2.5-flash-preview-native-audio-dialog",
      GEMINI_INSTRUCTIONS: "You are a helpful assistant.",
    },
    envSchema: [
      { key: "PORT", required: true },
      { key: "GEMINI_API_KEY", required: true, secret: true },
      { key: "GEMINI_MODEL", required: false },
      { key: "GEMINI_INSTRUCTIONS", required: false },
      { key: "AMI_URL", required: false },
    ],
    wsPort: 6037,
  },
  "avr-sts-elevenlabs": {
    dockerImage: "agentvoiceresponse/avr-sts-elevenlabs",
    role: "sts",
    defaultEnv: { PORT: "6035" },
    envSchema: [
      { key: "PORT", required: true },
      { key: "ELEVENLABS_API_KEY", required: true, secret: true },
      { key: "ELEVENLABS_AGENT_ID", required: true },
    ],
    wsPort: 6035,
  },
  // Modular ASR
  "avr-asr-deepgram": {
    dockerImage: "agentvoiceresponse/avr-asr-deepgram",
    role: "asr",
    defaultEnv: {
      PORT: "6010",
      SPEECH_RECOGNITION_LANGUAGE: "en-US",
      SPEECH_RECOGNITION_MODEL: "nova-2-phonecall",
    },
    envSchema: [
      { key: "PORT", required: true },
      { key: "DEEPGRAM_API_KEY", required: true, secret: true },
      { key: "SPEECH_RECOGNITION_LANGUAGE", required: false },
      { key: "SPEECH_RECOGNITION_MODEL", required: false },
    ],
  },
  "avr-asr-vosk": {
    dockerImage: "agentvoiceresponse/avr-asr-vosk",
    role: "asr",
    defaultEnv: { PORT: "6010", MODEL_PATH: "model" },
    envSchema: [
      { key: "PORT", required: true },
      { key: "MODEL_PATH", required: true },
    ],
    defaultVolumes: ["./model:/usr/src/app/model"],
  },
  "avr-asr-google-cloud-speech": {
    dockerImage: "agentvoiceresponse/avr-asr-google-cloud-speech",
    role: "asr",
    defaultEnv: {
      PORT: "6001",
      GOOGLE_APPLICATION_CREDENTIALS: "/usr/src/app/google.json",
      SPEECH_RECOGNITION_LANGUAGE: "en-US",
      SPEECH_RECOGNITION_MODEL: "telephony",
    },
    envSchema: [
      { key: "PORT", required: true },
      { key: "GOOGLE_APPLICATION_CREDENTIALS", required: true },
      { key: "SPEECH_RECOGNITION_LANGUAGE", required: false },
      { key: "SPEECH_RECOGNITION_MODEL", required: false },
    ],
    defaultVolumes: ["./google.json:/usr/src/app/google.json"],
  },
  // Modular TTS
  "avr-tts-deepgram": {
    dockerImage: "agentvoiceresponse/avr-tts-deepgram",
    role: "tts",
    defaultEnv: { PORT: "6011" },
    envSchema: [
      { key: "PORT", required: true },
      { key: "DEEPGRAM_API_KEY", required: true, secret: true },
    ],
  },
  "avr-tts-google-cloud-tts": {
    dockerImage: "agentvoiceresponse/avr-tts-google-cloud-tts",
    role: "tts",
    defaultEnv: {
      PORT: "6003",
      GOOGLE_APPLICATION_CREDENTIALS: "/usr/src/app/google.json",
      TEXT_TO_SPEECH_LANGUAGE: "en-US",
      TEXT_TO_SPEECH_GENDER: "FEMALE",
      TEXT_TO_SPEECH_NAME: "en-US-Chirp-HD-F",
      TEXT_TO_SPEECH_SPEAKING_RATE: "1.0",
    },
    envSchema: [
      { key: "PORT", required: true },
      { key: "GOOGLE_APPLICATION_CREDENTIALS", required: true },
      { key: "TEXT_TO_SPEECH_LANGUAGE", required: false },
      { key: "TEXT_TO_SPEECH_GENDER", required: false },
      { key: "TEXT_TO_SPEECH_NAME", required: false },
      { key: "TEXT_TO_SPEECH_SPEAKING_RATE", required: false },
    ],
    defaultVolumes: ["./google.json:/usr/src/app/google.json"],
  },
  // Modular LLM
  "avr-llm-openai": {
    dockerImage: "agentvoiceresponse/avr-llm-openai",
    role: "llm",
    defaultEnv: {
      PORT: "6002",
      OPENAI_MODEL: "gpt-3.5-turbo",
      OPENAI_MAX_TOKENS: "100",
      OPENAI_TEMPERATURE: "0.0",
      AMI_URL: "http://avr-ami:6006",
      SYSTEM_PROMPT: "You are a helpful assistant.",
    },
    envSchema: [
      { key: "PORT", required: true },
      { key: "OPENAI_API_KEY", required: true, secret: true },
      { key: "OPENAI_MODEL", required: false },
      { key: "OPENAI_MAX_TOKENS", required: false },
      { key: "OPENAI_TEMPERATURE", required: false },
      { key: "AMI_URL", required: false },
      { key: "SYSTEM_PROMPT", required: false },
    ],
    defaultVolumes: ["./tools:/usr/src/app/tools"],
  },
  "avr-llm-openrouter": {
    dockerImage: "agentvoiceresponse/avr-llm-openrouter",
    role: "llm",
    defaultEnv: {
      PORT: "6009",
      OPENROUTER_MODEL: "google/gemini-2.0-flash-lite-preview-02-05:free",
      SYSTEM_PROMPT: "You are my personal assistant",
    },
    envSchema: [
      { key: "PORT", required: true },
      { key: "OPENROUTER_API_KEY", required: true, secret: true },
      { key: "OPENROUTER_MODEL", required: false },
      { key: "SYSTEM_PROMPT", required: false },
    ],
  },
  "avr-llm-anthropic": {
    dockerImage: "agentvoiceresponse/avr-llm-anthropic",
    role: "llm",
    defaultEnv: {
      PORT: "6014",
      ANTHROPIC_MODEL: "claude-3-5-sonnet-20240620",
      ANTHROPIC_MAX_TOKENS: "1024",
      ANTHROPIC_TEMPERATURE: "1",
      ANTHROPIC_SYSTEM_PROMPT: "You are a helpful assistant.",
      AMI_URL: "http://avr-ami:6006",
    },
    envSchema: [
      { key: "PORT", required: true },
      { key: "ANTHROPIC_API_KEY", required: true, secret: true },
      { key: "ANTHROPIC_MODEL", required: false },
      { key: "ANTHROPIC_MAX_TOKENS", required: false },
      { key: "ANTHROPIC_TEMPERATURE", required: false },
      { key: "ANTHROPIC_SYSTEM_PROMPT", required: false },
      { key: "AMI_URL", required: false },
    ],
    defaultVolumes: ["./tools/get_availability.js:/usr/src/app/tools/get_availability.js"],
  },
  "avr-llm-n8n": {
    dockerImage: "agentvoiceresponse/avr-llm-n8n",
    role: "llm",
    defaultEnv: {
      PORT: "6016",
      PUBLIC_CHAT_URL: "",
    },
    envSchema: [
      { key: "PORT", required: true },
      { key: "PUBLIC_CHAT_URL", required: true },
    ],
  },
  "avr-n8n": {
    dockerImage: "n8nio/n8n:latest",
    role: "infra",
    defaultEnv: {
      GENERIC_TIMEZONE: "Europe/Amsterdam",
      NODE_ENV: "production",
      N8N_SECURE_COOKIE: "false",
    },
    envSchema: [
      { key: "GENERIC_TIMEZONE", required: false },
      { key: "NODE_ENV", required: false },
      { key: "N8N_SECURE_COOKIE", required: false },
    ],
    defaultPorts: ["5678:5678"],
    defaultVolumes: ["./n8n:/home/node/.n8n"],
  },
} as const;

export const IMAGES: Readonly<Record<ImageKey, ImageSpec>> = IMAGES_INIT;

type ImageInit = typeof IMAGES_INIT;
export type KeysByRole<R extends LogicalRole> = {
  [K in ImageKey]: ImageInit[K]["role"] extends R ? K : never;
}[ImageKey];
