import {
  isTerminalJourneyState,
  isValidJourneyTransition,
  JourneyState,
  JOURNEY_TRANSITIONS,
} from "./types";
import { InvalidTransitionError } from "./errors";

export interface TransitionResult {
  from: JourneyState;
  to: JourneyState;
}

/**
 * Validates a care journey state transition. Throws InvalidTransitionError
 * for terminal-state mutation, out-of-order transitions, or duplicate
 * (no-op) transitions — callers must not silently accept any of these.
 */
export function validateJourneyTransition(
  from: JourneyState,
  to: JourneyState
): TransitionResult {
  if (isTerminalJourneyState(from)) {
    throw new InvalidTransitionError(
      `Cannot transition a ${from.toLowerCase()} journey to ${to}. Terminal states are final.`
    );
  }

  if (from === to) {
    throw new InvalidTransitionError(
      `Journey is already in state ${to}. Duplicate transitions are rejected.`
    );
  }

  if (!isValidJourneyTransition(from, to)) {
    throw new InvalidTransitionError(
      `Cannot transition journey from ${from} to ${to}. Valid transitions from ${from}: ${
        JOURNEY_TRANSITIONS[from]?.join(", ") || "(none — terminal state)"
      }.`
    );
  }

  return { from, to };
}
