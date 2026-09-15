import MDEditor, { commands } from "@uiw/react-md-editor/nohighlight";
import "@uiw/react-md-editor/markdown-editor.css";
import { Markdown } from "./Markdown";
const command = (item: typeof commands.bold, label: string) => ({
  ...item,
  buttonProps: { ...item.buttonProps, "aria-label": label, title: label },
});
const toolbar = [
  command(commands.bold, "加粗"),
  command(commands.italic, "斜体"),
  command(commands.title, "标题"),
  commands.divider,
  command(commands.unorderedListCommand, "无序列表"),
  command(commands.orderedListCommand, "有序列表"),
  commands.divider,
  command(commands.link, "链接"),
  command(commands.code, "行内代码"),
  command(commands.codeBlock, "代码块"),
];
export default function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <MDEditor
      value={value}
      onChange={(v) => onChange(v ?? "")}
      commands={toolbar}
      extraCommands={[]}
      preview="live"
      height={300}
      visibleDragbar={false}
      textareaProps={{
        id: "card-description",
        "aria-label": "Markdown 描述",
        maxLength: 50000,
        placeholder: "用 Markdown 写下用途、使用方式或注意事项…",
      }}
      components={{ preview: (source) => <Markdown value={source} /> }}
    />
  );
}
