"use client";

import { Editor, type AssistSettings, type MediaItem } from "@mimnets/admin";
import type { ReactNode } from "react";
import type { PageLayout, RenderContext, SlotName } from "@mimnets/core";

import { registry } from "../../../../blocks.config";
import type { PageVersionSummary, PublishResult } from "../../actions";

/**
 * The registry holds React components and Zod schemas, so it cannot be serialised across
 * the server/client boundary. Both sides import blocks.config directly instead: the server
 * to validate a save, the browser to render and edit.
 */
export function EditorClient({
  layout,
  pageTitle,
  revision,
  versions,
  lockedSlots,
  signedInAs,
  context,
  onSave,
  onPublish,
  onRestore,
  onSignOut,
  onListMedia,
  onUploadMedia,
  mediaBaseUrl,
  nav,
  assist,
  slotNotes,
}: {
  layout: PageLayout;
  pageTitle: string;
  /** The Page's revision when this screen was rendered. Guards against a stale tab. */
  revision: number;
  versions: PageVersionSummary[];
  lockedSlots: SlotName[];
  signedInAs: string;
  context: RenderContext;
  onSave: (layout: PageLayout, expectedRevision: number | null) => Promise<number>;
  onPublish: (layout: PageLayout, expectedRevision: number | null) => Promise<PublishResult>;
  onRestore: (versionId: string) => Promise<PageLayout>;
  onSignOut: () => Promise<void>;
  onListMedia: () => Promise<MediaItem[]>;
  onUploadMedia: (form: FormData) => Promise<MediaItem>;
  mediaBaseUrl: string;
  nav: ReactNode;
  assist: AssistSettings;
  slotNotes: Partial<Record<SlotName, string>>;
}) {
  return (
    <Editor
      layout={layout}
      registry={registry}
      pageTitle={pageTitle}
      revision={revision}
      versions={versions}
      lockedSlots={lockedSlots}
      signedInAs={signedInAs}
      context={context}
      onSave={onSave}
      onPublish={onPublish}
      onRestore={onRestore}
      onSignOut={onSignOut}
      media={{ list: onListMedia, upload: onUploadMedia, baseUrl: mediaBaseUrl }}
      nav={nav}
      assist={assist}
      slotNotes={slotNotes}
    />
  );
}
