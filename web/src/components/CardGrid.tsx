import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, LockKeyhole, Pencil, Star, Trash2 } from "lucide-react";
import type { Card, Category } from "@/gen/linkhub/v1/linkhub_pb";
import { domain } from "@/lib/markdown";

type Props = {
  cards: Card[];
  categories: Category[];
  favorites: string[];
  admin: boolean;
  disabled: boolean;
  onFavorite: (card: Card) => void;
  onReorder: (active: string, over: string) => void;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
};

function SortableCard({
  card,
  ...props
}: Omit<Props, "cards" | "onReorder"> & { card: Card }) {
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

export function CardGrid(props: Props) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const name = (id: string | number) =>
    props.cards.find((c) => c.id === id)?.name ?? "卡片";
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) =>
        closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (container) =>
              container.data.current?.favorite ===
              args.active.data.current?.favorite,
          ),
        })
      }
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "按空格键开始排序，方向键移动，再按空格键保存，Escape 取消。收藏卡片始终置顶，可在相同收藏状态的卡片之间排序。",
        },
        announcements: {
          onDragStart: ({ active }) => `开始移动${name(active.id)}`,
          onDragOver: ({ active, over }) =>
            over
              ? `${name(active.id)}移动到${name(over.id)}的位置`
              : "未选择位置",
          onDragEnd: ({ active }) => `${name(active.id)}拖拽结束`,
          onDragCancel: () => "已取消排序",
        },
      }}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id)
          props.onReorder(String(active.id), String(over.id));
      }}
    >
      <SortableContext
        items={props.cards.map((c) => c.id)}
        strategy={rectSortingStrategy}
      >
        <div className="card-grid">
          {props.cards.map((card) => (
            <SortableCard key={card.id} card={card} {...props} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
