import { runAgent } from "../orchestrator";
import { timelineAgentOutputSchema, TimelineAgentOutput } from "../schemas";

export interface TimelineAgentInput {
  events: { title: string; type: string; status: string; occurredAt: string }[];
}

export async function runTimelineAgent(input: TimelineAgentInput) {
  return runAgent<TimelineAgentOutput>({
    task: "timeline_summary",
    instructions:
      "Summarize this patient's care timeline in 2-3 sentences, grounded only in the events listed in DATA. Then list up to 10 key events as short strings. Respond as JSON: { summary: string, keyEvents: string[] }.",
    data: { events: input.events },
    schema: timelineAgentOutputSchema,
    fallback: {
      summary: "Timeline summary is unavailable right now.",
      keyEvents: input.events.slice(0, 10).map((e) => `${e.occurredAt}: ${e.title}`),
    },
  });
}
