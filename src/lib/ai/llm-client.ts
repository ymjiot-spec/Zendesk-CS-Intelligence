/**
 * LLM client interface for AI analysis.
 * Abstracted behind an interface so it can be mocked in tests.
 */
export interface LLMClient {
  analyze(prompt: string, timeoutMs?: number): Promise<string>;
}
