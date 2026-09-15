import { lazy, Suspense, useEffect, useState } from "react";
import { Link as LinkIcon, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { Card, Category, Member } from "@/gen/linkhub/v1/linkhub_pb";
import { api, errorText } from "@/lib/api";
import { validURL } from "@/lib/markdown";
import { useAuth } from "@/auth/AuthProvider";
const MarkdownEditor = lazy(() => import("./MarkdownEditor"));
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
export function CardEditor({
  initial,
  categories,
  onClose,
  onSaved,
  manageCategories,
}: {
  initial: Draft;
  categories: Category[];
  onClose: () => void;
  onSaved: (card: Card) => void;
  manageCategories: () => void;
}) {
  const auth = useAuth();
  const [draft, setDraft] = useState({
    ...initial,
    isPrivate: initial.isPrivate ?? !auth.user?.isAdmin,
    sharedUserIds: initial.sharedUserIds ?? [],
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [memberError, setMemberError] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberRetry, setMemberRetry] = useState(0);
  const { run } = auth;
  useEffect(() => {
    if (!draft.isPrivate) return;
    let alive = true;
    setMembersLoading(true);
    setMemberError("");
    run((options) => api.listMembers({}, options))
      .then((response) => {
        if (alive) setMembers(response.members);
      })
      .catch((e) => {
        if (alive) setMemberError(errorText(e));
      })
      .finally(() => {
        if (alive) setMembersLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [draft.isPrivate, run, memberRetry]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  function close() {
    if (busy) return;
    if (dirty) setConfirmClose(true);
    else discard();
  }
  function discard() {
    clearDraft();
    onClose();
  }
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const name = draft.name.trim();
    const url = draft.url.trim();
    if (!name || [...name].length > 80) {
      setError("请填写 1–80 字的名称。");
      return;
    }
    if (!validURL(url)) {
      setError("请填写完整的 http:// 或 https:// 链接，不包含账号密码。");
      return;
    }
    if (!draft.categoryIds.length) {
      setError("请至少选择一个分类。");
      return;
    }
    if (draft.categoryIds.some((id) => !categories.some((c) => c.id === id))) {
      setError("选中的分类已被删除，请重新选择分类。");
      setDraft((d) => ({
        ...d,
        categoryIds: d.categoryIds.filter((id) =>
          categories.some((c) => c.id === id),
        ),
      }));
      return;
    }
    setBusy(true);
    try {
      const card = {
        name,
        url,
        descriptionMarkdown: draft.descriptionMarkdown,
        categoryIds: draft.categoryIds,
        isPrivate: draft.isPrivate,
        sharedUserIds: draft.isPrivate ? draft.sharedUserIds : [],
      };
      const result = await auth.run<{ card?: Card }>((options) =>
        draft.id
          ? api.updateCard(
              {
                id: draft.id,
                card,
                expectedUpdatedAt: draft.updatedSeconds
                  ? {
                      seconds: BigInt(draft.updatedSeconds),
                      nanos: draft.updatedNanos ?? 0,
                    }
                  : undefined,
              },
              options,
            )
          : api.createCard({ card }, options),
      );
      if (!result.card)
        throw new Error("服务未返回卡片，请刷新后确认保存结果。");
      clearDraft();
      onSaved(result.card);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          sheet
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            close();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <form className="drawer-layout" onSubmit={save} noValidate>
            <header className="drawer-header">
              <div>
                <div className="modal-eyebrow">
                  WORKSPACE / {draft.id ? "EDIT" : "NEW"}
                </div>
                <DialogTitle>
                  {draft.id ? "编辑卡片" : "添加新卡片"}
                </DialogTitle>
              </div>
            </header>
            <div className="drawer-body">
              <DialogDescription className="form-intro">
                让团队更快找到需要的工具。带 * 的项目为必填项。
              </DialogDescription>
              <label className="field-label" htmlFor="card-name">
                名称 <span>*</span>
              </label>
              <Input
                id="card-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={80}
                placeholder="例如：项目管理平台"
                required
                autoComplete="off"
              />
              <label className="field-label" htmlFor="card-url">
                链接 <span>*</span>
              </label>
              <div className="input-with-icon">
                <span>
                  <LinkIcon />
                </span>
                <Input
                  id="card-url"
                  type="url"
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  maxLength={2048}
                  placeholder="https://"
                  required
                />
              </div>
              <fieldset className="visibility-fieldset">
                <legend className="field-label">可见范围</legend>
                <div className="category-options">
                  <label className="category-option">
                    <input
                      type="radio"
                      name="visibility"
                      checked={!draft.isPrivate}
                      disabled={!auth.user?.isAdmin}
                      onChange={() => setDraft({ ...draft, isPrivate: false })}
                    />
                    内部公开
                  </label>
                  <label className="category-option">
                    <input
                      type="radio"
                      name="visibility"
                      checked={draft.isPrivate}
                      onChange={() => setDraft({ ...draft, isPrivate: true })}
                    />
                    私有
                  </label>
                </div>
                <p className="field-hint">
                  {draft.isPrivate
                    ? "创建者和指定成员可见；管理员可查看和维护。普通分享接收者只读。"
                    : "所有登录用户可见，由管理员维护。"}
                </p>
              </fieldset>
              {draft.isPrivate && (
                <fieldset className="sharing-fieldset">
                  <legend className="field-label">
                    分享给团队成员 <small>选填 · 只读</small>
                  </legend>
                  <Input
                    aria-label="搜索分享成员"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="搜索姓名或账号"
                  />
                  <div className="sharing-members">
                    {members
                      .filter(
                        (m) =>
                          m.id !== (initial.ownerId || auth.user?.id) &&
                          `${m.name} ${m.username}`
                            .toLowerCase()
                            .includes(memberSearch.toLowerCase()),
                      )
                      .map((m) => (
                        <label className="sharing-member" key={m.id}>
                          <input
                            type="checkbox"
                            checked={draft.sharedUserIds.includes(m.id)}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                sharedUserIds: e.target.checked
                                  ? [...draft.sharedUserIds, m.id]
                                  : draft.sharedUserIds.filter(
                                      (id) => id !== m.id,
                                    ),
                              })
                            }
                          />
                          <span>
                            {m.name || m.username}
                            <small>{m.username}</small>
                          </span>
                        </label>
                      ))}
                  </div>
                  {membersLoading && (
                    <p className="field-hint" role="status">
                      正在加载成员…
                    </p>
                  )}
                  {memberError && (
                    <p className="field-error" role="alert">
                      {memberError}
                      <Button
                        variant="ghost"
                        onClick={() => setMemberRetry((value) => value + 1)}
                      >
                        重试
                      </Button>
                    </p>
                  )}
                  <p className="field-hint">
                    已选择 {draft.sharedUserIds.length}{" "}
                    人。成员需至少登录过本站一次，才会出现在名单中。取消勾选并保存即可撤销分享。
                  </p>
                </fieldset>
              )}
              <fieldset className="category-fieldset">
                <legend className="field-label">
                  所属分类 <span>*</span>
                  <small>可多选</small>
                </legend>
                <div className="category-options">
                  {categories.map((c) => (
                    <label className="category-option" key={c.id}>
                      <input
                        type="checkbox"
                        checked={draft.categoryIds.includes(c.id)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            categoryIds: e.target.checked
                              ? [...draft.categoryIds, c.id]
                              : draft.categoryIds.filter((id) => id !== c.id),
                          })
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                  {categories.length === 0 && (
                    <p className="field-hint">还没有分类，请先添加一个。</p>
                  )}
                </div>
              </fieldset>
              <Button
                variant="ghost"
                className="manage-categories"
                onClick={manageCategories}
                disabled={!auth.user?.isAdmin}
              >
                管理分类
              </Button>
              <label className="field-label" htmlFor="card-description">
                描述 <small>选填 · Markdown</small>
              </label>
              <Suspense
                fallback={<div className="editor-loading">正在加载编辑器…</div>}
              >
                <MarkdownEditor
                  value={draft.descriptionMarkdown}
                  onChange={(descriptionMarkdown) =>
                    setDraft({ ...draft, descriptionMarkdown })
                  }
                />
              </Suspense>
              <p className="field-hint">
                支持文字、列表、链接和代码。说明保存在卡片中，不在概览展示。
              </p>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              {!auth.user && (
                <div className="form-auth-notice">
                  <p>需要登录后保存，填写的内容已保留。</p>
                  <Button variant="outline" onClick={() => void auth.login()}>
                    重新登录
                  </Button>
                </div>
              )}
            </div>
            <footer className="drawer-footer">
              <span>在新标签页打开链接</span>
              <div>
                <Button variant="outline" onClick={close} disabled={busy}>
                  取消
                </Button>
                <Button type="submit" disabled={busy || !auth.user}>
                  <Save />
                  {busy ? "保存中…" : "保存卡片"}
                </Button>
              </div>
            </footer>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="confirm-dialog">
          <DialogTitle>放弃本次编辑？</DialogTitle>
          <DialogDescription>尚未保存的更改将被丢弃。</DialogDescription>
          <div className="confirm-actions">
            <Button variant="outline" onClick={() => setConfirmClose(false)}>
              继续编辑
            </Button>
            <Button variant="destructive" onClick={discard}>
              放弃更改
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
