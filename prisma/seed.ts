// Deterministic synthetic demo data. Every name, MRN, and event here is
// fictional (spec section 28) — this seed must never be pointed at a
// database containing real patient data.
import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { computeAndPersistRisk } from "../src/lib/services/risk";
import {
  generateCoordinationRecommendations,
  generateRiskExplanationRecommendation,
} from "../src/lib/services/recommendations";
import { recordAudit } from "../src/lib/audit";
import { RiskFactor } from "../src/domain/risk-engine";
import type { Session } from "../src/lib/auth";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// Small seeded PRNG (mulberry32) so the "volume" patients are reproducible
// across runs instead of using unseeded Math.random().
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);

const SYSTEM_ACTOR: Session = {
  userId: "system-seed",
  email: "system@lifeline.demo",
  name: "Lifeline Seed",
  role: "ADMIN",
};

async function main() {
  console.log("Seeding Lifeline OS demo data...");

  // ── Users ────────────────────────────────────────────────────────────
  const [, clinician, coordinator, patientUser] = await Promise.all([
    db.user.upsert({
      where: { email: "admin@lifeline.demo" },
      update: {},
      create: {
        email: "admin@lifeline.demo",
        name: "Priya Administrator",
        role: "ADMIN",
        passwordHash: await hashPassword("LifelineDemo!Admin1"),
      },
    }),
    db.user.upsert({
      where: { email: "clinician@lifeline.demo" },
      update: {},
      create: {
        email: "clinician@lifeline.demo",
        name: "Dr. Sam Chen",
        role: "CLINICIAN",
        passwordHash: await hashPassword("LifelineDemo!Clinician1"),
      },
    }),
    db.user.upsert({
      where: { email: "coordinator@lifeline.demo" },
      update: {},
      create: {
        email: "coordinator@lifeline.demo",
        name: "Jordan Coordinator",
        role: "COORDINATOR",
        passwordHash: await hashPassword("LifelineDemo!Coordinator1"),
      },
    }),
    db.user.upsert({
      where: { email: "patient@lifeline.demo" },
      update: {},
      create: {
        email: "patient@lifeline.demo",
        name: "Aarav Sharma",
        role: "PATIENT",
        passwordHash: await hashPassword("LifelineDemo!Patient1"),
      },
    }),
  ]);

  // Also grant the seed-actor id used by service calls a real row, so
  // AuditEvent/AIRecommendation.decidedById foreign keys stay valid.
  await db.user.upsert({
    where: { email: "system@lifeline.demo" },
    update: {},
    create: {
      id: "system-seed",
      email: "system@lifeline.demo",
      name: "Lifeline Seed",
      role: "ADMIN",
      passwordHash: await hashPassword("not-a-real-login"),
    },
  });

  // ── Helper: create a patient + journey with hand-placed events/obligations ──
  async function seedPatient(opts: {
    name: string;
    dobYearsAgo: number;
    journeyTitle: string;
    journeyState: string;
    linkedUserId?: string;
    events: {
      type: string;
      status: string;
      title: string;
      description?: string;
      occurredDaysAgo: number;
    }[];
    obligations?: {
      type: string;
      description: string;
      priority: string;
      status: string;
      createdDaysAgo: number;
      dueInDays: number; // negative = overdue
    }[];
    referrals?: { specialty: string; status: string; createdDaysAgo: number; notes?: string }[];
    appointments?: {
      type: string;
      provider: string;
      status: string;
      scheduledDaysFromNow: number;
      referralIndex?: number;
    }[];
  }) {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - opts.dobYearsAgo);

    const patient = await db.patient.create({
      data: {
        name: opts.name,
        dob,
        mrn: `MRN-${Math.floor(100000 + rng() * 900000)}`,
        userId: opts.linkedUserId,
      },
    });

    const journey = await db.careJourney.create({
      data: { patientId: patient.id, title: opts.journeyTitle, state: opts.journeyState },
    });

    const createdEvents = [];
    for (const e of opts.events) {
      const event = await db.careEvent.create({
        data: {
          patientId: patient.id,
          journeyId: journey.id,
          type: e.type,
          status: e.status,
          title: e.title,
          description: e.description,
          occurredAt: daysAgo(e.occurredDaysAgo),
          createdById: clinician.id,
        },
      });
      createdEvents.push(event);
    }

    const createdObligations = [];
    for (const o of opts.obligations ?? []) {
      const obligation = await db.careObligation.create({
        data: {
          patientId: patient.id,
          journeyId: journey.id,
          sourceEventId: createdEvents[0]?.id ?? (await db.careEvent.findFirstOrThrow({ where: { journeyId: journey.id } })).id,
          type: o.type,
          description: o.description,
          priority: o.priority,
          status: o.status,
          createdAt: daysAgo(o.createdDaysAgo),
          dueAt: o.dueInDays >= 0 ? daysFromNow(o.dueInDays) : daysAgo(-o.dueInDays),
        },
      });
      createdObligations.push(obligation);
    }

    const createdReferrals = [];
    for (const r of opts.referrals ?? []) {
      const referral = await db.referral.create({
        data: {
          patientId: patient.id,
          journeyId: journey.id,
          specialty: r.specialty,
          status: r.status,
          notes: r.notes,
          createdById: clinician.id,
          createdAt: daysAgo(r.createdDaysAgo),
        },
      });
      createdReferrals.push(referral);
    }

    for (const a of opts.appointments ?? []) {
      await db.appointment.create({
        data: {
          patientId: patient.id,
          journeyId: journey.id,
          referralId: a.referralIndex !== undefined ? createdReferrals[a.referralIndex]?.id : null,
          type: a.type,
          provider: a.provider,
          status: a.status,
          scheduledAt: daysFromNow(a.scheduledDaysFromNow),
        },
      });
    }

    await recordAudit({
      actorId: SYSTEM_ACTOR.userId,
      actorRole: "ADMIN",
      action: "SEED_PATIENT",
      entityType: "Patient",
      entityId: patient.id,
      newState: opts.journeyState,
      reason: "Demo data seed",
      requestId: crypto.randomUUID(),
    });

    return { patient, journey, obligations: createdObligations };
  }

  // ── Patient A: healthy / completed pathway ──────────────────────────
  await seedPatient({
    name: "Maria Santos",
    dobYearsAgo: 34,
    journeyTitle: "Annual Wellness Pathway",
    journeyState: "COMPLETED",
    events: [
      { type: "CONSULTATION", status: "COMPLETED", title: "Annual wellness consultation", occurredDaysAgo: 30 },
      { type: "LAB_ORDER", status: "COMPLETED", title: "Routine bloodwork ordered", occurredDaysAgo: 29 },
      { type: "LAB_RESULT", status: "COMPLETED", title: "Bloodwork results: normal", occurredDaysAgo: 24 },
      { type: "CARE_PLAN", status: "COMPLETED", title: "No further action needed", occurredDaysAgo: 23 },
    ],
  });

  // ── Patient B: overdue follow-up ────────────────────────────────────
  const b = await seedPatient({
    name: "James Okafor",
    dobYearsAgo: 58,
    journeyTitle: "Hypertension Management",
    journeyState: "ACTION_REQUIRED",
    events: [
      { type: "CONSULTATION", status: "COMPLETED", title: "Hypertension follow-up consult", occurredDaysAgo: 25 },
    ],
    obligations: [
      {
        type: "SCHEDULE_FOLLOW_UP",
        description: "Follow-up appointment must be scheduled per consultation notes.",
        priority: "MEDIUM",
        status: "OPEN",
        createdDaysAgo: 25,
        dueInDays: -11, // overdue by 11 days
      },
    ],
  });

  // ── Patient C: Aarav Sharma — the showcase demo (spec section 50) ──
  const aarav = await seedPatient({
    name: "Aarav Sharma",
    dobYearsAgo: 46,
    journeyTitle: "Cardiology Care Pathway",
    journeyState: "ACTION_REQUIRED",
    linkedUserId: patientUser.id,
    events: [
      { type: "CONSULTATION", status: "COMPLETED", title: "Initial consultation", occurredDaysAgo: 14 },
      { type: "LAB_ORDER", status: "COMPLETED", title: "Diagnostic test ordered", occurredDaysAgo: 13 },
      { type: "LAB_RESULT", status: "COMPLETED", title: "Result received: elevated markers", occurredDaysAgo: 11 },
      { type: "CARE_PLAN", status: "COMPLETED", title: "Care plan created", occurredDaysAgo: 10 },
      {
        type: "REFERRAL",
        status: "REQUIRES_APPROVAL",
        title: "Referral to Cardiology",
        description: "Referral remains unscheduled.",
        occurredDaysAgo: 9,
      },
    ],
    obligations: [
      {
        type: "SCHEDULE_SPECIALIST_APPOINTMENT",
        description: "Specialist appointment must be scheduled following this referral.",
        priority: "HIGH",
        status: "OPEN",
        createdDaysAgo: 9,
        dueInDays: -2, // overdue by 2 days
      },
    ],
    referrals: [{ specialty: "Cardiology", status: "PENDING", createdDaysAgo: 9, notes: "Referral remains unscheduled." }],
  });

  // ── Patient D: missing document ─────────────────────────────────────
  await seedPatient({
    name: "Fatima Ali",
    dobYearsAgo: 41,
    journeyTitle: "Post-Surgical Follow-up",
    journeyState: "ACTION_REQUIRED",
    events: [{ type: "CONSULTATION", status: "COMPLETED", title: "Post-surgical check-in", occurredDaysAgo: 12 }],
    obligations: [
      {
        type: "PROVIDE_DOCUMENT",
        description: "Signed physical-therapy clearance form must be submitted.",
        priority: "MEDIUM",
        status: "OPEN",
        createdDaysAgo: 12,
        dueInDays: -5,
      },
    ],
  });

  // ── Patient E: conflicting offline update ───────────────────────────
  const e = await seedPatient({
    name: "Wei Zhang",
    dobYearsAgo: 29,
    journeyTitle: "Physical Therapy Pathway",
    journeyState: "IN_PROGRESS",
    events: [{ type: "CONSULTATION", status: "COMPLETED", title: "PT intake consultation", occurredDaysAgo: 6 }],
  });
  const conflictTask = await db.task.create({
    data: {
      patientId: e.patient.id,
      journeyId: e.journey.id,
      title: "Confirm home exercise plan adherence",
      priority: "MEDIUM",
      status: "COMPLETED", // clinician completed it online
      assignedRole: "COORDINATOR",
      version: 2,
      completedAt: daysAgo(1),
    },
  });
  await db.syncOperation.create({
    data: {
      operationId: crypto.randomUUID(),
      userId: coordinator.id,
      entityType: "Task",
      entityId: conflictTask.id,
      operationType: "UPDATE_STATUS",
      payload: JSON.stringify({ status: "CANCELLED", baseVersion: 1 }),
      syncStatus: "CONFLICT",
      conflictDetails: JSON.stringify({
        local: { status: "CANCELLED", queuedOffline: true },
        server: { status: "COMPLETED", version: 2 },
      }),
    },
  });

  // ── Patient F: blocked workflow ──────────────────────────────────────
  const f = await seedPatient({
    name: "Olusegun Bello",
    dobYearsAgo: 63,
    journeyTitle: "Diabetes Care Pathway",
    journeyState: "BLOCKED",
    events: [
      { type: "CONSULTATION", status: "COMPLETED", title: "Diabetes management consult", occurredDaysAgo: 20 },
      { type: "CARE_PLAN", status: "BLOCKED", title: "Care plan blocked: insurance authorization pending", occurredDaysAgo: 15 },
    ],
    obligations: [
      {
        type: "INITIATE_CARE_PLAN",
        description: "Care plan actions (medication, monitoring) must be initiated.",
        priority: "CRITICAL",
        status: "OVERDUE",
        createdDaysAgo: 15,
        dueInDays: -10,
      },
    ],
  });

  // ── Patient G: escalated case ────────────────────────────────────────
  const g = await seedPatient({
    name: "Elena Petrova",
    dobYearsAgo: 71,
    journeyTitle: "Post-Discharge Monitoring",
    journeyState: "ESCALATED",
    events: [
      { type: "CONSULTATION", status: "COMPLETED", title: "Discharge consultation", occurredDaysAgo: 22 },
      { type: "FOLLOW_UP", status: "OVERDUE", title: "48-hour follow-up call missed", occurredDaysAgo: 20 },
    ],
    obligations: [
      {
        type: "SCHEDULE_FOLLOW_UP",
        description: "Follow-up appointment must be scheduled per consultation notes.",
        priority: "CRITICAL",
        status: "OVERDUE",
        createdDaysAgo: 20,
        dueInDays: -18,
      },
    ],
  });
  await db.appointment.create({
    data: {
      patientId: g.patient.id,
      journeyId: g.journey.id,
      type: "Follow-up call",
      provider: "Care Coordination",
      status: "MISSED",
      scheduledAt: daysAgo(19),
    },
  });

  // ── Volume patients (12 more, varied simple states) ──────────────────
  const firstNames = ["Liam", "Noor", "Sofia", "Kenji", "Amara", "Diego", "Ingrid", "Tariq", "Yuki", "Chidi", "Freya", "Mateo", "Priya"];
  const lastNames = ["Reyes", "Haddad", "Kowalski", "Suzuki", "Adeyemi", "Rossi", "Larsen", "Karimi", "Tanaka", "Okonkwo", "Berg", "Fernandez", "Menon"];
  const journeyStates = ["ACTIVE", "ACTIVE", "IN_PROGRESS", "COMPLETED", "ACTION_REQUIRED"];

  for (let i = 0; i < 13; i++) {
    const name = `${firstNames[i]} ${lastNames[i]}`;
    const state = journeyStates[Math.floor(rng() * journeyStates.length)];
    await seedPatient({
      name,
      dobYearsAgo: 20 + Math.floor(rng() * 60),
      journeyTitle: "Primary Care Journey",
      journeyState: state,
      events: [
        {
          type: "CONSULTATION",
          status: "COMPLETED",
          title: "Primary care consultation",
          occurredDaysAgo: 5 + Math.floor(rng() * 30),
        },
      ],
    });
  }

  // ── Recompute risk + generate recommendations for scenario patients ──
  console.log("Computing risk assessments and generating AI recommendations...");
  const scenarioJourneys = [
    { patientId: b.patient.id, journeyId: b.journey.id },
    { patientId: aarav.patient.id, journeyId: aarav.journey.id },
    { patientId: f.patient.id, journeyId: f.journey.id },
    { patientId: g.patient.id, journeyId: g.journey.id },
  ];

  const allPatients = await db.patient.findMany({ include: { journeys: true } });
  for (const p of allPatients) {
    for (const j of p.journeys) {
      await computeAndPersistRisk(p.id, j.id);
    }
  }

  for (const s of scenarioJourneys) {
    await generateCoordinationRecommendations(s.patientId, s.journeyId);
    const risk = await db.riskAssessment.findFirst({
      where: { patientId: s.patientId, journeyId: s.journeyId },
      orderBy: { computedAt: "desc" },
    });
    if (risk) {
      const factors: RiskFactor[] = JSON.parse(risk.factors);
      await generateRiskExplanationRecommendation(s.patientId, s.journeyId, risk.riskScore, risk.riskLevel, factors);
    }
  }

  console.log("Seed complete.");
  console.log("Demo logins (password shown is the seeded value, for this demo only):");
  console.log("  admin@lifeline.demo       / LifelineDemo!Admin1");
  console.log("  clinician@lifeline.demo   / LifelineDemo!Clinician1");
  console.log("  coordinator@lifeline.demo / LifelineDemo!Coordinator1");
  console.log("  patient@lifeline.demo     / LifelineDemo!Patient1  (linked to Aarav Sharma)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
