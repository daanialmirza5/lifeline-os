# Lifeline OS — Technical Debt & Architectural Audit

**Repository**: `lifeline-os`  
**Status**: Tier 1 Flagship (Vitest + Playwright suites)

## Prioritized Debt Items
- **[P1 — High] End-to-End Encryption for Offline Storage**: IndexedDB storage on client devices is currently unencrypted. Implement Web Crypto API AES-GCM database encryption for offline records.
- **[P2 — Medium] Full HL7 FHIR v4 API Serialization**: Current models are FHIR-aligned but lack full JSON-LD / FHIR Bundle export compliance.
- **[P3 — Low] WebRTC Peer-to-Peer Local Mesh Sync**: Enable direct device-to-device local WiFi/Bluetooth record sync when WAN internet is unavailable.
