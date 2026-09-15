import type { Card } from "@/gen/linkhub/v1/linkhub_pb";

export type Draft = {
  id?: string;
  isPrivate?: boolean;
  ownerId?: string;
  sharedUserIds?: string[];
  name: string;
  url: string;
  descriptionMarkdown: string;
  categoryIds: string[];
  updatedSeconds?: string;
  updatedNanos?: number;
};
export const draftKey = "link-hub-card-draft";
export function clearDraft() {
  try {
    sessionStorage.removeItem(draftKey);
  } catch {}
}
export function readDraft(): Draft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(draftKey) ?? "null");
    return value &&
      typeof value.name === "string" &&
      typeof value.url === "string" &&
      typeof value.descriptionMarkdown === "string" &&
      Array.isArray(value.categoryIds) &&
      value.categoryIds.every((id: unknown) => typeof id === "string")
      ? value
      : null;
  } catch {
    return null;
  }
}
export function newDraft(admin: boolean): Draft {
  return {
    name: "",
    url: "",
    descriptionMarkdown: "",
    categoryIds: [],
    isPrivate: !admin,
    sharedUserIds: [],
  };
}
export function cardDraft(card: Card): Draft {
  return {
    id: card.id,
    isPrivate: card.isPrivate,
    ownerId: card.ownerId,
    sharedUserIds: [...card.sharedUserIds],
    name: card.name,
    url: card.url,
    descriptionMarkdown: card.descriptionMarkdown,
    categoryIds: [...card.categoryIds],
    updatedSeconds: card.updatedAt?.seconds.toString(),
    updatedNanos: card.updatedAt?.nanos,
  };
}
