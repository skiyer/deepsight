import { EXPLAIN_PROMPT, AUDIT_PROMPT } from "./prompts.js";
import { createClaudeQuery, type AgentMessage } from "./llm/claude.js";

export interface AnalyzeParams {
  file: string;
  line: number;
  lineText: string;
  mode: "explain" | "audit";
  cwd: string;
}

const SYSTEM_PROMPTS = {
  explain: EXPLAIN_PROMPT,
  audit: AUDIT_PROMPT,
} as const;

const MODE_INSTRUCTIONS = {
  explain: "请解释这段代码的功能和数据流。",
  audit: "请对这段代码进行安全审计。",
} as const;

const isAbortError = (error: unknown, abortController?: AbortController): boolean => {
  if (abortController?.signal.aborted) return true;
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || /aborted/i.test(error.message);
};

function buildUserPrompt(params: {
  file: string;
  line: number;
  focusLine: string;
  mode: AnalyzeParams["mode"];
}): string {
  return `请分析以下代码（文件：${params.file}，焦点行：${params.line}）：

\`\`\`
${params.focusLine}
\`\`\`

${MODE_INSTRUCTIONS[params.mode]}`;
}

export async function* analyze(
  params: AnalyzeParams,
  options?: { abortController?: AbortController }
): AsyncGenerator<AgentMessage> {
  const { cwd, file } = params;

  const systemPrompt = SYSTEM_PROMPTS[params.mode];

  const focusLineCode = params.lineText.trim() || "[无法获取焦点行代码]";

  const userPrompt = buildUserPrompt({
    file,
    line: params.line,
    focusLine: focusLineCode,
    mode: params.mode,
  });

  try {
    const q = createClaudeQuery({
      prompt: userPrompt,
      cwd,
      systemPrompt,
      abortController: options?.abortController,
    });

    for await (const msg of q) {
      yield msg;
    }
  } catch (error) {
    if (isAbortError(error, options?.abortController)) {
      return;
    }
    console.error("[analyze] Error during query:", error);
    throw error;
  }
}
