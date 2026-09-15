import {
  Folder,
  Grid2X2,
  LayoutGrid,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Category } from "@/gen/linkhub/v1/linkhub_pb";

type Props = {
  categories: Category[];
  cardCount: number;
  selected: string;
  admin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  onManageCategories: () => void;
};
export function WorkspaceSidebar({
  categories,
  cardCount,
  selected,
  admin,
  open,
  onOpenChange,
  onSelect,
  onManageCategories,
}: Props) {
  const nav = (
    <>
      <a className="brand" href="/" aria-label="团队导航首页">
        <span className="brand-mark">
          <Grid2X2 />
        </span>
        <span>
          <strong>团队导航</strong>
          <small>LINK HUB / WORKSPACE</small>
        </span>
      </a>
      <div className="sidebar-section-label">
        <span>工作空间</span>
        <i className="tiny-dot" />
      </div>
      <nav aria-label="工具分类">
        <button
          className={`nav-item ${!selected ? "active" : ""}`}
          aria-current={!selected ? "page" : undefined}
          onClick={() => onSelect("")}
        >
          <LayoutGrid />
          全部工具<span className="nav-count">{cardCount}</span>
        </button>
        <div className="nav-separator" />
        <p className="nav-caption">按分类浏览</p>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`nav-item ${selected === c.id ? "active" : ""}`}
            aria-current={selected === c.id ? "page" : undefined}
            onClick={() => onSelect(c.id)}
          >
            <Folder />
            <span className="nav-name">{c.name}</span>
            <span className="nav-count">{c.cardCount}</span>
          </button>
        ))}
      </nav>
      {admin && (
        <button className="manage-categories" onClick={onManageCategories}>
          <Settings2 />
          管理分类
        </button>
      )}
      <div className="sidebar-bottom">
        <div className="workspace-note">
          <span>
            <Users />
          </span>
          <div>
            <strong>让好用的工具，被团队看见</strong>
            <p>常用入口，触手可及。</p>
          </div>
        </div>
        <div className="sidebar-footer">
          <ShieldCheck />
          <span>团队共享工作空间</span>
        </div>
      </div>
    </>
  );
  return (
    <>
      <aside className="sidebar desktop-sidebar">{nav}</aside>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="mobile-navigation"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">工具分类</DialogTitle>
          <div className="sidebar open">{nav}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
