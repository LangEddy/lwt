import DOMPurify from "dompurify";
import { marked } from "marked";
import { tokenize, type Token } from "./tokenizer";
import type { TextContentType } from "../types";

export interface TextChunkNode {
  kind: "text";
  startIndex: number;
  endIndex: number;
}

export interface ElementNode {
  kind: "element";
  tag: string;
  attrs: Record<string, string>;
  children: RichNode[];
}

export type RichNode = TextChunkNode | ElementNode;

export interface ParsedContent {
  tokens: Token[];
  tree: RichNode[];
}

const ALLOWED_ATTRS = new Set([
  "href",
  "title",
  "alt",
  "src",
  "class",
  "id",
  "lang",
  "dir",
  "start",
  "type",
  "colspan",
  "rowspan",
]);

export function parseContent(
  content: string,
  type: TextContentType,
): ParsedContent {
  if (type === "plain") {
    const tokens = tokenize(content);
    if (tokens.length === 0) return { tokens, tree: [] };
    return {
      tokens,
      tree: [{ kind: "text", startIndex: 0, endIndex: tokens.length }],
    };
  }

  const rawHtml =
    type === "markdown"
      ? (marked.parse(content, { async: false }) as string)
      : content;

  const sanitized = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "iframe", "form", "input", "button", "object"],
  });

  const doc = new DOMParser().parseFromString(
    `<div id="__lwt_root">${sanitized}</div>`,
    "text/html",
  );
  const root = doc.getElementById("__lwt_root");
  if (!root) return { tokens: [], tree: [] };

  const tokens: Token[] = [];

  const walk = (node: Node): RichNode[] => {
    const out: RichNode[] = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const value = child.nodeValue ?? "";
        if (!value) return;
        const start = tokens.length;
        const local = tokenize(value);
        for (const t of local) {
          tokens.push({ ...t, index: tokens.length });
        }
        if (tokens.length > start) {
          out.push({ kind: "text", startIndex: start, endIndex: tokens.length });
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const attrs: Record<string, string> = {};
        for (const a of Array.from(el.attributes)) {
          if (ALLOWED_ATTRS.has(a.name)) attrs[a.name] = a.value;
        }
        out.push({
          kind: "element",
          tag: el.tagName.toLowerCase(),
          attrs,
          children: walk(el),
        });
      }
    });
    return out;
  };

  return { tokens, tree: walk(root) };
}

export function stripFormatting(value: string): string {
  if (!value) return "";
  const sanitized = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
  const doc = new DOMParser().parseFromString(sanitized, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function contentToPlainText(
  content: string,
  type: TextContentType,
): string {
  if (!content) return "";
  if (type === "plain") return content;
  const html =
    type === "markdown"
      ? (marked.parse(content, { async: false }) as string)
      : content;
  return stripFormatting(html);
}
