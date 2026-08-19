"use client";

import type { ReactNode } from "react";
import { Editor, type AssistSettings, type MediaItem } from "@mimnets/admin";
import type { PageLayout, RenderContext, SlotName } from "@mimnets/core";

import { registry } from "../../../../blocks.config";

/**
 * The Editor, showing one shared Slot.
 *
 * The registry holds React components and Zod schemas, so it cannot cross the server/client
 * boundary — this side imports blocks.config directly, exactly as the Page editor does.
 *
 * Publish and History are absent rather than disabled: a shared Slot has neither, and a
 * greyed-out button invites someone to work out why.
 */
export function SlotEditorClient({
  layout,
  slot,
  title,
  context,
  signedInAs,
  mediaBaseUrl,
  assist,
  onSave,
  onListMedia,
  onUploadMedia,
  nav,
}: {
  layout: PageLayout;
  slot: SlotName;
  title: string;
  context: RenderContext;
  signedInAs: string;
  mediaBaseUrl: string;
  assist: AssistSettings;
  onSave: (layout: PageLayout) => Promise<void>;
  onListMedia: () => Promise<MediaItem[]>;
  onUploadMedia: (form: FormData) => Promise<MediaItem>;
  nav: ReactNode;
}) {
  return (
    <Editor
      layout={layout}
      registry={registry}
      pageTitle={title}
      versions={[]}
      visibleSlots={[slot]}
      hidePublish
      saveLabel="Save"
      signedInAs={signedInAs}
      context={context}
      nav={nav}
      assist={assist}
      media={{ list: onListMedia, upload: onUploadMedia, baseUrl: mediaBaseUrl }}
      onSave={onSave}
      // Neither is reachable: Publish is hidden and History has nothing to show.
      onPublish={async () => []}
      onRestore={async () => layout}
    />
  );
}
