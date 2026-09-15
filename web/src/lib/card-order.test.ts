import { describe, it, expect } from "vitest";
import { create } from "@bufbuild/protobuf";
import { CardSchema } from "@/gen/linkhub/v1/linkhub_pb";
import { sortCards, moveVisibleCards } from "./card-order";
const cards = [1, 2, 3, 4].map((i) =>
  create(CardSchema, { id: String(i), createdAt: { seconds: BigInt(i) } }),
);
describe("个人卡片顺序", () => {
  it("默认按创建时间倒序，收藏始终排在手动排序前", () => {
    expect(sortCards(cards, [], []).map((c) => c.id)).toEqual([
      "4",
      "3",
      "2",
      "1",
    ]);
    expect(
      sortCards(cards, ["1"], ["3", "2", "4", "1"]).map((c) => c.id),
    ).toEqual(["1", "3", "2", "4"]);
    expect(sortCards(cards, [], ["2", "1"]).map((c) => c.id)).toEqual([
      "2",
      "1",
      "4",
      "3",
    ]);
  });
  it("分类筛选拖拽保留隐藏卡片的位置", () => {
    expect(
      moveVisibleCards(["1", "2", "3", "4"], ["1", "3"], "3", "1"),
    ).toEqual(["3", "2", "1", "4"]);
    expect(moveVisibleCards(["1", "2"], ["1"], "2", "1")).toEqual(["1", "2"]);
  });
});
