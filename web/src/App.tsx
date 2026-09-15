import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
  Grid2X2,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { CardEditor, readDraft, type Draft } from "./components/CardEditor";
import { CategoryManager } from "./components/CategoryManager";
const Markdown = lazy(() =>
  import("./components/Markdown").then((module) => ({
    default: module.Markdown,
  })),
);
import { api, errorText } from "./lib/api";
import { domain, excerpt } from "./lib/markdown";
import { useAuth } from "./auth/AuthProvider";
import type { Card, Category } from "./gen/linkhub/v1/linkhub_pb";
function Logo({ name }: { name: string }) {
  return (
    <span className="tool-logo" aria-hidden="true">
      {[...name][0]?.toUpperCase()}
    </span>
  );
}
function newDraft(): Draft {
  return { name: "", url: "", descriptionMarkdown: "", categoryIds: [] };
}
function cardDraft(card: Card): Draft {
  return {
    id: card.id,
    name: card.name,
    url: card.url,
    descriptionMarkdown: card.descriptionMarkdown,
    categoryIds: [...card.categoryIds],
    updatedSeconds: card.updatedAt?.seconds.toString(),
    updatedNanos: card.updatedAt?.nanos,
  };
}
export default function App() {
  const auth = useAuth();
  if (!auth.ready || !auth.user) {
    return (
      <main className="login-page">
        <section
          className="login-dialog login-panel"
          aria-labelledby="login-title"
        >
          <div className="login-illustration">
            <ShieldCheck />
          </div>
          <div className="modal-eyebrow">LINK HUB / WORKSPACE</div>
          <h1 id="login-title">团队导航</h1>
          <p>登录团队账号，访问常用系统、工具与文档。</p>
          {!auth.ready ? (
            <p role="status">正在验证登录状态…</p>
          ) : (
            <Button onClick={() => void auth.login()}>
              <span className="microsoft-logo" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              使用 Microsoft 登录
              <ArrowUpRight />
            </Button>
          )}
          {auth.error && (
            <p className="field-error" role="alert">
              {auth.error}
            </p>
          )}
          <p>普通成员可查看，管理员可维护内容。</p>
        </section>
      </main>
    );
  }
  return <Workspace key={auth.user.id} />;
}
function Workspace() {
  const auth = useAuth();
  const admin = !!auth.user?.isAdmin;
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => {
    try {
      return sessionStorage.getItem("link-hub-category") ?? "";
    } catch {
      return "";
    }
  });
  const [sidebar, setSidebar] = useState(false);
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme ?? "light",
  );
  const [details, setDetails] = useState<Card | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [categoryManager, setCategoryManager] = useState(false);
  const [deleting, setDeleting] = useState<Card | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const restored = useRef(false);
  const loadVersion = useRef(0);
  const { run } = auth;
  const refresh = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const [list, groups] = await Promise.all([
        run((options) => api.listCards({}, options)),
        run((options) => api.listCategories({}, options)),
      ]);
      if (version !== loadVersion.current) return;
      setCards(list.cards);
      setCategories(groups.categories);
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
    if (admin && !restored.current) {
      restored.current = true;
      const saved = readDraft();
      if (saved) setDraft(saved);
    }
  }, [admin]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.colorMode = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("link-hub-theme", theme);
    } catch { }
  }, [theme]);
  useEffect(() => {
    try {
      sessionStorage.setItem("link-hub-category", selected);
    } catch { }
  }, [selected]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const currentCategory = categories.find((c) => c.id === selected);
  const visible = selected
    ? cards.filter((c) => c.categoryIds.includes(selected))
    : cards;
  function select(id: string) {
    setSelected(id);
    setSidebar(false);
  }
  const nav = (
    <>
      <a className="brand" href="/" aria-label="团队导航首页">
        <span className="brand-mark">
          <Grid2X2 />
        </span>
        <span>
          <strong>团队导航</strong>
          <small>LINK HUB / WORKSPACE</small>
        </span>
      </a>
      <div className="sidebar-section-label">
        <span>工作空间</span>
        <i className="tiny-dot" />
      </div>
      <nav aria-label="工具分类">
        <button
          className={`nav-item ${!selected ? "active" : ""}`}
          aria-current={!selected ? "page" : undefined}
          onClick={() => select("")}
        >
          <LayoutGrid />
          全部工具<span className="nav-count">{cards.length}</span>
        </button>
        <div className="nav-separator" />
        <p className="nav-caption">按分类浏览</p>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`nav-item ${selected === c.id ? "active" : ""}`}
            aria-current={selected === c.id ? "page" : undefined}
            onClick={() => select(c.id)}
          >
            <Folder />
            <span className="nav-name">{c.name}</span>
            <span className="nav-count">{c.cardCount}</span>
          </button>
        ))}
      </nav>
      {admin && (
        <button
          className="manage-categories"
          onClick={() => {
            setSidebar(false);
            setCategoryManager(true);
          }}
        >
          <Settings2 />
          管理分类
        </button>
      )}
      <div className="sidebar-bottom">
        <div className="workspace-note">
          <span>
            <Users />
          </span>
          <div>
            <strong>让好用的工具，被团队看见</strong>
            <p>常用入口，触手可及。</p>
          </div>
        </div>
        <div className="sidebar-footer">
          <ShieldCheck />
          <span>团队共享工作空间</span>
        </div>
      </div>
    </>
  );
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError("");
    try {
      await auth.run((options) => api.deleteCard({ id: deleting.id }, options));
      setCards((previous) => previous.filter((c) => c.id !== deleting.id));
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
      <aside className="sidebar desktop-sidebar">{nav}</aside>
      <Dialog open={sidebar} onOpenChange={setSidebar}>
        <DialogContent
          className="mobile-navigation"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">工具分类</DialogTitle>
          <div className="sidebar open">{nav}</div>
        </DialogContent>
      </Dialog>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              size="icon"
              variant="ghost"
              className="menu-button"
              aria-label="打开分类栏"
              onClick={() => setSidebar(true)}
            >
              <Menu />
            </Button>
            <span className="breadcrumb-root">工作空间</span>
            <span className="breadcrumb-slash">/</span>
            <span>团队导航</span>
          </div>
          <div className="topbar-actions">
            <div className="theme-switch" role="group" aria-label="外观">
              <button
                aria-label="浅色模式"
                aria-pressed={theme === "light"}
                onClick={() => setTheme("light")}
              >
                <Sun />
              </button>
              <button
                aria-label="深色模式"
                aria-pressed={theme === "dark"}
                onClick={() => setTheme("dark")}
              >
                <Moon />
              </button>
            </div>
            <span className="action-divider" />
            <div className="user-menu">
              <span title={auth.user?.username}>
                {auth.user?.name || "团队成员"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="退出登录"
                onClick={() => void auth.logout()}
              >
                <LogOut />
              </Button>
            </div>
          </div>
        </header>
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
            {admin ? (
              <Button onClick={() => setDraft(newDraft())}>
                <Plus />
                添加卡片
              </Button>
            ) : (
              <div className="heading-symbol" aria-hidden="true">
                <Grid2X2 />
              </div>
            )}
          </section>
          {(error || auth.error || (auth.user && !admin)) && (
            <div className="page-notice" role="status">
              {error ||
                auth.error ||
                "已登录。当前账号为浏览权限，维护内容需要管理员角色。"}
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
              最近添加
            </span>
          </div>
          {loading ? (
            <div className="empty-state" role="status">
              正在加载团队工具…
            </div>
          ) : visible.length ? (
            <div className="card-grid">
              {visible.map((card) => (
                <article
                  className={`tool-card ${admin ? "admin-card" : ""}`}
                  key={card.id}
                >
                  <div className="card-head">
                    <Logo name={card.name} />
                    <div className="card-heading">
                      <h2 className="card-title">
                        <a
                          href={card.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${card.name}（新标签页打开）`}
                        >
                          {card.name}
                        </a>
                      </h2>
                      <p className="card-subtitle">{domain(card.url)}</p>
                    </div>
                    <span className="external-indicator" aria-hidden="true">
                      <ArrowUpRight />
                    </span>
                  </div>
                  <div className="card-footer">
                    <div className="card-tags">
                      {categories
                        .filter((c) => card.categoryIds.includes(c.id))
                        .map((c) => (
                          <span className="tag" key={c.id}>
                            {c.name}
                          </span>
                        ))}
                    </div>
                    <button
                      className="details-button"
                      aria-label={`查看说明：${card.name}`}
                      onClick={() => setDetails(card)}
                    >
                      查看说明
                      <ChevronRight />
                    </button>
                    {admin && (
                      <div className="admin-actions">
                        <button
                          className="icon-button"
                          aria-label={`编辑卡片：${card.name}`}
                          onClick={() => setDraft(cardDraft(card))}
                        >
                          <Pencil />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`删除卡片：${card.name}`}
                          onClick={() => {
                            setDeleteError("");
                            setDeleting(card);
                          }}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
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
                    : "管理员添加工具后，将在这里展示。"}
              </p>
              {admin && !error && (
                <Button
                  onClick={() =>
                    categories.length
                      ? setDraft(newDraft())
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
      <Dialog
        open={!!details}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      >
        <DialogContent
          className="description-dialog"
          aria-describedby={undefined}
        >
          {details && (
            <>
              <header className="modal-header">
                <div className="modal-title-group">
                  <Logo name={details.name} />
                  <div>
                    <div className="modal-eyebrow">工具说明</div>
                    <DialogTitle>{details.name}</DialogTitle>
                  </div>
                </div>
              </header>
              <div className="description-meta">
                {categories
                  .filter((c) => details.categoryIds.includes(c.id))
                  .map((c) => (
                    <span className="tag" key={c.id}>
                      {c.name}
                    </span>
                  ))}
              </div>
              <Suspense fallback={<p className="field-hint">正在加载说明…</p>}>
                <Markdown value={details.descriptionMarkdown} />
              </Suspense>
              <footer className="modal-footer">
                <span className="domain-label">{domain(details.url)}</span>
                <Button asChild>
                  <a
                    href={details.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    打开工具
                    <ArrowUpRight />
                  </a>
                </Button>
              </footer>
            </>
          )}
        </DialogContent>
      </Dialog>
      {admin && draft && (
        <CardEditor
          initial={draft}
          categories={categories}
          onClose={() => setDraft(null)}
          manageCategories={() => setCategoryManager(true)}
          onSaved={(card) => {
            setCards((previous) =>
              [card, ...previous.filter((c) => c.id !== card.id)].sort(
                (a, b) => {
                  const aa = a.createdAt?.seconds ?? 0n;
                  const bb = b.createdAt?.seconds ?? 0n;
                  return aa === bb
                    ? (b.createdAt?.nanos ?? 0) - (a.createdAt?.nanos ?? 0)
                    : aa > bb
                      ? -1
                      : 1;
                },
              ),
            );
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
      <Dialog
        open={admin && !!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent className="confirm-dialog">
          <div className="confirm-icon">
            <Trash2 />
          </div>
          <DialogTitle>删除这张卡片？</DialogTitle>
          <DialogDescription>
            “{deleting?.name}”将从团队导航中移除，此操作无法撤销。
          </DialogDescription>
          <div className="confirm-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !admin}
              onClick={() => void remove()}
            >
              {busy ? "删除中…" : "确认删除"}
            </Button>
          </div>
          {deleteError && (
            <p className="field-error" role="alert">
              {deleteError}
            </p>
          )}
          {!admin && (
            <Button onClick={() => void auth.login()}>重新登录</Button>
          )}
        </DialogContent>
      </Dialog>
      {toast && (
        <div className="toast" role="status">
          <Check />
          {toast}
        </div>
      )}
    </>
  );
}
