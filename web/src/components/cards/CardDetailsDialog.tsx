import { lazy, Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Card, Category } from "@/gen/linkhub/v1/linkhub_pb";
import { domain } from "@/lib/markdown";
const Markdown = lazy(() =>
  import("@/components/Markdown").then((module) => ({
    default: module.Markdown,
  })),
);

export function CardDetailsDialog({
  card,
  categories,
  onClose,
}: {
  card?: Card;
  categories: Category[];
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!card}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="description-dialog"
        aria-describedby={undefined}
      >
        {card && (
          <>
            <header className="modal-header">
              <div className="modal-title-group">
                <span className="tool-logo" aria-hidden="true">
                  {[...card.name][0]?.toUpperCase()}
                </span>
                <div>
                  <div className="modal-eyebrow">工具说明</div>
                  <DialogTitle>{card.name}</DialogTitle>
                </div>
              </div>
            </header>
            <div className="description-meta">
              {categories
                .filter((category) => card.categoryIds.includes(category.id))
                .map((category) => (
                  <span className="tag" key={category.id}>
                    {category.name}
                  </span>
                ))}
            </div>
            <Suspense fallback={<p className="field-hint">正在加载说明…</p>}>
              <Markdown value={card.descriptionMarkdown} />
            </Suspense>
            <footer className="modal-footer">
              <span className="domain-label">{domain(card.url)}</span>
              <Button asChild>
                <a href={card.url} target="_blank" rel="noopener noreferrer">
                  打开工具
                  <ArrowUpRight />
                </a>
              </Button>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
