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
import type { Card, Category } from "@/gen/linkhub/v1/linkhub_pb";
import { api, errorText } from "@/lib/api";
import { validURL } from "@/lib/markdown";
import { useAuth } from "@/auth/AuthProvider";
const MarkdownEditor = lazy(() => import("./MarkdownEditor"));
export type Draft = {
  id?: string;
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
  const [draft, setDraft] = useState(initial);
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
                支持文字、列表、链接和代码。卡片预览从描述自动生成。
              </p>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              {!auth.user?.isAdmin && (
                <div className="form-auth-notice">
                  <p>需要管理员登录后保存，填写的内容已保留。</p>
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
                <Button type="submit" disabled={busy || !auth.user?.isAdmin}>
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
