# Execution Plan: Executable Specifications Pattern Demo

This plan outlines the steps to implement the "Code as Specification" pattern using TypeScript and Vitest. We will build a Pricing Engine where the code proves the specification through generated attestation reports.

## 1. Project Structure & Strategy

**Goal:** Establish the file structure and the "Source of Truth" document.

- [x] **Create Directory Structure:**
  - `docs/`
  - `implementations/typescript-vitest/src/`
  - `implementations/typescript-vitest/test/fixtures/`
  - `implementations/typescript-vitest/test/reporters/`
- [x] **Write Strategy Document (`docs/pricing-strategy.md`):**
  - Define the 4 core rules: Base/GST, Bulk Discounts, VIP Tier, and Safety Valve.
  - This document acts as the requirements baseline.

## 2. Environment Configuration

**Goal:** Set up the TypeScript and Vitest environment for the `typescript-vitest` implementation.

- [x] **Update `implementations/typescript-vitest/package.json`:**
  - Add `fast-check` for property-based testing.
  - Dependencies: `typescript`, `vitest`, `ts-node`, `fast-check`.
- [x] **Create `implementations/typescript-vitest/tsconfig.json`:**
  - Configure for Node.js environment, ESNext modules.
- [x] **Create `implementations/typescript-vitest/vitest.config.ts`:**
  - Configure Vitest to use the custom reporter.

## 3. The Pricing Engine (Logic)

**Goal:** Implement the business logic described in the Strategy Document.

- [x] **Define Types (`src/types.ts`):**
  - Interfaces for `CartItem`, `Cart`, `User`, `PricingResult`.
- [x] **Implement Engine (`src/pricing-engine.ts`):**
  - **Base Rule:** Calculate Subtotal (AUD, incl. 10% GST).
  - **Bulk Rule:** Apply 15% off line items with qty >= 3.
  - **VIP Rule:** Apply 5% off subtotal if tenure > 2 years.
  - **Safety Valve:** Cap total discount at 30% of original price.

## 4. The Bridge (Fluent Fixtures & Arbitraries)

**Goal:** Create the "Language" for our tests to keep them readable and decoupled from implementation details.

- [x] **Implement Builder (`test/fixtures/cart-builder.ts`):**
  - `CartBuilder` class for static example tests.
- [x] **Implement Arbitraries (`test/fixtures/arbitraries.ts`):**
  - Create `fast-check` arbitraries for `CartItem`, `User`, and complete `Carts`.
  - These generators will power the property-based tests.

## 5. The Proof (Hierarchical Attestation Reporter)

**Goal:** Create the "Principal QE" artifact—a generated Markdown report that serves as an audit log.

- [x] **Update Reporter (`test/reporters/attestation-reporter.ts`):**
  - **Hierarchy:** Support nested `describe` blocks (System -> Area -> Feature -> Scenario).
  - **Metadata:** Capture and display:
    - **Git Hash** (Current commit).
    - **Execution Time**.
    - **Dirty State** (List of modified/untracked files).
  - **Output Structure:** 
    - Create a timestamped folder: `reports/YYYY-MM-DD_HH-mm-ss/`.
    - Generate `attestation.md`.
    - Generate `attestation.html` (Styled for easy viewing).
  - **Content:**
    - Header with Timestamp.
    - **Executive Summary:** High-level pass/fail stats.
    - **Detailed Audit:** Nested sections mirroring the test structure.

## 6. The Execution (Property-Based Tests)

**Goal:** Write tests that generate thousands of scenarios to prove the Strategy holds true under any condition.

- [x] **Refactor Tests (`test/pricing.test.ts`):**
  - Use `fc.assert(fc.property(...))` to define invariants.
  - Example Property: "For ANY cart with items > 3 quantity, the bulk discount MUST be applied."
  - Example Property: "For ANY combination of inputs, total discount MUST NOT exceed 30%."
  - Retain some specific "Example-Based" tests for documentation clarity (e.g., the specific examples in the Strategy doc).

## 7. Deep Observability (IO Tracing)

**Goal:** Provide "Network Tab" level detail in static reports without infrastructure overhead.

- [x] **Implement `TestTracer`:**
  - Create a global interaction store mapped to Vitest test names.
- [x] **Instrument Domain Boundary:**
  - Update `CartBuilder` to automatically log all inputs and outputs to the tracer.
- [x] **Rich HTML Reporting:**
  - Enhance the HTML reporter to display collapsible JSON interaction logs for every test scenario.

## 8. CI/CD & Automation

**Goal:** Automate execution and artifact preservation.

- [x] **GitHub Actions (`.github/workflows/ci.yml`):**
  - Trigger on Push/PR.
  - Steps: Checkout, Install, Test.
  - **Artifacts:** Upload the contents of the `reports/` directory as a build artifact.
- [x] **Git Configuration (`.gitignore`):**
  - Ignore the generated `reports/` directory locally to prevent noise.