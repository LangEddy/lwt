import init, {
  tokenize as wasmTokenize,
} from "../wasm/tokenizer/lwt_tokenizer.js";

export interface Token {
  type: "word" | "separator";
  value: string;
  index: number;
}

let initialized = false;

export async function initTokenizer(): Promise<void> {
  if (initialized) return;
  await init();
  initialized = true;
}

export function tokenize(text: string): Token[] {
  return wasmTokenize(text) as Token[];
}

export function normalizeWord(word: string): string {
  return word.toLowerCase().normalize("NFC");
}

export function tokensToText(
  tokens: Token[],
  start: number,
  end: number,
): string {
  return tokens
    .slice(start, end + 1)
    .map((t) => t.value)
    .join("");
}
