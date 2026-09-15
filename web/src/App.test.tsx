// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { create } from "@bufbuild/protobuf";
import {
  CardSchema,
  CategorySchema,
  GetMeResponseSchema,
} from "./gen/linkhub/v1/linkhub_pb";
import App from "./App";
import { AuthContext } from "./auth/AuthProvider";
import { api } from "./lib/api";
import { Markdown } from "./components/Markdown";
import { excerpt, validURL } from "./lib/markdown";
vi.mock("./lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("./lib/api")>();
  return {
    ...original,
    api: {
      listCards: vi.fn(),
      listCategories: vi.fn(),
      createCard: vi.fn(),
      updateCard: vi.fn(),
      deleteCard: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
    },
  };
});
const first = create(CategorySchema, {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "开发工具",
  cardCount: 1,
});
const second = create(CategorySchema, {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "运营系统",
  cardCount: 1,
});
const card = create(CardSchema, {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "示例系统",
  url: "https://example.com",
  descriptionMarkdown:
    "# 使用指南\n\n**团队协作**入口。\n\n- 选择项目\n- 开始使用",
  categoryIds: [first.id, second.id],
  createdAt: { seconds: 100n },
  updatedAt: { seconds: 200n },
});
function mount(admin = false) {
  const auth = {
    user: admin
      ? create(GetMeResponseSchema, { name: "测试管理员", isAdmin: true })
      : null,
    ready: true,
    error: "",
    login: vi.fn(),
    logout: vi.fn(),
    run: vi.fn(async (operation: (options: object) => Promise<unknown>) =>
      operation({ headers: { Authorization: "Bearer test" } }),
    ),
  };
  return render(
    <AuthContext.Provider value={auth as React.ContextType<typeof AuthContext>}>
      <App />
    </AuthContext.Provider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  vi.mocked(api.listCards).mockResolvedValue({ cards: [card] } as never);
  vi.mocked(api.listCategories).mockResolvedValue({
    categories: [first, second],
  } as never);
});
afterEach(cleanup);
describe("团队导航", () => {
  it("匿名浏览去重、多分类筛选、卡片新标签页与独立说明", async () => {
    const user = userEvent.setup();
    mount();
    const link = await screen.findByRole("link", {
      name: "示例系统（新标签页打开）",
    });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "添加卡片" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /开发工具/ }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /运营系统/ }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "查看说明：示例系统" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      await within(dialog).findByRole("heading", { name: "使用指南" }),
    ).toBeTruthy();
    expect(
      within(dialog)
        .getByRole("link", { name: "打开工具" })
        .getAttribute("target"),
    ).toBe("_blank");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("管理员创建必须有分类，填写 Markdown 并保存到接口", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createCard).mockResolvedValue({
      card: { ...card, name: "新工具" },
    } as never);
    mount(true);
    await screen.findByRole("article");
    await user.click(screen.getByRole("button", { name: "添加卡片" }));
    await user.type(screen.getByLabelText(/名称/), "新工具");
    await user.type(screen.getByLabelText(/^链接/), "https://example.org");
    await user.click(screen.getByRole("button", { name: "保存卡片" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "请至少选择一个分类。",
    );
    expect(api.createCard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: "开发工具" }));
    const source = await screen.findByRole("textbox", {
      name: "Markdown 描述",
    });
    await user.type(source, "**说明正文**");
    await user.click(screen.getByRole("button", { name: "保存卡片" }));
    await waitFor(() =>
      expect(api.createCard).toHaveBeenCalledWith(
        {
          card: {
            name: "新工具",
            url: "https://example.org",
            descriptionMarkdown: "**说明正文**",
            categoryIds: [first.id],
          },
        },
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sessionStorage.getItem("link-hub-card-draft")).toBeNull();
  });
  it("禁止删除有关联卡片的分类，重命名使用真实接口", async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateCategory).mockResolvedValue({
      category: first,
    } as never);
    mount(true);
    await screen.findByRole("article");
    await user.click(screen.getByRole("button", { name: "管理分类" }));
    await user.click(
      screen.getByRole("button", { name: "删除分类：开发工具" }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "仍有 1 张关联卡片",
    );
    expect(api.deleteCategory).not.toHaveBeenCalled();
    const name = screen.getByLabelText("分类名称：开发工具");
    await user.clear(name);
    await user.type(name, "研发工具");
    await user.click(
      screen.getByRole("button", { name: "保存分类：开发工具" }),
    );
    await waitFor(() =>
      expect(api.updateCategory).toHaveBeenCalledWith(
        { id: first.id, name: "研发工具" },
        expect.anything(),
      ),
    );
  });
  it("编辑失败时保留抽屉与草稿，带上版本避免覆盖他人修改", async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateCard).mockRejectedValue(
      new Error("卡片已被其他管理员修改"),
    );
    mount(true);
    await screen.findByRole("article");
    await user.click(
      screen.getByRole("button", { name: "编辑卡片：示例系统" }),
    );
    await user.type(screen.getByLabelText(/名称/), "新版");
    await user.click(screen.getByRole("button", { name: "保存卡片" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "其他管理员",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      JSON.parse(sessionStorage.getItem("link-hub-card-draft")!).name,
    ).toBe("示例系统新版");
    expect(api.updateCard).toHaveBeenCalledWith(
      expect.objectContaining({
        id: card.id,
        expectedUpdatedAt: { seconds: 200n, nanos: 0 },
      }),
      expect.anything(),
    );
  });
  it("卡片删除需确认后调用接口", async () => {
    const user = userEvent.setup();
    vi.mocked(api.deleteCard).mockResolvedValue({} as never);
    mount(true);
    await screen.findByRole("article");
    await user.click(
      screen.getByRole("button", { name: "删除卡片：示例系统" }),
    );
    expect(api.deleteCard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() =>
      expect(api.deleteCard).toHaveBeenCalledWith(
        { id: card.id },
        expect.anything(),
      ),
    );
  });
});
describe("Markdown 与链接", () => {
  it("过滤图片、HTML 与不安全链接，保留文字列表代码", () => {
    const { container } = render(
      <Markdown
        value={
          "# 标题\n\n<script>alert(1)</script>\n\n![图片](https://example.com/a.png)\n\n[危险](javascript:alert(1))\n\n- 列表\n\n```js\nconst a = 1\n```"
        }
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(
      container.querySelector("a")?.getAttribute("href") ?? "",
    ).not.toMatch(/^javascript:/);
    expect(container.querySelector("li")?.textContent).toBe("列表");
    expect(container.querySelector("pre")?.textContent).toContain(
      "const a = 1",
    );
  });
  it("生成纯文本摘要并限制跳转协议", () => {
    expect(
      excerpt(
        "# 标题\n\n**正文** [链接](https://example.com) ![无图片](https://example.com/a)",
      ),
    ).toBe("正文 链接");
    for (const link of [
      "javascript:alert(1)",
      "data:text/html,a",
      "https://user:pass@example.com",
      "/relative",
    ])
      expect(validURL(link)).toBe(false);
    expect(validURL("https://example.com/docs")).toBe(true);
  });
});
