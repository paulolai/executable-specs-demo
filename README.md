# Executable Specifications Pattern

**Achieving shared understanding without the "Translation Layer".**

## 📖 The Philosophy

For years, the industry has relied on Gherkin (Cucumber) to bridge the gap between Product requirements and Engineering code. While the intention was noble, the reality for many teams has been:

- **The "Regex Tax":** Maintaining fragile mappings between plain English strings and code.
- **Tooling Friction:** Limited refactoring support and clumsy debugging experiences.
- **The "Green Illusion":** Tests that pass but don't actually reflect the complex state of the system.

**This repository demonstrates an alternative strategy.**

Instead of a translation layer, we treat **Code as the Specification** and **Reports as the Attestation**.

## 🏗 The 4 Pillars of this Pattern

### 1. The Strategy Document (/docs)

We replace disconnected Jira tickets or "Given/When/Then" feature files with a durable **Markdown Strategy** document. This lives in the repository, evolves with the code, and acts as the single source of truth for both Engineers and AI Agents.

### 2. Native Testing Frameworks

We use the tools engineers already love (Vitest for TypeScript, JUnit 5 for Java). No external plugins, no "Step Definitions," no context-switching.

### 3. Fluent Fixtures & Builders

Instead of parsing English sentences, we use strongly-typed **Test Data Builders** (Helpers). This provides:

- **Type Safety:** If the domain changes, the compiler tells you immediately.
- **Readability:** Tests read like sentences (`cart.withItem(...).asVip()`).
- **Refactorability:** Rename a method in the code, and your IDE updates every test instantly.

### 4. Attestation Reports

The "Human Readable" part comes at the **end**, not the beginning. We generate rich, custom test reports that serve as an **Audit Log**. These reports map inputs to outputs, verifying that the business logic (defined in the Strategy) was actually executed.

---

## 📚 Documentation & Guidelines

This project follows strict engineering standards. Agents and Engineers should refer to:

- [**AI Agent Protocol**](AGENTS.md): Operational rules for Gemini, Copilot, and other AI assistants.
- [**Project Guidelines**](docs/TS_PROJECT_GUIDELINES.md): Core principles, code style, and architectural philosophy.
- [**Testing Framework**](docs/TS_TESTING_FRAMEWORK.md): The mandatory standard for writing tests (templates, patterns, anti-patterns).
- [**Test Strategy**](docs/TEST_STRATEGY.md): The specific "Code as Specification" methodology used for the Pricing Engine.
- [**Deep Dive: Why This Beats Type-Safe Gherkin**](docs/BDD_COMPARISON.md): Detailed comparison showing why eliminating the translation layer > fixing it with types.

## ⚔️ Comparison: The Gherkin Way vs. The Executable Spec Way

| Feature | The Gherkin/Cucumber Way | The Executable Spec Pattern |
| :--- | :--- | :--- |
| **Source of Truth** | Feature Files (.feature) | Markdown Strategy + The Code itself |
| **Logic Mapping** | Fragile Regex / String Matching | Strong Typing / Direct Method Calls |
| **Refactoring** | Manual, error-prone (Ctrl+F) | Instant, safe (F2 / Rename Symbol) |
| **Debugging** | Often requires complex IDE plugins | Standard Breakpoints |
| **Stakeholder View** | They read the Input (The Feature file) | They read the Output (The Attestation Report) |
| **Maintenance Cost** | High (The Translation Layer) | Low (Standard Code Maintenance) |

## 📂 Repository Structure

This project demonstrates both the solution and the anti-pattern side-by-side.

- [**Executable Specifications**](implementations/typescript-vitest/): The recommended approach using Vitest and PBT.
- [**The Gherkin Anti-Pattern**](implementations/typescript-cucumber/): A standard Cucumber setup for comparison.
- [**Detailed Comparison**](docs/GERHKIN_VS_EXECUTABLE.md): A technical deep dive into why eliminating the translation layer is superior.

```text
.
├── docs/
│   ├── pricing-strategy.md      # The SHARED Source of Truth.
│   └── GERHKIN_VS_EXECUTABLE.md # The Technical Comparison.
├── implementations/
│   ├── typescript-vitest/       # The SOLUTION: Fast, safe, deep.
│   └── typescript-cucumber/     # The ANTI-PATTERN: Slow, fragile, shallow.
└── reports/                     # Generated attestations (HTML/Markdown)
```

## 🚀 The Scenario: Dynamic Pricing Engine

To demonstrate this, we implement a pure-logic **Pricing Engine**. This is the classic "Gherkin Trap"—a domain heavy on rules and combinations that usually results in unmaintainable feature files.

**The Strategy:**

- **Base Rules:** AUD currency, integer cent precision (no floating point errors).
- **Bulk Discounts:** Buy 3+ items, get 15% off.
- **VIP Tier:** Tenure > 2 years gets 5% off subtotal (after bulk).
- **Shipping:** Dynamic rates based on weight, with a free threshold ($100+) and premium overrides (Expedited/Express).
- **Safety Valve:** Max product discount strictly capped at 30%.

## 🛠 Getting Started

### TypeScript / Vitest Implementation (Recommended ✅)

Navigate to the implementation folder:

```bash
cd implementations/typescript-vitest
npm install
npm test
```

*Check the console output or the generated `/reports` folder to see the Attestation Report.*

### TypeScript / Cucumber Implementation (Anti-Pattern ❌)

See the "Translation Layer Tax" in action:

```bash
cd implementations/typescript-cucumber
npm install
npm test
```

**Note**: This implementation exists purely for educational comparison. It demonstrates the maintenance burden and refactoring difficulties of the Gherkin approach.

### Compare Both Approaches Side-by-Side

Run both implementations to experience the difference:

1. **Executable Specs**: 47 tests generate 1000s of random cases, execute in ~0.7s
2. **Gherkin/Cucumber**: 66 hand-written scenarios (with examples tables), 325 steps, execute in ~0.05s (after 3s compile)

**See detailed comparison:** [`docs/GERHKIN_VS_EXECUTABLE.md`](docs/GERHKIN_VS_EXECUTABLE.md) - Includes code metrics, refactoring scenarios, and cost of ownership analysis.