import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Card } from "@/gen/linkhub/v1/linkhub_pb";

export function CardDeleteDialog({
  card,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  card: Card | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={!!card && !!card.canEdit}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="confirm-dialog">
        <div className="confirm-icon">
          <Trash2 />
        </div>
        <DialogTitle>删除这张卡片？</DialogTitle>
        <DialogDescription>
          “{card?.name}”将从团队导航中移除，此操作无法撤销。
        </DialogDescription>
        <div className="confirm-actions">
          <Button variant="outline" disabled={busy} onClick={() => onClose()}>
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !card?.canEdit}
            onClick={() => onConfirm()}
          >
            {busy ? "删除中…" : "确认删除"}
          </Button>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
