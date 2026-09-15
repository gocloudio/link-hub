import { unified } from "unified";
import remarkParse from "remark-parse";
import { toString } from "mdast-util-to-string";
const parser = unified().use(remarkParse);
export function excerpt(markdown: string): string {
  const tree = parser.parse(markdown);
  const paragraph = tree.children.find((node) => node.type === "paragraph");
  return toString(paragraph ?? tree, {
    includeImageAlt: false,
    includeHtml: false,
  })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}
export function validURL(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      new TextEncoder().encode(value).length <= 2048
    );
  } catch {
    return false;
  }
}
export function domain(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}
