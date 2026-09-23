import { useEffect, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  Check,
  FolderOpen,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardEditor } from "@/components/CardEditor";
import { CategoryManager } from "@/components/CategoryManager";
import { CardGrid } from "@/components/CardGrid";
import { CardDetailsDialog } from "@/components/cards/CardDetailsDialog";
import { CardDeleteDialog } from "@/components/cards/CardDeleteDialog";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { newDraft, cardDraft, readDraft, type Draft } from "@/lib/card-draft";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";
import type { Card } from "@/gen/linkhub/v1/linkhub_pb";

export function WorkspacePage() {
  const auth = useAuth();
  const admin = !!auth.user?.isAdmin;
  const {
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
  } = useWorkspaceData();
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const details = cards.find((card) => card.id === detailsId);
  const [sidebar, setSidebar] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [categoryManager, setCategoryManager] = useState(false);
  const [deleting, setDeleting] = useState<Card | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const restored = useRef(false);
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      const saved = readDraft();
      if (saved) setDraft(saved);
    }
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  function select(id: string) {
    setSelected(id);
    setSidebar(false);
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError("");
    try {
      await auth.run((options) => api.deleteCard({ id: deleting.id }, options));
      removeCard(deleting.id);
      setDeleting(null);
      setToast("卡片已删除");
      await refresh();
    } catch (e) {
      setDeleteError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <a href="#main" className="skip-link">
        跳至工具列表
      </a>
      <WorkspaceSidebar
        categories={categories}
        cardCount={cards.length}
        selected={selected}
        admin={admin}
        open={sidebar}
        onOpenChange={setSidebar}
        onSelect={select}
        onManageCategories={() => {
          setSidebar(false);
          setCategoryManager(true);
        }}
      />
      <div className="workspace">
        <WorkspaceHeader onOpenSidebar={() => setSidebar(true)} />
        <main id="main" tabIndex={-1}>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span />
                YOUR TEAM, CONNECTED
              </div>
              <h1>
                {currentCategory?.name ?? "全部工具"}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {currentCategory
                  ? "属于这个分类的工具与资源，一处直达。"
                  : "团队常用的系统、工具与文档，都在这里。"}
              </p>
            </div>
            <Button onClick={() => setDraft(newDraft(admin))}>
              <Plus />
              添加卡片
            </Button>
          </section>
          {(error || auth.error || (auth.user && !admin)) && (
            <div className="page-notice" role="status">
              {error ||
                auth.error ||
                "他人维护的公开卡片和收到的分享只读；你可以添加公开或私有卡片，管理自己的收藏和顺序。"}
              {error && (
                <Button variant="ghost" onClick={() => void refresh()}>
                  <RefreshCw />
                  重试
                </Button>
              )}
            </div>
          )}
          <div className="collection-bar">
            <div>
              <span className="collection-label">
                {selected ? "分类入口" : "所有入口"}
              </span>
              <span className="count-pill">{visible.length}</span>
            </div>
            <span className="sort-label">
              <ArrowDownWideNarrow />
              {savingPreferences ? "正在保存…" : "收藏置顶 · 拖拽调整顺序"}
            </span>
          </div>
          {loading ? (
            <div className="empty-state" role="status">
              正在加载团队工具…
            </div>
          ) : visible.length ? (
            <CardGrid
              cards={visible}
              categories={categories}
              favorites={favorites}
              admin={admin}
              disabled={savingPreferences}
              onFavorite={toggleFavorite}
              onReorder={reorder}
              onDetails={(card) => setDetailsId(card.id)}
              onEdit={(card) => setDraft(cardDraft(card))}
              onDelete={(card) => {
                setDeleteError("");
                setDeleting(card);
              }}
            />
          ) : (
            <div className="empty-state">
              <span data-icon>
                <FolderOpen />
              </span>
              <h2>
                {error
                  ? "暂时无法加载工具"
                  : selected
                    ? "这个分类还没有工具"
                    : "团队的常用入口，从这里开始"}
              </h2>
              <p>
                {error
                  ? "请检查连接后重试。"
                  : admin
                    ? "先准备好分类，再添加团队常用的系统或工具。"
                    : "你可以添加自己的公开或私有卡片，或等待管理员添加公开工具。"}
              </p>
              {admin && !error && (
                <Button
                  onClick={() =>
                    categories.length
                      ? setDraft(newDraft(admin))
                      : setCategoryManager(true)
                  }
                >
                  <Plus />
                  {categories.length ? "添加第一张卡片" : "添加第一个分类"}
                </Button>
              )}
            </div>
          )}
          <footer className="main-footer">
            <span>
              <i className="footer-dot" />
              团队共享 · 点击卡片，在新标签页打开
            </span>
            <span>少一些寻找，多一些专注。</span>
          </footer>
        </main>
      </div>
      <CardDetailsDialog
        card={details}
        categories={categories}
        onClose={() => setDetailsId(null)}
      />
      {draft && (
        <CardEditor
          initial={draft}
          categories={categories}
          onClose={() => setDraft(null)}
          manageCategories={() => setCategoryManager(true)}
          onSaved={(card) => {
            updateCard(card);
            setDraft(null);
            setToast("卡片已保存");
            void refresh();
          }}
        />
      )}
      {admin && categoryManager && (
        <CategoryManager
          categories={categories}
          onClose={() => setCategoryManager(false)}
          onChanged={refresh}
        />
      )}
      <CardDeleteDialog
        card={deleting}
        busy={busy}
        error={deleteError}
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
      {toast && (
        <div className="toast" role="status">
          <Check />
          {toast}
        </div>
      )}
    </>
  );
}
