import { runAgent } from "../orchestrator";
import { communicationAgentOutputSchema, CommunicationAgentOutput } from "../schemas";

export interface CommunicationAgentInput {
  patientName: string;
  purpose: string;
}

export async function runCommunicationAgent(input: CommunicationAgentInput) {
  return runAgent<CommunicationAgentOutput>({
    task: "communication_draft",
    instructions:
      "Draft a short, warm, professional patient-facing message for the purpose described in DATA. Never include clinical advice or diagnosis. Respond as JSON: { subject: string, body: string, channel: 'SMS'|'EMAIL'|'PORTAL_MESSAGE' }. The body must end with the literal line: [AI-generated draft — requires review before sending.]",
    data: { patientName: input.patientName, purpose: input.purpose },
    schema: communicationAgentOutputSchema,
    fallback: {
      subject: `Regarding your care: ${input.purpose}`,
      body: `Hello ${input.patientName},\n\nThis is a message from your care team regarding: ${input.purpose}.\n\n[AI-generated draft — requires review before sending.]`,
      channel: "PORTAL_MESSAGE",
    },
  });
}
