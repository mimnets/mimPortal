"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SectionNode } from "@mimnets/core";

/**
 * Blueprints: a Section saved by name, dropped into a Page as a copy.
 *
 * **Not a Shared Slot.** A Shared Slot is one Section used in many places and edited once
 * (ADR-0015); a Blueprint stops being related to its source the moment it is inserted.
 * Editing a Blueprint changes nothing already placed, and editing a placed Section changes
 * no Blueprint. That is what makes it a starting point rather than a dependency, and it is
 * why the two cannot be one feature.
 *
 * The bridge is the same shape as `MediaBridge`, and for the same reason: this package does
 * not know a Site's routes or its database, so a Dashboard passes the server actions in and
 * the Editor still works without them — with the controls absent rather than broken.
 */

export interface Blueprint {
  id: string;
  name: string;
  /** One Section, already validated against this Site's registry before it was stored. */
  section: SectionNode;
}

export interface BlueprintBridge {
  list: () => Promise<Blueprint[]>;
  /** Returns the saved Blueprint, so the list updates without a second round trip. */
  save: (name: string, section: SectionNode) => Promise<Blueprint>;
  remove: (id: string) => Promise<void>;
}

const BlueprintContext = createContext<BlueprintBridge | null>(null);

export function BlueprintProvider({
  value,
  children,
}: {
  value: BlueprintBridge | null;
  children: ReactNode;
}) {
  return <BlueprintContext.Provider value={value}>{children}</BlueprintContext.Provider>;
}

/** Null when the Dashboard did not wire one, which is how the controls stay hidden. */
export function useBlueprints(): BlueprintBridge | null {
  return useContext(BlueprintContext);
}
