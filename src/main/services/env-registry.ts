/*
  Static Env Registry derived from src/main/infra/examples/*.yml
  - No runtime parsing. This is a curated baseline to seed deployments and validate presence.
  - Defaults mirror example compose files when present; otherwise variables are marked required.
  - All UI masking is global (not per-field). "required" is used for presence-only validation.
*/

export type EnvVariableMeta = {
  name: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
};

export type ServiceEnvTemplate = {
  serviceName: string;
  variables: readonly EnvVariableMeta[];
};

export type EnvRegistry = {
  version: string;
  source: "examples";
  services: readonly ServiceEnvTemplate[];
};

// Helpers
function v(name: string, defaultValue?: string, description?: string): EnvVariableMeta {
  return {
    name,
    required: defaultValue === undefined,
    defaultValue,
    description,
  };
}

function dedupeAndSortVariables(variables: EnvVariableMeta[]): EnvVariableMeta[] {
  const byName = new Map<string, EnvVariableMeta>();
  for (const variable of variables) {
    if (!byName.has(variable.name)) {
      byName.set(variable.name, variable);
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeRegistry(registry: EnvRegistry): EnvRegistry {
  return {
    ...registry,
    services: registry.services.map((svc) => ({
      serviceName: svc.serviceName.trim(),
      variables: dedupeAndSortVariables(svc.variables as EnvVariableMeta[]),
    })),
  };
}

const RAW_ENV_REGISTRY: EnvRegistry = {
  version: "0.1.0",
  source: "examples",
  services: [
    // Core
    {
      serviceName: "avr-core",
      variables: [
        v("PORT", "5001"),
        // Composition varies: either STS_URL or explicit ASR/LLM/TTS trio
        v("STS_URL"),
        v("ASR_URL"),
        v("LLM_URL"),
        v("TTS_URL"),
        v("SYSTEM_MESSAGE", "Hello, how can I help you today?"),
        v("INTERRUPT_LISTENING", "false"),
      ],
    },

    // ASR providers
    {
      serviceName: "avr-asr-deepgram",
      variables: [
        v("PORT", "6010"),
        v("DEEPGRAM_API_KEY"),
        v("SPEECH_RECOGNITION_LANGUAGE", "en-US"),
        v("SPEECH_RECOGNITION_MODEL", "nova-2-phonecall"),
      ],
    },
    {
      serviceName: "avr-asr-vosk",
      variables: [v("PORT", "6010"), v("MODEL_PATH", "model")],
    },
    {
      serviceName: "avr-asr-google-cloud-speech",
      variables: [
        v("PORT", "6001"),
        v("GOOGLE_APPLICATION_CREDENTIALS", "/usr/src/app/google.json"),
        v("SPEECH_RECOGNITION_LANGUAGE", "en-US"),
        v("SPEECH_RECOGNITION_MODEL", "telephony"),
      ],
    },

    // TTS providers
    {
      serviceName: "avr-tts-deepgram",
      variables: [v("PORT", "6011"), v("DEEPGRAM_API_KEY")],
    },
    {
      serviceName: "avr-tts-google-cloud-tts",
      variables: [
        v("PORT", "6003"),
        v("GOOGLE_APPLICATION_CREDENTIALS", "/usr/src/app/google.json"),
        v("TEXT_TO_SPEECH_LANGUAGE", "en-US"),
        v("TEXT_TO_SPEECH_GENDER", "FEMALE"),
        v("TEXT_TO_SPEECH_NAME", "en-US-Chirp-HD-F"),
        v("TEXT_TO_SPEECH_SPEAKING_RATE", "1.0"),
      ],
    },

    // LLM providers
    {
      serviceName: "avr-llm-openai",
      variables: [
        v("PORT", "6002"),
        v("OPENAI_API_KEY"),
        v("OPENAI_MODEL", "gpt-3.5-turbo"),
        v("OPENAI_MAX_TOKENS", "100"),
        v("OPENAI_TEMPERATURE", "0.0"),
        v("AMI_URL", "http://avr-ami:6006"),
        v("SYSTEM_PROMPT", "You are a helpful assistant."),
      ],
    },
    {
      serviceName: "avr-llm-anthropic",
      variables: [
        v("PORT", "6014"),
        v("ANTHROPIC_API_KEY"),
        v("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620"),
        v("ANTHROPIC_MAX_TOKENS", "1024"),
        v("ANTHROPIC_TEMPERATURE", "1"),
        v("ANTHROPIC_SYSTEM_PROMPT", "You are a helpful assistant."),
        v("AMI_URL", "http://avr-ami:6006"),
      ],
    },
    {
      serviceName: "avr-llm-openrouter",
      variables: [
        v("PORT", "6009"),
        v("OPENROUTER_API_KEY"),
        v("OPENROUTER_MODEL", "google/gemini-2.0-flash-lite-preview-02-05:free"),
        v("SYSTEM_PROMPT", "You are my personal assistant"),
      ],
    },
    {
      serviceName: "avr-llm-n8n",
      variables: [v("PORT", "6016"), v("PUBLIC_CHAT_URL")],
    },

    // STS providers (Realtime speech/text services)
    {
      serviceName: "avr-sts-openai",
      variables: [
        v("PORT", "6030"),
        v("OPENAI_API_KEY"),
        v("OPENAI_MODEL", "gpt-4o-realtime-preview"),
        v("OPENAI_INSTRUCTIONS", "You are a helpful assistant."),
        v("AMI_URL", "http://avr-ami:6006"),
      ],
    },
    {
      serviceName: "avr-sts-ultravox",
      variables: [v("PORT", "6031"), v("ULTRAVOX_AGENT_ID"), v("ULTRAVOX_API_KEY")],
    },
    {
      serviceName: "avr-sts-deepgram",
      variables: [v("PORT", "6033"), v("DEEPGRAM_API_KEY"), v("AGENT_PROMPT")],
    },
    {
      serviceName: "avr-sts-elevenlabs",
      variables: [v("PORT", "6035"), v("ELEVENLABS_API_KEY"), v("ELEVENLABS_AGENT_ID")],
    },
    {
      serviceName: "avr-sts-gemini",
      variables: [
        v("PORT", "6037"),
        v("GEMINI_API_KEY"),
        v("GEMINI_MODEL", "gemini-2.5-flash-preview-native-audio-dialog"),
        v("GEMINI_INSTRUCTIONS", "You are a helpful assistant."),
        v("AMI_URL", "http://avr-ami:6006"),
      ],
    },

    // System/telephony
    {
      serviceName: "avr-ami",
      variables: [
        v("PORT", "6006"), // note: app compose variant sets PORT from AMI_PORT
        v("AMI_HOST", "avr-asterisk"),
        v("AMI_PORT", "5038"),
        v("AMI_USERNAME", "avr"),
        v("AMI_PASSWORD", "avr"),
      ],
    },
    {
      serviceName: "avr-asterisk",
      variables: [
        // No environment variables defined in examples
      ],
    },

    // App & DB
    {
      serviceName: "avr-app",
      variables: [
        v("PORT", "3000"),
        v("ADMIN_EMAIL"),
        v("ADMIN_PASSWORD"),
        v("DATABASE_HOST", "avr-app-db"),
        v("DATABASE_PORT", "3306"),
        v("DATABASE_NAME", "avr"),
        v("DATABASE_USERNAME", "avr"),
        v("DATABASE_PASSWORD"),
        v("DATABASE_ROOT_PASSWORD"), // not in app service itself; useful for bootstrap
        v("AMI_URL", "http://avr-ami:9000"),
        v("ARI_URL", "http://avr-asterisk:8088/ari"),
        v("ARI_USERNAME", "avr"),
        v("ARI_PASSWORD", "avr"),
      ],
    },
    {
      serviceName: "avr-app-db",
      variables: [v("MYSQL_DATABASE", "avr"), v("MYSQL_USER", "avr"), v("MYSQL_PASSWORD"), v("MYSQL_ROOT_PASSWORD")],
    },

    // n8n
    {
      serviceName: "avr-n8n",
      variables: [
        v("GENERIC_TIMEZONE", "Europe/Amsterdam"),
        v("NODE_ENV", "production"),
        v("N8N_SECURE_COOKIE", "false"),
      ],
    },
  ],
};

export const ENV_REGISTRY_VERSION = RAW_ENV_REGISTRY.version;

export const ENV_REGISTRY: EnvRegistry = (function toFrozenRegistry() {
  const normalized = normalizeRegistry(RAW_ENV_REGISTRY);
  // Shallow-freeze top-level and service arrays for immutability guarantees
  const frozenServices = normalized.services.map((svc) => ({
    serviceName: svc.serviceName,
    variables: Object.freeze([...(svc.variables as EnvVariableMeta[])]),
  }));
  return Object.freeze({ ...normalized, services: Object.freeze(frozenServices) });
})();
