import type { Card } from "@/gen/linkhub/v1/linkhub_pb";

export function sortCards(cards: Card[], favorites: string[], order: string[]) {
  const starred = new Set(favorites);
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...cards].sort((a, b) => {
    const favorite = Number(starred.has(b.id)) - Number(starred.has(a.id));
    if (favorite) return favorite;
    const aa = positions.get(a.id) ?? Infinity;
    const bb = positions.get(b.id) ?? Infinity;
    if (aa !== bb) return aa < bb ? -1 : 1;
    const at = a.createdAt?.seconds ?? 0n;
    const bt = b.createdAt?.seconds ?? 0n;
    if (at !== bt) return at > bt ? -1 : 1;
    const nanos = (b.createdAt?.nanos ?? 0) - (a.createdAt?.nanos ?? 0);
    return nanos || (a.id > b.id ? -1 : a.id === b.id ? 0 : 1);
  });
}

// Only replace visible slots, keeping cards hidden by the current category in place.
export function moveVisibleCards(
  all: string[],
  visible: string[],
  active: string,
  over: string,
) {
  const from = visible.indexOf(active),
    to = visible.indexOf(over);
  if (from < 0 || to < 0 || from === to) return all;
  const moved = [...visible];
  moved.splice(to, 0, ...moved.splice(from, 1));
  const included = new Set(visible);
  let index = 0;
  return all.map((id) => (included.has(id) ? moved[index++] : id));
}
