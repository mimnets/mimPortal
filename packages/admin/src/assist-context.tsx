"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether this Site has an assistant, and what it should know about the Page being edited.
 *
 * Context rather than a prop, for the same reason the media library is: the alternative is
 * threading it through the settings panel, every field, and every repeater sub-field.
 */
export interface AssistSettings {
  /** False when no provider is configured, which hides the buttons entirely. */
  enabled: boolean;
  pageTitle?: string;
  siteName?: string;
}

const AssistContext = createContext<AssistSettings | null>(null);

export function AssistProvider({
  value,
  children,
}: {
  value: AssistSettings | null;
  children: ReactNode;
}) {
  return <AssistContext.Provider value={value}>{children}</AssistContext.Provider>;
}

export function useAssist(): AssistSettings | null {
  return useContext(AssistContext);
}
