# **Redshift: Decentralized Secret Management Architecture**

## **Product Requirements and Technical Specification**

### **1\. Project Overview & AI Directives**

**Redshift** is a decentralized, censorship-resistant secret management platform
designed to replicate the developer experience (DX) of **Doppler**. It decouples
secret storage from centralized providers by utilizing the **Nostr** protocol
for transport and storage, while maintaining a local-first, single-binary
architecture powered by **Bun**.

#### **1.1. Directives for AI Coding Assistants**

- **Context Retrieval:** When generating code, use context7 to retrieve the
  latest documentation for **NIP-59 (Gift Wrap)**, **NIP-09 (Deletion)**, and
  **Svelte 5 Runes**.
- **Documentation Search:** If context7 is insufficient, utilize **WebSearch**
  or **Firecrawl MCP** to find up-to-date examples for:
  - applesauce-core (specifically GiftWrap class and QueryStore).
  - shadcn-svelte (specifically v1.0+ with Svelte 5 support).
  - Bun's native util.parseArgs.
- **Code Style:**
  - **Frontend (Admin app):** SvelteKit 5 (Runes $state, $derived, $effect)
    running in Single-Page app mode:
    [https://svelte.dev/docs/kit/single-page-apps](https://svelte.dev/docs/kit/single-page-apps)
  - **Home Page**: SvelteKit 5 using static site generation:
    [https://svelte.dev/docs/kit/adapter-static](https://svelte.dev/docs/kit/adapter-static)
    (should have a “/”, “/docs”, and “/tutorial” page)
  - **Backend/CLI:** Bun native. TypeScript. Strict typing.
  - **Design:** Minimalist, clean, using **ShadCN** and **Svelte Motion**.

### ---

**2\. Product Requirements Document (PRD)**

#### **2.1. Core Philosophy**

- **User Sovereignty:** Secrets are encrypted on the client and stored on
  relays. Only the user (holder of the nsec) can read them.
- **One Identity, Many Projects:** A single Nostr identity (npub) can manage
  unlimited **Projects**. Each Project can have unlimited **Environments**
  (e.g., dev, stg, prod).
- **Atomic State:** A Project+Environment pair is stored as a single
  **Replaceable Event** inside a **Gift Wrap**. This ensures atomicity and easy
  state recovery.

#### **2.2. Functional Requirements**

##### **2.2.1. The "Redshift" CLI**

The CLI must mimic the doppler command structure to ensure familiarity.

- redshift login
  - Accepts an nsec (Nostr Private Key).
  - Stores it securely in the system keychain or an encrypted local config file
    (\~/.redshift/config).
  - _Security Note:_ If the environment variable REDSHIFT\_NSEC is present,
    bypass login/storage and use that key (CI/CD support).
- redshift setup
  - Interactive guide to select a Project and Environment for the current
    directory.
  - Writes a redshift.yaml file locally (referencing project IDs, not secrets).
- redshift run \-- \<command\>
  - Fetches the latest secrets for the configured Project/Env.
  - Injects them into process.env.
  - Executes \<command\> (e.g., bun run dev, python app.py).
  - **Complex Values:** If a secret value is an object or array, it must be
    JSON.stringify'd before injection.
- redshift secrets set \<KEY\> \<VALUE\>
  - Updates a specific secret in the active environment.
  - Creates a new version of the secret bundle and publishes it.
- redshift serve
  - Starts a local web server (e.g., http://localhost:3000) hosting the embedded
    Admin UI.

##### **2.2.2. The Web Administration Dashboard**

- **Framework:** Sveltekit 5 (Static generation for home and about pages; SPA
  mode for admin app).
- **UI Library:** **ShadCN Svelte** (Latest).
- **Authentication:**
  - **NIP-07 Extension:** Primary login method for the web UI (Alby, nos2x).
  - **Local NSEC:** Fallback for standalone binary usage.
- **Features:**
  - **Project List:** View all projects owned by the user.
  - **Secret Editor:** A spreadsheet-like interface for editing Key/Value pairs.
  - **Drag-and-Drop:** Support ordering or grouping if applicable.
  - **Subtle Motion:** Use svelte-motion for transitions (e.g., list items
    sliding in, modals fading).

##### **2.2.3. Data Structure & Protocol**

- **Transport:** **NIP-59 (Gift Wrap)**. All data is sealed and wrapped to the
  user's own pubkey.
- **Inner Payload (Rumor):**
  - **Kind:** **30078** (Arbitrary Custom App Data) or a dedicated Parameterized
    Replaceable Event kind.
  - **d tag:** \<project\_id\>|\<environment\_slug\> (e.g.,
    a1b2c3d4|production).
  - **Content:** JSON object: { "STRIPE\_KEY": "...", "FEATURE\_FLAGS": {
    "new\_ui": true } }.
- **Updates:**
  - To update secrets, the client generates a _new_ Rumor with the same d tag
    but a newer created\_at.
  - It wraps this rumor in a _new_ Gift Wrap event and publishes it.
  - **Client Logic:** The client fetches _all_ recent Gift Wraps, unwraps them,
    and keeps only the event with the latest created\_at for each d tag.
- **Deletion (NIP-09):**
  - When a user deletes a project or environment, the client publishes a **Kind
    5** (Deletion Request) referencing the _Gift Wrap IDs_ that contained the
    old secrets.
  - _Note:_ This only deletes the outer wrapper. To logically delete the data,
    the client should also publish a new "Tombstone" secret bundle (empty
    content) with the same d tag.

### ---

**3\. Technical Specifications**

#### **3.1. Architecture: The Bun Monolith**

- **Runtime:** Bun.
- **Build Artifact:** A single executable binary created via bun build
  \--compile.
- **Asset Embedding:**
  - The Svelte app is built into a dist/ folder (HTML/CSS/JS).
  - The CLI imports the entry point: import indexHtml from
    '../web/dist/index.html'.
  - The HTTP server serves this imported string for the root route / and acts as
    a static file server for assets.

#### **3.2. Libraries**

- **CLI Parsing:** util.parseArgs (Bun's built-in Node compatibility or native
  equivalent).
- **Nostr SDK:** applesauce-core (Logic), applesauce-relay (Relay connections),
  nostr-tools (Crypto).
- **UI Components:** shadcn-svelte, lucide-svelte (Icons), svelte-motion.
- **Styles:** You must use Tailwind v4 and use the following Tokyo-Night Storm
  theme

#### **3.2.1. Applesauce Data Flow Paradigm**

All Nostr data in the web application MUST follow this reactive pattern:

1. **EventStore as Single Source of Truth**
   - Create ONE `EventStore` instance shared across the entire app
   - All Nostr events (profiles, projects, secrets) are stored in the EventStore
   - Components subscribe to EventStore observables, never fetch directly

2. **RelayPool for Network Communication**
   - Use `RelayPool` from `applesauce-relay` to manage relay connections
   - Pipe events from relays into the shared EventStore
   - Never make direct relay calls from components

3. **Models for Reactive UI**
   - Use `eventStore.model()` to create reactive subscriptions
   - Create custom Models (e.g., `ProjectModel`, `SecretsModel`) for
     app-specific data
   - Models automatically update UI when underlying events change

4. **Svelte Integration Pattern**
   ```typescript
   // stores/nostr.svelte.ts - Shared EventStore
   import { EventStore } from "applesauce-core";
   import { RelayPool } from "applesauce-relay";

   export const eventStore = new EventStore();
   export const relayPool = new RelayPool();

   // Subscribe relay events to EventStore
   export function connectToRelays(relays: string[]) {
     relayPool.subscription(relays, { kinds: [30078] })
       .pipe(onlyEvents())
       .subscribe((event) => eventStore.add(event));
   }
   ```

   ```svelte
   <!-- Component using reactive data -->
   <script lang="ts">
   import { eventStore } from '$lib/stores/nostr.svelte';
   import { ProjectModel } from '$lib/models/project';

   // Reactive subscription using $effect
   let projects = $state<Project[]>([]);

   $effect(() => {
     const subscription = eventStore
       .model(ProjectModel, auth.pubkey)
       .subscribe(data => { projects = data });
     return () => subscription.unsubscribe();
   });
   </script>
   ```

5. **Event Creation with EventFactory**
   - Use `EventFactory` from `applesauce-factory` to create events
   - Use blueprints for consistent event structure
   - Sign events with the authenticated signer (NIP-07 or local key)

| :root { /\* Tokyo Night Day (Light Mode) \*/ \--background: \#e1e2e7; \--foreground: \#3760bf; \--card: \#ffffff; \--card-foreground: \#3760bf; \--popover: \#ffffff; \--popover-foreground: \#3760bf; \--primary: \#2e7de9; \--primary-foreground: \#ffffff; \--secondary: \#d0d5e3; \--secondary-foreground: \#3760bf; \--muted: \#d0d5e3; \--muted-foreground: \#8990b3; \--accent: \#d0d5e3; \--accent-foreground: \#3760bf; \--destructive: \#f52a65; \--destructive-foreground: \#ffffff; \--border: \#a8aecb; \--input: \#a8aecb; \--ring: \#2e7de9; /\* Day Chart Colors \*/ \--chart-1: \#2e7de9; \--chart-2: \#9854f1; \--chart-3: \#007c99; \--chart-4: \#587539; \--chart-5: \#8c6c3e; /\* Sidebar (Light) \*/ \--sidebar: \#d0d5e3; \--sidebar-foreground: \#3760bf; \--sidebar-primary: \#2e7de9; \--sidebar-primary-foreground: \#ffffff; \--sidebar-accent: \#a8aecb; \--sidebar-accent-foreground: \#3760bf; \--sidebar-border: \#a8aecb; \--sidebar-ring: \#2e7de9; /\* Base Settings (Kept from your example) \*/ \--font-sans: Inter, sans-serif; \--font-serif: Source Serif 4, serif; \--font-mono: JetBrains Mono, monospace; \--radius: 0.375rem; \--shadow-x: 0; \--shadow-y: 1px; \--shadow-blur: 3px; \--shadow-spread: 0px; \--shadow-opacity: 0.1; \--shadow-color: \#000000; \--shadow-2xs: 0 1px 3px 0px rgba(0, 0, 0, 0.05); \--shadow-xs: 0 1px 3px 0px rgba(0, 0, 0, 0.05); \--shadow-sm: 0 1px 3px 0px rgba(0, 0, 0, 0.10), 0 1px 2px \-1px rgba(0, 0, 0, 0.10); \--shadow: 0 1px 3px 0px rgba(0, 0, 0, 0.10), 0 1px 2px \-1px rgba(0, 0, 0, 0.10); \--shadow-md: 0 1px 3px 0px rgba(0, 0, 0, 0.10), 0 2px 4px \-1px rgba(0, 0, 0, 0.10); \--shadow-lg: 0 1px 3px 0px rgba(0, 0, 0, 0.10), 0 4px 6px \-1px rgba(0, 0, 0, 0.10); \--shadow-xl: 0 1px 3px 0px rgba(0, 0, 0, 0.10), 0 8px 10px \-1px rgba(0, 0, 0, 0.10); \--shadow-2xl: 0 1px 3px 0px rgba(0, 0, 0, 0.25); \--tracking-normal: 0em; \--spacing: 0.25rem; } .dark { /\* Tokyo Night Storm (Dark Mode) \*/ \--background: \#24283b; \--foreground: \#c0caf5; /\* Using bg\_highlight/dark for cards to add depth \*/ \--card: \#1f2335; \--card-foreground: \#c0caf5; \--popover: \#1f2335; \--popover-foreground: \#c0caf5; /\* Primary Blue \*/ \--primary: \#7aa2f7; \--primary-foreground: \#1d202f; /\* Muted/Secondary \*/ \--secondary: \#292e42; \--secondary-foreground: \#c0caf5; \--muted: \#292e42; \--muted-foreground: \#565f89; /\* Accent (Hover states) \*/ \--accent: \#292e42; \--accent-foreground: \#c0caf5; /\* Destructive \*/ \--destructive: \#f7768e; \--destructive-foreground: \#1d202f; /\* Borders \*/ \--border: \#414868; \--input: \#414868; \--ring: \#7aa2f7; /\* Storm Chart Colors \*/ \--chart-1: \#7aa2f7; /\* Blue \*/ \--chart-2: \#bb9af7; /\* Magenta \*/ \--chart-3: \#7dcfff; /\* Cyan \*/ \--chart-4: \#9ece6a; /\* Green \*/ \--chart-5: \#e0af68; /\* Orange \*/ /\* Sidebar (Storm) \*/ \--sidebar: \#1f2335; \--sidebar-foreground: \#c0caf5; \--sidebar-primary: \#7aa2f7; \--sidebar-primary-foreground: \#1d202f; \--sidebar-accent: \#292e42; \--sidebar-accent-foreground: \#c0caf5; \--sidebar-border: \#414868; \--sidebar-ring: \#7aa2f7; } @theme inline { \--color-background: var(--background); \--color-foreground: var(--foreground); \--color-card: var(--card); \--color-card-foreground: var(--card-foreground); \--color-popover: var(--popover); \--color-popover-foreground: var(--popover-foreground); \--color-primary: var(--primary); \--color-primary-foreground: var(--primary-foreground); \--color-secondary: var(--secondary); \--color-secondary-foreground: var(--secondary-foreground); \--color-muted: var(--muted); \--color-muted-foreground: var(--muted-foreground); \--color-accent: var(--accent); \--color-accent-foreground: var(--accent-foreground); \--color-destructive: var(--destructive); \--color-destructive-foreground: var(--destructive-foreground); \--color-border: var(--border); \--color-input: var(--input); \--color-ring: var(--ring); \--color-chart-1: var(--chart-1); \--color-chart-2: var(--chart-2); \--color-chart-3: var(--chart-3); \--color-chart-4: var(--chart-4); \--color-chart-5: var(--chart-5); \--color-sidebar: var(--sidebar); \--color-sidebar-foreground: var(--sidebar-foreground); \--color-sidebar-primary: var(--sidebar-primary); \--color-sidebar-primary-foreground: var(--sidebar-primary-foreground); \--color-sidebar-accent: var(--sidebar-accent); \--color-sidebar-accent-foreground: var(--sidebar-accent-foreground); \--color-sidebar-border: var(--sidebar-border); \--color-sidebar-ring: var(--sidebar-ring); \--font-sans: var(--font-sans); \--font-mono: var(--font-mono); \--font-serif: var(--font-serif); \--radius-sm: calc(var(--radius) \- 4px); \--radius-md: calc(var(--radius) \- 2px); \--radius-lg: var(--radius); \--radius-xl: calc(var(--radius) \+ 4px); \--shadow-2xs: var(--shadow-2xs); \--shadow-xs: var(--shadow-xs); \--shadow-sm: var(--shadow-sm); \--shadow: var(--shadow); \--shadow-md: var(--shadow-md); \--shadow-lg: var(--shadow-lg); \--shadow-xl: var(--shadow-xl); \--shadow-2xl: var(--shadow-2xl); } |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |

#### 

#### **3.3. GitHub Actions (CI/CD)**

- **Workflows:**
  1. **Test:** Run bun test for both CLI logic and Svelte components.
  2. **Build:**
     - Install dependencies.
     - Build Svelte app (bun run build:web).
     - Compile Binary (bun build \--compile src/cli.ts \--outfile redshift).
  3. **Release:** Upload binaries (Linux-x64, MacOS-ARM64) to Github Releases.

### ---

**4\. Test-Driven Development (TDD) Plan**

The AI should follow these phases, writing the test _before_ the implementation.

#### **Phase 1: Cryptographic Core (NIP-59 & Secrets)**

1. **Test:** Create tests/crypto.test.ts. Define a test case that takes a JSON
   object, wraps it using NIP-59 (Alice \-\> Alice), and asserts that it can be
   unwrapped and parsed back to the original JSON.
2. **Test:** Define a test for SecretManager.ts. Mock a Nostr pool. Publish two
   Gift Wraps with the same d tag but different timestamps. Assert
   getLatestSecrets() returns the newer one.
3. **Implement:** src/lib/crypto.ts using nostr-tools and
   src/lib/SecretManager.ts.

#### **Phase 2: The CLI Engine (parseArgs)**

1. **Test:** Create tests/cli.test.ts. Use bun:test.
   - Test parseCommand(\['run', '--', 'echo', 'hello'\]) returns the correct
     command and flags.
   - Test injectSecrets(originalEnv, secrets) returns a merged environment
     object handling complex JSON values.
2. **Implement:** src/cli/parser.ts using util.parseArgs.

#### **Phase 3: The Svelte 5 UI (ShadCN \+ Runes)**

1. **Test:** Create tests/ui/SecretTable.test.ts.
   - Use @testing-library/svelte.
   - Mock the Applesauce store.
   - Render SecretTable.svelte.
   - Simulate editing a cell value. Assert the local state (Runes) updates.
2. **Implement:** web/src/components/SecretTable.svelte using shadcn-svelte
   table components and Svelte 5 $state.

#### **Phase 4: Integration (The Binary)**

1. **Test:** Create tests/integration.test.ts.
   - Spawns the compiled binary redshift serve.
   - Fetches http://localhost:3000.
   - Asserts it returns the HTML content.
2. **Implement:** src/server.ts that imports the HTML assets and sets up
   Bun.serve.

### ---

**5\. Monetization Roadmap**

While Redshift is open-source (sovereign), sustainable revenue can be generated
through "Convenience & Enterprise" layers.

- **Tier 1: Redshift Cloud (Managed Relay)**
  - _Problem:_ Free relays often drop data or have strict rate limits. Users
    risk losing their "Secret History."
  - _Product:_ A paid, high-availability Nostr Relay optimized for Kind 1059
    events.
  - _Feature:_ Automatic nightly encrypted backups to S3/R2.
  - _Cost:_ $5/month.
- **Tier 2: Teams & RBAC (Multi-Sig)**
  - _Problem:_ Sharing secrets securely among 5+ developers is hard with a
    single key.
  - _Product:_ "Redshift Teams."
  - _Feature:_ Implements **NIP-04/Group Encryption**. The UI manages Key
    rotation. When a dev leaves, Redshift automatically re-rolls the bundle
    keys.
  - _Cost:_ $20/user/month.
- **Tier 3: Enterprise SSO Bridge**
  - _Problem:_ Corporations mandate Okta/AzureAD login, not private keys.
  - _Product:_ An OIDC-to-Nostr bridge. Users login with Okta; the bridge
    (running in their enclave) unlocks a specialized NSEC for the session.
  - _Cost:_ Most permissive open source license that assumes NO responsibility
