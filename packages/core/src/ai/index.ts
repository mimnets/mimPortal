// AI is a server concern: it holds API keys and opens streams. It is deliberately not
// re-exported from "@mimnets/core", which the Editor imports in a browser.

export { anthropicProvider } from "./anthropic";
export {
  openAiCompatibleProvider,
  openRouterProvider,
  openAiProvider,
  deepSeekProvider,
} from "./openai-compatible";
export { providerChain, collect } from "./chain";
export { ProviderError, NoProviderAvailable } from "./provider";
export type { AiProvider, AiRequest } from "./provider";
export { ASSIST_ACTIONS, ASSIST_SYSTEM, assistPrompt } from "./assist";
export type { AssistContext } from "./assist";
export type { AssistAction } from "./actions";
export {
  generatePreset,
  presetSchema,
  presetPageSchema,
  extractJson,
  PRESET_DIRECTIONS,
} from "./preset";
export type { GeneratedPreset, GenerateOptions, PresetInput } from "./preset";
export { describeRegistry, describeLayoutRules, describeComposition } from "./registry-prompt";
