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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type { Card } from "@/gen/linkhub/v1/linkhub_pb";
import { SortableCard, type SortableCardProps } from "./cards/SortableCard";

type Props = Omit<SortableCardProps, "card"> & {
  cards: Card[];
  admin: boolean;
  onReorder: (active: string, over: string) => void;
};

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
