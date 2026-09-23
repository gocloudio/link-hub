// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
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
      getCardPreferences: vi.fn(),
      setCardFavorite: vi.fn(),
      saveCardOrder: vi.fn(),
      listMembers: vi.fn(),
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
function mount(admin: boolean | null = false, ready = true) {
  if (admin)
    vi.mocked(api.listCards).mockResolvedValue({
      cards: [{ ...card, canEdit: true }],
    } as never);
  const auth = {
    user:
      admin === null
        ? null
        : create(GetMeResponseSchema, {
            id: "member",
            name: admin ? "测试管理员" : "测试成员",
            isAdmin: admin,
          }),
    ready,
    error: "",
    login: vi.fn(),
    logout: vi.fn(),
    run: vi.fn(async (operation: (options: object) => Promise<unknown>) =>
      operation({ headers: { Authorization: "Bearer test" } }),
    ),
  };
  const result = render(
    <AuthContext.Provider value={auth as React.ContextType<typeof AuthContext>}>
      <App />
    </AuthContext.Provider>,
  );
  return { ...result, auth };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getCardPreferences).mockResolvedValue({
    favoriteCardIds: [],
    orderedCardIds: [],
  } as never);
  vi.mocked(api.setCardFavorite).mockResolvedValue({} as never);
  vi.mocked(api.saveCardOrder).mockResolvedValue({} as never);
  vi.mocked(api.listMembers).mockResolvedValue({
    members: [
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        name: "团队同事",
        username: "colleague@example.com",
      },
    ],
  } as never);
  sessionStorage.clear();
  localStorage.clear();
  vi.mocked(api.listCards).mockResolvedValue({ cards: [card] } as never);
  vi.mocked(api.listCategories).mockResolvedValue({
    categories: [first, second],
  } as never);
});
afterEach(cleanup);
describe("团队导航", () => {
  it("未登录不展示或请求团队数据，可发起 Microsoft 登录", async () => {
    const { auth } = mount(null);
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "工具分类" })).toBeNull();
    expect(api.listCards).not.toHaveBeenCalled();
    expect(api.listCategories).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "使用 Microsoft 登录" }),
    );
    expect(auth.login).toHaveBeenCalledOnce();
  });
  it("身份初始化完成之前不加载数据", () => {
    mount(false, false);
    expect(screen.getByRole("status").textContent).toContain(
      "正在验证登录状态",
    );
    expect(api.listCards).not.toHaveBeenCalled();
    expect(api.listCategories).not.toHaveBeenCalled();
  });
  it("会话失效后移除卡片与编辑抽屉，迟到的请求不能恢复内容", async () => {
    const { auth, rerender } = mount(true);
    await screen.findByRole("article");
    await userEvent.click(
      screen.getByRole("button", { name: "编辑卡片：示例系统" }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    let complete!: (result: never) => void;
    vi.mocked(api.listCards).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    rerender(
      <AuthContext.Provider
        value={{ ...auth, user: null } as React.ContextType<typeof AuthContext>}
      >
        <App />
      </AuthContext.Provider>,
    );
    await act(async () => {
      complete({ cards: [card] } as never);
    });
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("示例系统")).toBeNull();
    expect(
      screen.getByRole("button", { name: "使用 Microsoft 登录" }),
    ).toBeTruthy();
  });
  it("普通用户可筛选、打开卡片及查看说明，不能编辑公开卡片", async () => {
    const user = userEvent.setup();
    mount();
    const link = await screen.findByRole("link", {
      name: "示例系统（新标签页打开）",
    });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "管理分类" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "编辑卡片：示例系统" }),
    ).toBeNull();
    expect(api.listCards).toHaveBeenCalledWith(
      {},
      { headers: { Authorization: "Bearer test" } },
    );
    expect(api.listCategories).toHaveBeenCalledWith(
      {},
      { headers: { Authorization: "Bearer test" } },
    );
    await user.click(screen.getByRole("button", { name: /开发工具/ }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /运营系统/ }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(document.querySelector(".card-description")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "查看说明：示例系统" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      await within(dialog).findByRole("heading", { name: "使用指南" }),
    ).toBeTruthy();
    expect(within(dialog).getByText("团队协作").tagName).toBe("STRONG");
    expect(
      within(dialog)
        .getByRole("link", { name: "打开工具" })
        .getAttribute("target"),
    ).toBe("_blank");
    await user.click(within(dialog).getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("收藏置顶并保存个人偏好，失败时恢复原状态", async () => {
    const newer = {
      ...card,
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      name: "另一个系统",
      createdAt: { seconds: 500n, nanos: 0 },
    };
    vi.mocked(api.listCards).mockResolvedValue({
      cards: [newer, card],
    } as never);
    mount();
    await screen.findByRole("link", { name: "示例系统（新标签页打开）" });
    expect(
      within(screen.getAllByRole("article")[0]).getByRole("heading")
        .textContent,
    ).toBe("另一个系统");
    await userEvent.click(
      screen.getByRole("button", { name: "收藏：示例系统" }),
    );
    await waitFor(() =>
      expect(api.setCardFavorite).toHaveBeenCalledWith(
        { cardId: card.id, favorite: true },
        expect.anything(),
      ),
    );
    expect(
      within(screen.getAllByRole("article")[0]).getByRole("heading")
        .textContent,
    ).toBe("示例系统");
    vi.mocked(api.setCardFavorite).mockRejectedValueOnce(new Error("保存失败"));
    await userEvent.click(
      screen.getByRole("button", { name: "取消收藏：示例系统" }),
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "取消收藏：示例系统" })
          .getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    expect(
      within(screen.getAllByRole("article")[0]).getByRole("heading")
        .textContent,
    ).toBe("示例系统");
  });
  it("普通用户可以创建并分享私有卡片，也可以选择内部公开", async () => {
    vi.mocked(api.createCard).mockResolvedValue({
      card: { ...card, name: "个人工具", isPrivate: true, canEdit: true },
    } as never);
    mount();
    await screen.findByRole("article");
    await userEvent.click(screen.getByRole("button", { name: "添加卡片" }));
    expect(screen.getByRole("radio", { name: "私有" })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByRole("radio", { name: "内部公开" })).toHaveProperty(
      "disabled",
      false,
    );
    await userEvent.type(screen.getByLabelText(/^名称/), "个人工具");
    await userEvent.type(
      screen.getByRole("textbox", { name: /^链接/ }),
      "https://private.example.com",
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "开发工具" }));
    await userEvent.click(
      await screen.findByRole("checkbox", { name: /团队同事/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "保存卡片" }));
    await waitFor(() =>
      expect(api.createCard).toHaveBeenCalledWith(
        {
          card: expect.objectContaining({
            isPrivate: true,
            sharedUserIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
          }),
        },
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "添加卡片" }));
    await userEvent.click(screen.getByRole("radio", { name: "内部公开" }));
    expect(screen.queryByRole("checkbox", { name: /团队同事/ })).toBeNull();
    await userEvent.type(screen.getByLabelText(/^名称/), "团队工具");
    await userEvent.type(
      screen.getByRole("textbox", { name: /^链接/ }),
      "https://team.example.com",
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "开发工具" }));
    await userEvent.click(screen.getByRole("button", { name: "保存卡片" }));
    await waitFor(() =>
      expect(api.createCard).toHaveBeenLastCalledWith(
        {
          card: expect.objectContaining({
            name: "团队工具",
            isPrivate: false,
            sharedUserIds: [],
          }),
        },
        expect.anything(),
      ),
    );
  });
  it("只对本人可维护的私有卡片显示编辑入口，管理员可维护他人私有卡片", async () => {
    const own = { ...card, isPrivate: true, canEdit: true, ownerId: "member" };
    const shared = {
      ...card,
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      name: "分享工具",
      isPrivate: true,
      canEdit: false,
    };
    vi.mocked(api.listCards).mockResolvedValue({
      cards: [own, shared],
    } as never);
    mount();
    expect(
      await screen.findByRole("button", { name: "编辑卡片：示例系统" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "编辑卡片：分享工具" }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "编辑卡片：示例系统" }),
    );
    expect(screen.getByRole("button", { name: "保存卡片" })).toHaveProperty(
      "disabled",
      false,
    );
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
    await user.type(
      screen.getByRole("textbox", { name: /^链接/ }),
      "https://example.org",
    );
    await user.click(screen.getByRole("button", { name: "保存卡片" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "请至少选择一个分类。",
    );
    expect(api.createCard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: "开发工具" }));
    const source = await screen.findByRole(
      "textbox",
      {
        name: "Markdown 描述",
      },
      { timeout: 5000 },
    );
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
            isPrivate: false,
            sharedUserIds: [],
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
