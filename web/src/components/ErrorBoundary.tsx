import { Component, type ReactNode } from "react";
import { Button } from "./ui/button";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main>
        <div className="empty-state" role="alert">
          <h1>页面暂时无法显示</h1>
          <p>请重新加载页面后再试。当前标签页已保存的编辑草稿会保留。</p>
          <Button onClick={() => window.location.reload()}>重新加载</Button>
        </div>
      </main>
    ) : (
      this.props.children
    );
  }
}
