import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import type { Card, Category } from "@/gen/linkhub/v1/linkhub_pb";
import { api, errorText } from "@/lib/api";
import { moveVisibleCards, sortCards } from "@/lib/card-order";

export function useWorkspaceData() {
  const auth = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const preferencesBusy = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => {
    try {
      return sessionStorage.getItem("link-hub-category") ?? "";
    } catch {
      return "";
    }
  });
  const loadVersion = useRef(0);
  const { run } = auth;
  const refresh = useCallback(async () => {
    if (preferencesBusy.current) return;
    const version = ++loadVersion.current;
    try {
      const [list, groups, preferences] = await Promise.all([
        run((options) => api.listCards({}, options)),
        run((options) => api.listCategories({}, options)),
        run((options) => api.getCardPreferences({}, options)),
      ]);
      if (version !== loadVersion.current) return;
      setCards(list.cards);
      setCategories(groups.categories);
      setFavorites(preferences.favoriteCardIds);
      setOrder(preferences.orderedCardIds);
      setError("");
      setSelected((value) =>
        groups.categories.some((c) => c.id === value) ? value : "",
      );
    } catch (e) {
      if (version === loadVersion.current) setError(errorText(e));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [run]);
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      ++loadVersion.current;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);
  useEffect(() => {
    try {
      sessionStorage.setItem("link-hub-category", selected);
    } catch {}
  }, [selected]);
  const currentCategory = categories.find((c) => c.id === selected);
  const sorted = sortCards(cards, favorites, order);
  const visible = selected
    ? sorted.filter((c) => c.categoryIds.includes(selected))
    : sorted;
  async function savePreferences(
    nextFavorites: string[],
    nextOrder: string[],
    operation: () => Promise<unknown>,
  ) {
    if (preferencesBusy.current) return;
    preferencesBusy.current = true;
    ++loadVersion.current;
    setSavingPreferences(true);
    setFavorites(nextFavorites);
    setOrder(nextOrder);
    try {
      await operation();
      setError("");
    } catch (e) {
      setFavorites(favorites);
      setOrder(order);
      setError(errorText(e));
    } finally {
      preferencesBusy.current = false;
      setSavingPreferences(false);
    }
  }
  function toggleFavorite(card: Card) {
    const favorite = !favorites.includes(card.id);
    void savePreferences(
      favorite
        ? [...favorites, card.id]
        : favorites.filter((id) => id !== card.id),
      order,
      () =>
        run((options) =>
          api.setCardFavorite({ cardId: card.id, favorite }, options),
        ),
    );
  }
  function reorder(active: string, over: string) {
    if (favorites.includes(active) !== favorites.includes(over)) return;
    const group = visible.filter(
      (card) => favorites.includes(card.id) === favorites.includes(active),
    );
    const nextOrder = moveVisibleCards(
      sorted.map((card) => card.id),
      group.map((card) => card.id),
      active,
      over,
    );
    void savePreferences(favorites, nextOrder, () =>
      run((options) => api.saveCardOrder({ cardIds: nextOrder }, options)),
    );
  }
  function updateCard(card: Card) {
    setCards((previous) =>
      [card, ...previous.filter((c) => c.id !== card.id)].sort((a, b) => {
        const aa = a.createdAt?.seconds ?? 0n;
        const bb = b.createdAt?.seconds ?? 0n;
        return aa === bb
          ? (b.createdAt?.nanos ?? 0) - (a.createdAt?.nanos ?? 0)
          : aa > bb
            ? -1
            : 1;
      }),
    );
  }
  function removeCard(id: string) {
    setCards((previous) => previous.filter((card) => card.id !== id));
  }
  return {
    cards,
    categories,
    favorites,
    selected,
    setSelected,
    currentCategory,
    visible,
    loading,
    error,
    savingPreferences,
    refresh,
    toggleFavorite,
    reorder,
    updateCard,
    removeCard,
  };
}
