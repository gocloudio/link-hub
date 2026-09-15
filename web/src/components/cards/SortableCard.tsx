import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight,
  GripVertical,
  LockKeyhole,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import type { Card, Category } from "@/gen/linkhub/v1/linkhub_pb";
import { domain } from "@/lib/markdown";

export type SortableCardProps = {
  card: Card;
  categories: Category[];
  favorites: string[];
  disabled: boolean;
  onFavorite: (card: Card) => void;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  onDetails: (card: Card) => void;
};

export function SortableCard({ card, ...props }: SortableCardProps) {
  const favorite = props.favorites.includes(card.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    disabled: props.disabled,
    data: { favorite },
  });
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        // The active card must follow the pointer without CSS interpolation.
        transition: isDragging ? "none" : transition,
      }}
      className={`tool-card sortable-card ${card.canEdit ? "admin-card" : ""} ${isDragging ? "dragging" : ""}`}
    >
      <div className="card-head">
        <span className="tool-logo" aria-hidden="true">
          {[...card.name][0]?.toUpperCase()}
        </span>
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
        <div className="card-controls">
          <button
            type="button"
            className={`icon-button favorite-button ${favorite ? "is-favorite" : ""}`}
            aria-label={`${favorite ? "取消收藏" : "收藏"}：${card.name}`}
            aria-pressed={favorite}
            disabled={props.disabled}
            onClick={() => props.onFavorite(card)}
          >
            <Star fill={favorite ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="icon-button drag-handle"
            {...attributes}
            {...listeners}
            aria-label={`拖拽排序：${card.name}`}
            disabled={props.disabled}
          >
            <GripVertical />
          </button>
        </div>
      </div>
      <div className="card-footer">
        <div className="card-tags">
          {card.isPrivate && (
            <span className="tag private-tag">
              <LockKeyhole />
              私有
            </span>
          )}
          {props.categories
            .filter((c) => card.categoryIds.includes(c.id))
            .map((c) => (
              <span className="tag" key={c.id}>
                {c.name}
              </span>
            ))}
        </div>
        <button
          type="button"
          className="details-button"
          aria-label={`查看说明：${card.name}`}
          onClick={() => props.onDetails(card)}
        >
          查看说明
          <ChevronRight />
        </button>
        {card.canEdit && (
          <div className="admin-actions">
            <button
              className="icon-button"
              aria-label={`编辑卡片：${card.name}`}
              onClick={() => props.onEdit(card)}
            >
              <Pencil />
            </button>
            <button
              className="icon-button"
              aria-label={`删除卡片：${card.name}`}
              onClick={() => props.onDelete(card)}
            >
              <Trash2 />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
