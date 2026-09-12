# Lifeline OS — Interview Guide & Technical Defense

## 1. Pitches
- **30-Second Pitch**: "Lifeline OS is an offline-first clinical continuity platform for low-resource and emergency healthcare. It maintains an immutable clinical encounter graph, synchronizes records across intermittent networks using CRDT conflict resolution, and automates clinical handovers with deterministic AI safety boundaries."
- **2-Minute Pitch**: "In rural clinics and disaster response environments, internet outages paralyze traditional electronic health records, leading to dangerous clinical handover failures. Lifeline OS solves this with an offline-first architecture built on Next.js, Prisma, and IndexedDB. Frontline workers can record vitals, triage emergencies, and prescribe medications completely offline. When network connectivity resumes, our sync engine merges local mutation queues using version vectors with clinical safety invariants. We construct an end-to-end clinical timeline graph and provide AI-generated handover summaries that pass through strict schema filters, ensuring zero fabricated medical data."

## 2. Key Technical Q&A
- **Q: How do you prevent clinical data loss when two doctors edit the same record offline?**
  - **A**: We apply domain-specific merge semantics rather than naive last-write-wins. For allergies and active medications, we perform a strict set union (preserving all entries until explicitly discontinued by an authorized physician). For vital signs, all measurements are stored as immutable timeseries points rather than overwriting previous values.
- **Q: How is AI safety guaranteed in clinical handovers?**
  - **A**: The LLM never writes to the database directly. It only produces draft handover summaries rendered in an approval queue where a licensed physician must review, edit, and sign the note before it enters the official patient record.
