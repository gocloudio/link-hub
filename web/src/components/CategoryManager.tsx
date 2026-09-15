import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { Category } from "@/gen/linkhub/v1/linkhub_pb";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";
export function CategoryManager({
  categories,
  onClose,
  onChanged,
}: {
  categories: Category[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const auth = useAuth();
  const [name, setName] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  async function save(id = "") {
    const value = (
      id ? (edits[id] ?? categories.find((c) => c.id === id)?.name ?? "") : name
    ).trim();
    if (!value || [...value].length > 24) {
      setError("分类名称须为 1–24 字。");
      return;
    }
    await mutate(async () => {
      await auth.run<{ category?: Category }>((options) =>
        id
          ? api.updateCategory({ id, name: value }, options)
          : api.createCategory({ name: value }, options),
      );
      if (!id) setName("");
      setEdits((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
    });
  }
  async function mutate(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await onChanged();
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
          if (!open && !busy) onClose();
        }}
      >
        <DialogContent>
          <div className="modal-header">
            <DialogTitle>管理分类</DialogTitle>
          </div>
          <DialogDescription className="modal-subtitle">
            按名称排序。有关联卡片的分类，需要先移出卡片才能删除。
          </DialogDescription>
          <form
            className="category-add-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input
              aria-label="新分类名称"
              placeholder="新分类名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
            />
            <Button type="submit" disabled={busy || !auth.user?.isAdmin}>
              <Plus />
              添加
            </Button>
          </form>
          <div className="category-manager-list">
            {categories.map((c) => (
              <div key={c.id} className="category-manager-row">
                <Input
                  aria-label={`分类名称：${c.name}`}
                  value={edits[c.id] ?? c.name}
                  maxLength={24}
                  onChange={(e) =>
                    setEdits({ ...edits, [c.id]: e.target.value })
                  }
                />
                <span className="category-usage">{c.cardCount} 张卡片</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`保存分类：${c.name}`}
                  disabled={
                    busy ||
                    !auth.user?.isAdmin ||
                    (edits[c.id] ?? c.name).trim() === c.name
                  }
                  onClick={() => void save(c.id)}
                >
                  <Save />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`删除分类：${c.name}`}
                  title={c.cardCount ? "请先移出全部关联卡片" : "删除分类"}
                  disabled={busy || !auth.user?.isAdmin}
                  onClick={() => {
                    if (c.cardCount)
                      setError(
                        `“${c.name}”仍有 ${c.cardCount} 张关联卡片，请先调整这些卡片的分类。`,
                      );
                    else {
                      setError("");
                      setDeleting(c);
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {!categories.length && (
            <p className="field-hint">添加第一个分类后，就可以创建卡片了。</p>
          )}
          {!auth.user?.isAdmin && (
            <Button variant="outline" onClick={() => void auth.login()}>
              重新登录
            </Button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent className="confirm-dialog">
          <DialogTitle>删除分类？</DialogTitle>
          <DialogDescription>
            确定删除“{deleting?.name}”？此操作无法撤销。
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
              disabled={busy}
              onClick={() =>
                void mutate(async () => {
                  if (deleting)
                    await auth.run((options) =>
                      api.deleteCategory({ id: deleting.id }, options),
                    );
                  setDeleting(null);
                })
              }
            >
              {busy ? "删除中…" : "确认删除"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
