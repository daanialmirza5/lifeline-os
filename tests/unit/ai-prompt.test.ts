import { describe, it, expect } from "vitest";
import { z } from "zod";
import { buildStructuredPrompt, parseStructuredPrompt, safeParseJson } from "@/ai/prompt";

const schema = z.object({ summary: z.string(), count: z.number() });

describe("ai/prompt: buildStructuredPrompt + parseStructuredPrompt round-trip", () => {
  it("round-trips task name and data through the prompt envelope", () => {
    const { prompt } = buildStructuredPrompt({
      task: "timeline_summary",
      instructions: "Summarize.",
      data: { events: [{ title: "Consult" }] },
    });
    const parsed = parseStructuredPrompt(prompt);
    expect(parsed.task).toBe("timeline_summary");
    expect(parsed.data).toEqual({ events: [{ title: "Consult" }] });
  });
});

describe("ai/prompt: safeParseJson (LLM output validation)", () => {
  it("accepts well-formed JSON matching the schema", () => {
    const result = safeParseJson('{"summary": "ok", "count": 3}', schema);
    expect(result).toEqual({ summary: "ok", count: 3 });
  });

  it("strips markdown code fences before parsing", () => {
    const result = safeParseJson('```json\n{"summary": "ok", "count": 1}\n```', schema);
    expect(result).toEqual({ summary: "ok", count: 1 });
  });

  it("returns null for malformed JSON instead of throwing", () => {
    expect(() => safeParseJson("{not valid json", schema)).not.toThrow();
    expect(safeParseJson("{not valid json", schema)).toBeNull();
  });

  it("returns null when JSON is well-formed but fails schema validation", () => {
    expect(safeParseJson('{"summary": "ok"}', schema)).toBeNull();
    expect(safeParseJson('{"summary": 5, "count": "not a number"}', schema)).toBeNull();
  });

  it("returns null for a non-object JSON value", () => {
    expect(safeParseJson("[1,2,3]", schema)).toBeNull();
  });

  it("never lets extra prose around the JSON break parsing", () => {
    const withProse = 'Sure, here is the result:\n{"summary": "ok", "count": 2}\nHope this helps!';
    expect(safeParseJson(withProse, schema)).toEqual({ summary: "ok", count: 2 });
  });
});
