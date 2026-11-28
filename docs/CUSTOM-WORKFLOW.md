# Custom Workflow Guide: Command, Skill, dan Agent

Panduan komprehensif mengenai seluruh command, skill, dan agent custom/teradaptasi yang telah diintegrasikan ke dalam lingkungan kerja OpenCode v2 dan ECC Anda, lengkap dengan mental model kapan menggunakan masing-masing komponen.

---

## 1. Mental Model: Command vs Agent vs Skill

Untuk bekerja efisien, pahami peran ketiganya seperti struktur tim profesional:

```
┌─────────────────────────────────────────────────────────────┐
│                       USER PROMPT                           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. COMMAND (/command)                                       │
│ "Pintu Masuk & Alur Kerja (Workflow Orchestrator)"           │
│ - Anda yang memanggilnya dengan tanda garis miring (/).     │
│ - Mengontrol alur (fase demi fase, paralel vs sekuensial).  │
│ - Menyiapkan konteks sesi dan mengoordinasikan subagent.    │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ 2. AGENT (subagent)         │ │ 3. SKILL (Domain Knowledge) │
│ "Spesialis Eksekutor"       │ │ "Buku SOP & Metodologi"     │
│ - Dijalankan di proses anak │ │ - Kumpulan aturan, pola,    │
│   (child session terisolasi)│ │   checklist, dan best-      │
│ - Memiliki persona, model,  │ │   practice.                 │
│   dan batasan tool sendiri. │ │ - Diinjeksikan ke agent     │
│ - Fokus pada 1 tugas murni  │ │   agar tahu *cara* kerja    │
│   (misal: audit, plan, test)│ │   yang benar dan anti-slop. │
└─────────────────────────────┘ └─────────────────────────────┘
```

### Ringkasan Cepat: Kapan Pakai Apa?

| Komponen | Siapa yang Menjalankan? | Tujuan Utama | Contoh Penggunaan |
| :--- | :--- | :--- | :--- |
| **Command (`/`)** | **Anda (User)** | Memulai workflow terstruktur atau pipeline multi-step. | Ingin audit celah keamanan mendalam: ketik `/security-audit`. |
| **Agent (`subagent`)** | **Orchestrator / Main Agent** | Mendelegasikan tugas berat ke spesialis ber-model khusus tanpa mengotori chat utama. | Butuh memverifikasi rencana ke disk tanpa halusinasi: panggil `plan-reviewer` (Momus). |
| **Skill** | **Main Agent / Subagent** | Membaca referensi panduan, standar kode, atau algoritma problem-solving. | Sedang merefaktor git commit: agent memuat skill `git-master` untuk menjamin atomic commit. |

---

## 2. Katalog Command Custom (Workflow Entry Points)

Command custom yang telah dibuat dan diselaraskan di `.opencode/commands/` dan `~/.config/opencode/commands/`:

### A. Keamanan & Penetrasi
1. **`/security-audit`** *(Baru)*
   - **Tujuan**: Full application penetration test dan penemuan kerentanan mendalam menggunakan harness 6-fase Cloudflare.
   - **Alur**:
     - Phase 0: Setup, prior-run discovery, dan budget gate.
     - Phase 1: Reconnaissance (4 subagent `explore` paralel -> `architecture.md` + `coverage-ledger.json`).
     - Phase 2: Hunter waves (`security-hunter` paralel + `security-verifier` critic pass).
     - Phase 3: Adversarial validation (verifier membuktikan kandidat salah) & eksekusi PoC di sandbox Lima `ga-proof`.
     - Phase 4: Output terstruktur (`findings.json`: `confirmed`, `needs_validation`, `rejected`).
     - Phase 5: Independent record verification.
     - Phase 6: Laporan final (`REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`).
   - **Contoh Pakai**: `/security-audit`, `/security-audit --profile quick`, `/security-audit src/api/ --auto-exec`.

2. **`/security`** *(Harian)*
   - **Tujuan**: Review keamanan harian yang cepat untuk diff/commit aktif sebelum di-push.
   - **Alur**: Menginspeksi git diff sesi ini -> memanggil subagent `security-reviewer` -> cek OWASP, sanitasi input, dan CVE dependensi via `docs-lookup`.

3. **`/security-scan`** *(Harness)*
   - **Tujuan**: Audit higienitas konfigurasi AI Harness via engine AgentShield (`.claude/`, `opencode.json`, permissions, kebocoran secret di prompt).

### B. Riset & Arsitektur
4. **`/deep-research`** *(Baru)*
   - **Tujuan**: Riset mendalam multi-sumber lintas web yang diikat langsung pada batasan kode lokal (*Codebase Grounded*).
   - **Alur**:
     - Phase 0: Subagent `explore` memetakan dependensi di lockfile dan modul lokal terkait.
     - Phase 1: Merumuskan 2–4 hipotesis dan query oposisi.
     - Phase 2: Pencarian paralel via Exa MCP / `docs-lookup` dengan **aturan triangulasi wajib** (minimal 3 sumber independen bertipe berbeda).
     - Phase 3: Adversarial pass & estimasi risiko.
     - Phase 4: Sintesis laporan ke `docs/research/<slug>.md`.
   - **Contoh Pakai**: `/deep-research "Evaluasi engine search lokal untuk Next.js 16"`.

5. **`/plan`** *(Lead Orchestrator)*
   - **Tujuan**: Merancang rencana kerja implementasi fitur kompleks atau refactoring besar.
   - **Alur**: Merekap konteks diskusi -> memanggil subagent `planner` -> menulis rencana ke `docs/plans/<slug>.plan.md` -> user dapat memverifikasinya via `plan-reviewer` (Momus).

### C. Review & Dokumentasi
6. **`/code-review-quick`** *(Baru)*
   - **Tujuan**: Review kode cepat dengan dialog scope interaktif dan penanda riwayat marker Markdown (`.opencode/markers/code-review-quick.md`).
   - **Alur**: Menanyakan scope (uncommitted vs HEAD, sejak marker terakhir, N commit, atau file modified sesi ini) -> panggil `code-reviewer` -> catat stempel ke `.opencode/markers/code-review-quick.md`.

7. **`/update-docs`** *(Enhanced)*
   - **Tujuan**: Sinkronisasi dokumentasi dan codemaps berdasarkan evolusi codebase.
   - **Alur**: Membandingkan diff/perubahan dari baseline terakhir (header dokumen atau `.opencode/markers/docs-sync.md`) -> panggil `explore` -> delegasikan ke `doc-updater` untuk menyematkan stempel header: `**Last Updated:** YYYY-MM-DD · Commit/Snapshot: <ref>`.

8. **`/init-deep`** *(Enhanced OmO Native Architecture)*
   - **Tujuan**: Inisialisasi basis pengetahuan hierarkis `AGENTS.md` proyek berstandar OmO native (root overview + modul leaf dengan skor 30 poin).
   - **Alur**:
     - Step 0: Dialog negosiasi penyimpanan (Lokal di `.git/info/exclude` vs Committed).
     - Step 1: Pre-calculation script cell (ukur total file, LOC, file hotspot >500 baris, hitung matriks skor 30-poin per direktori, dan tentukan `AGENTS_LOCATIONS` untuk score >= 12). Hard exclude `vendor/`, `node_modules/`, `build/`, `dist/`.
     - Step 2: Parallel Subtree Writers (dispatch agent paralel ke tiap subtree, mencatat LOC tiap file, method spesifik, gotchas, dan anti-patterns lokal).
     - Step 3: Root Synthesis (menyusun root `AGENTS.md` berbobot dari digest seluruh modul leaf).
     - Step 4: Storage Mode & Snapshot (`.opencode/init-deep.json`).
   - **Contoh Pakai**: `/init-deep`, `/init-deep --create-new`, `/init-deep --max-depth=4`.

9. **`/refactor-clean`** *(Modernized Lead Orchestrator)*
   - **Tujuan**: Pembersihan dead code dan konsolidasi logika duplikat dengan garansi zero-false-positive.
   - **Alur**: Analisis strict compiler (`tsc --noUnusedLocals` / `knip`) -> dispatch 2 subagent `explore` paralel (cari orphaned files & unreferenced exports) -> verifikasi referensi -> delegasikan pembersihan ke subagent `code-simplifier` berpedoman skill `remove-deadcode` dan `remove-ai-slops` -> verifikasi build & test.
   - **Contoh Pakai**: `/refactor-clean`, `/refactor-clean src/components/`.

10. **`/database-review`** *(Baru)*
    - **Tujuan**: Review database multi-engine (PostgreSQL/MySQL/SQLite/ClickHouse/MongoDB/DynamoDB/Redis + ORM) dengan deteksi engine fail-closed, review spesifik engine, proposal penamaan bisnis (proposal-only), dan migration safety.
    - **Alur**:
      - Phase 0: Engine & ORM Detection (scan `package.json` deps, `schema.prisma`, `drizzle.config.ts`, `settings.py`, `application.yml`, `alembic.ini`, `knexfile.*` -> engine matrix `{engine, orm, confidence, evidence file:line}`; sinyal nol/ambigu -> tanya user, DILARANG default Postgres).
      - Phase 1: Scope (`git diff --name-only HEAD` difilter ke migrations/schema/ORM/SQL; argumen: path | `--naming` | `--full-schema`).
      - Phase 2: Engine-specific review via `@database-reviewer` (dispatcher ber-modul) yang routing ke skill: postgres-patterns, mysql-patterns, clickhouse-io, redis-patterns, prisma-patterns, jpa-patterns, mybatis-patterns, kotlin-exposed-patterns, mongodb-patterns, dynamodb-patterns, database-migrations (SQLite inline). Setiap temuan WAJIB cite `file:line`.
      - Phase 3: Business naming & domain-fit (ekstrak kosakata codebase -> cek ubiquitous language + konvensi lokal + reserved words + length -> Rename Proposal Table; PROPOSAL-ONLY, never auto-apply).
      - Phase 4: Migration safety (`database-migrations`: expand-contract, concurrent index, batched backfill).
      - Phase 5: Structured report (engine coverage, findings by severity, rename proposals, out_of_scope eksplisit: Cassandra/Firestore/Neo4j).
    - **Contoh Pakai**: `/database-review`, `/database-review migrations/`, `/database-review --naming`, `/database-review --full-schema`.

### D. Frontend & Visual Engineering
11. **`/build-dashboard`** *(Baru)*
    - **Tujuan**: Orkestrasi 5-fase terpadu pembuatan dashboard analitik dari framing pertanyaan bisnis, inspeksi skema database, penentuan arah visual, penulisan kontrak desain dengan 10 state UI wajib, hingga handoff perencanaan & implementasi TDD.
    - **Alur**:
      - Phase 0: Business Question & KPI Framing (**HARD GATE**). Deteksi domain bisnis dari goal/user/konteks, muat skill domain ECC yang sesuai (`inventory-demand-planning`, `production-scheduling`, `logistics-exception-management`, `carrier-relationship-management`, `returns-reverse-logistics`, `customs-trade-compliance`, `quality-nonconformance`, `energy-procurement`, `customer-billing-ops`, `finance-billing-ops`, `market-research`, `people-analytics`, `retail-merchandising-analytics`, `insurance-operations-analytics`; fallback `dashboard-builder` + `product-lens`). Setiap metrik wajib menjawab: pertanyaan bisnis apa, keputusan apa yang berubah, siapa pemiliknya. Metrik tanpa ketiganya **ditolak** (vanity metric, cermin implementasi, tanpa pemilik).
      - Phase 1: Bounded Data Survey & Metric Feasibility (`omnisql` + `data-scientist` / probe dataset <25% RAM). Daftar metrik datang dari register Phase 0 — **bukan dari skema**; skema hanya menjawab "bisa dilayani atau tidak".
      - Phase 2: Design Direction & Tone Selection (`frontend-design-direction`; skip `design-system` pada greenfield; pilih **salah satu**: Recharts atau Tremor).
      - Phase 3: Design Contract Authoring with 10 UI States (`design-contract-system`, `docs/design/contracts/[FEATURE]-CONTRACT.md`, 10 state dikunci saat authoring).
      - Phase 4: Implementation Planning & Execution Handoff (`/plan` menerima kontrak beku -> verifikasi Momus -> TDD `frontend-patterns` -> audit grep post-hoc).
    - **Contoh Pakai**: `/build-dashboard warehouse-kpi`, `/build-dashboard "Sales and Inventory Analytics"`.

---

## 2b. Prasyarat Lingkungan & Lokasi Kanonik (Penting untuk Fresh Clone)

Beberapa komponen workflow tinggal di **konfigurasi user-global**, bukan di repo ini.
Di mesin ini semuanya berfungsi; di fresh clone atau CI, workflow yang bergantung pada
artefak global akan **degrade diam-diam** (command ditemukan, skill/agent tidak).

| Artefak | Lokasi kanonik | Di repo ini? |
| :--- | :--- | :--- |
| Skill global (OmO-ported: `git-master`, `debugging`, `remove-deadcode`, `remove-ai-slops`, `tech-debt-audit`, `init-deep`, `data-scientist`, `a11y`, `humanizer`, `humanizer-lint`, `design-contract-system`, `deep-research`) | `~/.config/opencode/skills/` | Tidak (kecuali `design-contract-system` & `deep-research`) |
| Command OpenCode (`.opencode/commands/`) + mirror global | `.opencode/commands/` dan `~/.config/opencode/commands/` | Ya (`.opencode/commands/`) |
| Prompt subagent | `.opencode/prompts/agents/` | Ya |
| Registrasi agent + batas tool | `.opencode/opencode.json` | Ya |
| **Model pin per-agent** | `~/.config/opencode/opencode.jsonc` | **Tidak** — user-local |
| Lima VM `ga-proof` + nerdctl | mesin host | Tidak |

Catatan lokasi:

- `~/.agents/skills/` adalah **root duplikat lama** (konvensi harness lain) yang **tidak**
  dibaca OpenCode v2 (`skills.paths` hanya `./skills` relatif terhadap `~/.config/opencode/`).
  Salinan `humanizer` di sana identik dengan salinan aktif; perlakukan
  `~/.config/opencode/skills/` sebagai sumber kebenaran.
- State file workflow disimpan dalam format Markdown murni di direktori
  `.opencode/markers/`: `.opencode/markers/code-review-quick.md` dan
  `.opencode/markers/docs-sync.md`. Desain ini bekerja seragam pada repositori
  Git maupun folder non-Git (seperti project client tanpa VCS). File marker ini
  diabaikan oleh git (`.gitignore`) dan aman di-regenerasi otomatis pada run berikutnya.

---

## 3. Katalog Subagent Custom (Spesialis Terisolasi)

Daftar spesialis yang terdaftar di konfigurasi OpenCode Anda dengan model yang telah dioptimasi (*pinned*).

> **Di mana pin tinggal:** model pin didefinisikan di `~/.config/opencode/opencode.jsonc` (konfigurasi user-local, bukan repo-tracked) dan di-merge ke definisi agent saat runtime. `.opencode/opencode.json` di repo hanya mendaftarkan prompt, mode, dan batas tool — tidak memuat `model`. Nama model di bawah adalah pin aktif per 2026-11-03; verifikasi terkini dengan `opencode debug agents`.

| Agent ID | Model Terpasang | Peran & Tugas Spesifik | Kapan Dipanggil? |
| :--- | :--- | :--- | :--- |
| **`architect`** | `step-5-preview` | Penasihat arsitektur dengan prinsip **Pragmatic Minimalism**. Menolak overengineering, membatasi output (maks 3 kalimat kesimpulan + maks 7 langkah aksi). | Saat bingung memilih arsitektur dasar ("Pilih X atau Y?"), merancang boundaries antar modul, atau refactoring besar. |
| **`docs-lookup`** *(Merged Librarian)* | `muse-spark-1.3-contributor` | Spesialis dokumentasi resmi (Context7 MCP), evaluasi package (lisensi, bundle size, breaking change), dan pencari contoh nyata di open-source (GitHub commit-hash permalinks). | Saat butuh sintaks resmi API, komparasi package npm/crates, atau melihat contoh kode riil dari repo publik. |
| **`explore`** | `muse-spark-1.3-contributor` | Agen pemeta kode cepat, read-only. Wajib 3+ parallel tool calls, menyajikan output bertag XML `<analysis>` dan `<results>` dengan path absolut. | Saat butuh mencari letak file, menelusuri alur pemanggilan fungsi, atau memetakan perubahan diff. |
| **`planner`** | `step-5-preview` | Perancang implementasi step-by-step. Menerapkan intent routing (CLEAR vs UNCLEAR), mode sticky plan, menulis langsung ke `docs/plans/<slug>.plan.md`. | Saat fitur baru butuh dipecah menjadi tahapan eksekusi yang aman sebelum kode ditulis. |
| **`plan-reviewer`** *(Momus)* | `step-5-preview` | Penguji validitas rencana implementasi. Memverifikasi langsung ke disk apakah file, symbol, dan script yang disebut di `.plan.md` benar-benar ada. Memberi vonis `APPROVE` atau `REQUEST_CHANGES`. | Tepat setelah `planner` selesai membuat file `.plan.md`, sebelum pengerjaan kode dimulai. |
| **`security-reviewer`** | `step-5-preview` | Auditor keamanan kode dengan PoC Gate (dilarang memberi severity tanpa attack path konkret) dan pemeriksa CVE dependensi via `docs-lookup`. | Dipanggil oleh `/security` atau setelah mengubah endpoint/auth flow sensitif. |
| **`security-hunter`** | `muse-spark-1.3-contributor` | Pemburu kerentanan adversarial terisolasi untuk `/security-audit`. Bekerja per unit cakupan dan menyusun proposal PoC sandbox. | Dipanggil secara paralel oleh orchestrator `/security-audit` pada Phase 2. |
| **`security-verifier`** | `step-5-preview` | Penguji independen yang bertugas **menggugurkan/memfalsifikasi** temuan hunter, mengeksekusi PoC di sandbox Lima, atau bertindak sebagai coverage critic. | Dipanggil oleh orchestrator `/security-audit` pada Phase 2 (critic) dan Phase 3/5 (verifier). |
| **`multimodal-looker`** | `muse-spark-1.3-contributor` | Analis visual untuk screenshot, mockup UI, dan PDF. Mengekstrak hierarki layout, palet warna, tipografi, dan state komponen. | Dipanggil saat mengonversi mockup gambar/desain ke token atau kode frontend. |
| **Review Specialists** | `step-5-preview` / `muse-spark-1.3-contributor` | - `silent-failure-hunter`: Menemukan exception yang ditelan.<br>- `pr-test-analyzer`: Menilai cakupan behavioral test.<br>- `type-design-analyzer`: Menilai enkapsulasi tipe.<br>- `code-simplifier`: Menyederhanakan kode tanpa ubah perilaku (satu-satunya reviewer ber-`write`/`edit`).<br>- `comment-analyzer`: Mendeteksi comment rot. | Digunakan saat review PR mendalam (`/review-pr`). |

### Batas Tool: Apa yang Di-enforce vs Apa yang Hanya Janji Prompt

Batas tool di `.opencode/opencode.json` bersifat **allow/deny per tool**, bukan per
command — tidak ada allowlist perintah. Karena itu:

- **Di-enforce mekanis**: semua reviewer kecuali `code-simplifier` ber-
  `write: false, edit: false`; `intent-gate`, `explore`, dan `multimodal-looker`
  read-only (`bash: false` untuk intent-gate & multimodal-looker).
- **Hanya janji prompt (residual escape hatch)**: `security-hunter` dan
  `security-verifier` memegang `bash: true` karena keduanya perlu **memanggil
  `lima-sandbox-runner.sh`** untuk eksekusi PoC terisolasi. Prompt melarang
  eksekusi kode target di host, dan runner menolak token approval yang tidak
  cocok payload digest — tetapi `bash: true` secara teknis memungkinkan agent
  tersebut menjalankan perintah host lain. Perlakukan ini sebagai batas yang
  diketahui, bukan sebagai isolasi yang tergaransi.

---

## 3b. Protokol Gate: intent-gate → build

Setiap request substantif (fitur, bugfix, refactor, planning, ops) melewati gate
dua tahap sebelum kode ditulis:

1. **`intent-gate`** (subagent read-only, tanpa `bash`/`write`/`edit`)
   mengklasifikasi pesan menjadi INTENT / TYPE / CLARITY / FORKS / ASSUMPTIONS.
   Dispatch bersifat **eksklusif**: tidak ada subagent lain berjalan paralel
   dengannya, agar eksplorasi tidak terbuang bila gate menemukan fork yang
   butuh keputusan pemilik.
2. **`build`** (main agent) mengeksekusi hanya setelah fork resolve; fork yang
   dilewati resolve ke default yang tercatat.

Log keputusan gate ditulis ke `.antigravity/intent-gate.log` dan
`.opencode/intent-gate.log` agar sesi baru dapat melanjutkan dari intent yang
diketahui.

---

## 4. Katalog Skill Kunci (Domain Knowledge & SOP)

Skill memberikan pengetahuan dan metodologi yang dimuat ke dalam memori agent saat topik tertentu aktif:

1. **`design-contract-system`** *(Baru)*
   - **Fungsi**: Ekstraksi token visual dari mockup/gambar/HTML menjadi arsitektur token modular di `docs/design/` (BRAND, STANDARDS, THEME, TOKEN-MAP, TYPOGRAPHY-MAP, STATES-MATRIX) dan kontrak per-halaman anti-slop.
   - **Kapan Aktif**: Saat mendesain antarmuka baru, merapikan inkonsistensi styling UI, atau mengonversi visual mockup.

2. **`deep-research`** *(Enhanced)*
   - **Fungsi**: Metodologi riset mendalam berbasis triangulasi minimal 3 sumber independen, anti-halusinasi, dan grounding ke konteks arsitektur lokal proyek.

3. **`git-master`** *(Ported OmO)*
   - **Fungsi**: Prosedur standar operasi git tingkat lanjut: atomic commits (hunk-level), rebase interaktif aman, pemulihan reflog, dan pelacakan riwayat commit (`log -S`, `blame`, `bisect`).

4. **`debugging`** *(Ported OmO)*
   - **Fungsi**: Siklus 10-fase hipotesis sistematis untuk bug rumit, memory leak, hang, atau race condition, lengkap dengan isolasi feedback loop dan penguncian bukti dengan failing regression test.

5. **`remove-ai-slops`** *(Ported OmO)*
   - **Fungsi**: Pembersihan kode dari "aroma AI" (anti-patterns seperti tautological test yang selalu true, test yang meniru persis implementasi, kompleksitas arsitektur palsu).

6. **`remove-deadcode`** *(Ported OmO)*
   - **Fungsi**: Pembersihan dead code yang diverifikasi secara presisi via compiler/LSP dan konsolidasi kode duplikat tanpa merusak perilaku runtime.

7. **`tech-debt-audit`** *(Ported OmO)*
   - **Fungsi**: Audit kesehatan codebase melintasi 9 dimensi teknis menggunakan AST-grep (tree-sitter) dan menghasilkan `TECH_DEBT_AUDIT.md`.

8. **`a11y`** *(Consolidated)*
   - **Fungsi**: Standardisasi aksesibilitas komprehensif melintasi 3 pilar: automated scanning (WCAG 2.2 AA), prinsip POUR cross-platform (Web, iOS, Android), dan implementasi komponen ramah keyboard & screen-reader.

9. **`humanizer` & `humanizer-lint`**
   - **Fungsi**: Linter dan panduan penulisan prosa/copywriting agar tidak terkesan kaku, staged, atau menggunakan pola klise AI (menghilangkan staged openers, forced triads, klaim berlebihan).

10. **`frontend-scaffold`** *(Baru)*
    - **Fungsi**: Menjembatani kontrak desain beku (DESIGN.md + docs/design/ + page CONTRACT.md) menjadi skeleton frontend yang berjalan — struktur project, token ter-wire, page shells dengan 10 system state, serta routing image generation (default cloudflare-workers-ai) dan animasi (motion/react untuk in-app, Remotion untuk video file).
    - **Kapan Aktif**: Saat implementasi frontend dimulai dari kontrak `design-contract-system`, atau saat butuh skeleton baru yang konsisten dengan design system yang sudah ada.

11. **Keluarga Skill Domain Bisnis** *(Vocabulary KPI untuk dashboard)*
    - **Fungsi**: Memberi kosakata metrik bisnis nyata — definisi KPI, formula, ambang tindak, dan kesalahan interpretasi umum per domain. Dipakai `/build-dashboard` Phase 0 untuk menentukan **data apa yang layak ditampilkan**, bukan sekadar apa yang tersedia di skema.
    - **Dispatch domain** (dipakai juga sebagai tabel di `commands/build-dashboard.md` Phase 0):
      `inventory-demand-planning` (stok, reorder, safety stock, forecast accuracy) · `production-scheduling` (OEE, schedule adherence, changeover, bottleneck) · `logistics-exception-management` (exception aging, claim win rate, on-time delivery) · `carrier-relationship-management` (cost per lane, tender acceptance, carrier scorecard) · `returns-reverse-logistics` (return rate, disposition mix, recovery value) · `customs-trade-compliance` (duty savings, entry rejection, landed cost) · `quality-nonconformance` (defect PPM, CAPA closure, first-pass yield) · `energy-procurement` (load factor, demand-charge exposure, $/kWh) · `customer-billing-ops` (MRR/ARR, churn, dunning recovery) · `finance-billing-ops` (net revenue, gross margin, AR aging) · `market-research` (TAM/SAM, share of voice, win rate) · `people-analytics` (regretted attrition by cohort, time to fill, compa-ratio, pay-equity gap) · `retail-merchandising-analytics` (sell-through, GMROI, weeks of supply, markdown cadence, margin erosion) · `insurance-operations-analytics` (combined ratio, loss ratio by accident year, severity median/P90, leakage, concentration).
    - **Fallback lintas domain**: `dashboard-builder` (empat pertanyaan operator: health, performance, throughput, saturation) + `product-lens`.
    - **Cara menambah domain**: riset dulu (lihat `docs/research/business-domain-skills.md`), lalu buat skill ECC baru hanya untuk gap yang belum dicover. Skill baru wajib melewati wiring penuh: `package.json` `files`, `manifests/install-modules.json`, `agent.yaml`, `npm run catalog:sync`, salinan `.agents/skills/<nama>/SKILL.md` + `.agents/skills/<nama>/agents/openai.yaml` (frontmatter Codex sengaja dipangkas — lihat catatan di dokumen riset).

---

## 5. Panduan Praktis: Skenario Alur Kerja (End-to-End)

### Skenario 1: Membangun Fitur Baru yang Kompleks
1. **Langkah 1 (Riset & Keputusan Desain)**:
   - Jika belum tahu library apa yang harus dipakai: Panggil **`docs-lookup`** (misal: *"Library apa yang paling stabil untuk background jobs di Bun?"*).
   - Jika butuh keputusan batas modul & trade-off arsitektur: Panggil **`architect`** (misal: *"Bagaimana struktur modul antrean kita agar tidak overengineered?"*).
2. **Langkah 2 (Perencanaan)**:
   - Jalankan command **`/plan <nama-fitur>`**.
   - Subagent `planner` akan menulis `docs/plans/<slug>.plan.md`.
3. **Langkah 3 (Verifikasi Rencana)**:
   - Jalankan subagent **`plan-reviewer`** (Momus) untuk memastikan semua file/fungsi yang dirujuk rencana memang ada di disk.
4. **Langkah 4 (Implementasi TDD)**:
   - Jalankan command **`/tdd`** untuk mengeksekusi tahapan implementasi berpedoman test-first (RED -> GREEN -> REFACTOR).
5. **Langkah 5 (Review & Commit)**:
   - Jalankan command **`/code-review-quick`** untuk memastikan kode bersih dari smell dan slop.
   - Gunakan skill **`git-master`** untuk membuat atomic commit yang terstruktur rapi.

---

### Skenario 2: Audit Penetrasi & Keamanan Sebelum Rilis
1. **Langkah 1 (Audit Konfigurasi AI)**:
   - Jalankan **`/security-scan`** untuk memastikan file `.claude/` atau config agent tidak membocorkan credential dan tidak ada permissions berbahaya.
2. **Langkah 2 (Audit Celah Kode Mendalam)**:
   - Jalankan **`/security-audit`** (atau `/security-audit --profile quick`).
   - Orchestrator memetakan arsitektur (`explore`), memburu celah secara paralel (`security-hunter`), dan mengujinya secara adversarial (`security-verifier`).
3. **Langkah 3 (Validasi PoC di Sandbox)**:
   - Jika verifier menemukan indikasi celah, sistem menampilkan payload PoC dan meminta konfirmasi Anda untuk menjalankannya di dalam container Lima `ga-proof`.
   - Jika Anda menolak atau VM mati, temuan dicatat aman di `NEEDS-VALIDATION.md`.
   - Jika terbukti lolos eksploitasi, temuan dicatat di `FINDINGS-DETAIL.md` lengkap dengan patch perbaikan terkecil.

---

### Skenario 3: Membangun UI Baru dari Mockup Desain
1. **Langkah 1 (Ekstraksi Token Desain)**:
   - Berikan screenshot/mockup ke subagent **`multimodal-looker`** dengan instruksi skill **`design-contract-system`**.
   - Sistem akan menyusun `docs/design/` (BRAND, STANDARDS, THEME, TOKEN-MAP, STATES-MATRIX).
2. **Langkah 2 (Implementasi Kontrak Halaman)**:
   - Bangun komponen UI mengacu pada `page-contract.md` yang memastikan 10 state wajib antarmuka terpenuhi tanpa styling slop.
3. **Langkah 3 (Validasi Aksesibilitas)**:
   - Gunakan skill **`a11y`** untuk memvalidasi kontras warna, keyboard navigation, dan atribut ARIA.

---

### Skenario 4: Pembersihan Dead Code & Konsolidasi Duplikat
1. **Langkah 1 (Deteksi & Verifikasi)**:
   - Jalankan **`/refactor-clean`** (atau `/refactor-clean src/`).
   - Sistem memindai via strict compiler (`tsc --noUnusedLocals`) dan menjalankan subagent `explore` paralel untuk mendeteksi orphaned files dan unreferenced exports.
2. **Langkah 2 (Pembersihan Aman)**:
   - Subagent **`code-simplifier`** menghapus dead code sesuai urutan aman berpedoman skill **`remove-deadcode`** dan **`remove-ai-slops`**, lalu menyatukan kode duplikat ke utility bersama.
3. **Langkah 3 (Verifikasi Akhir)**:
   - Build dan unit test dijalankan untuk memastikan nol regresi perilaku runtime.

---

### Skenario 5: Membangun Dashboard Analitik Terpadu dari Database
1. **Langkah 1 (Framing Pertanyaan Bisnis — HARD GATE)**:
   - Jalankan **`/build-dashboard <nama-fitur>`**.
   - Sistem mengidentifikasi domain bisnis dan memuat skill domain yang sesuai (`inventory-demand-planning` untuk stok/reorder, `logistics-exception-management` untuk pengiriman/klaim, `customer-billing-ops` untuk langganan/churn, dan seterusnya).
   - Setiap metrik wajib menjawab tiga pertanyaan: pertanyaan bisnis apa yang dijawab, keputusan apa yang berubah saat angkanya bergerak, dan siapa pemiliknya. Metrik yang gagal **ditolak** dan tidak ditampilkan.
2. **Langkah 2 (Survei Data & Kelayakan Metrik)**:
   - Inspeksi schema via `omnisql` (atau DuckDB untuk flat files), pastikan dataset <25% RAM.
   - Daftar metrik berasal dari register Langkah 1 — skema hanya memverifikasi bahwa tiap metrik bisa dilayani oleh 1 query SQL terukur.
3. **Langkah 3 (Arah Visual & Pemilihan Library Chart)**:
   - Menentukan tone/estetika via `frontend-design-direction` (skip `design-system` pada greenfield untuk cegah duplikasi token).
   - Memilih **salah satu**: Recharts (untuk custom CSS variables) atau Tremor (komponen cepat siap pakai); larangan keras mengimpor keduanya bersamaan.
4. **Langkah 4 (Penyusunan Kontrak Desain 10 State)**:
   - Mengisi `docs/design/contracts/[FEATURE]-CONTRACT.md` berpedoman `design-contract-system`.
   - Mengunci solusi UI untuk ke-10 mandatory system states (Loading Skeleton, Empty State, No Search Result, Error State, No Internet, dsb.) di Section 4 saat penyusunan kontrak (bukan saat audit).
5. **Langkah 5 (Perencanaan & Implementasi TDD)**:
   - Kontrak beku diserahkan ke `/plan` (`planner`) dan divalidasi Momus (`plan-reviewer`).
   - Implementasi komponen UI dan data fetching hooks via `tdd-workflow` & `frontend-patterns`.
   - Audit diff via grep kanonik `design-contract-system` untuk menjamin nol hardcoded hex, radius acak, atau spacing non-4px.

---
---

## 6. Workspace `.ecc-opl/` — satu work item, satu laporan

Semua workflow ECC-OPL membaca/menulis artifact kerja lewat satu direktori proyek: `.ecc-opl/`.

```
.ecc-opl/
  active                 # id work item yang sedang aktif (teks biasa, satu baris)
  work-items/<WI-ID>/    # manifest.json, progress.json, timeline.jsonl + research/ prd/ plan/
                         # implementation/ review/ design/ e2e/ audit/ documentation/ evidence/ canvas/
  runtime/               # pointer handoff antar-runtime (lokal, tidak di-track)
  archive/<WI-ID>/       # hasil `archive`
  reports/<WI-ID>.md     # SATU laporan final per work item (di-track)
```

**Binding.** Presedensi: `--standalone` > `ECC_OPL_STANDALONE=1` > `--work-item <id>` >
exact `TASK_SLUG` match > item baru. Default bukan lagi "standalone": setiap workflow mengikat
identitas task-nya sendiri lewat `node "$WI" bind --slug "$TASK_SLUG"` — item yang slug-nya sama
di-resume, objektif berbeda membuat item baru, dan item yang aktif terakhir tidak dipakai sebagai
tebakan. Pointer absen bukan opt-out; legacy path hanya berlaku lewat dua flag eksplisit di atas.
`bind --id` pada item `closed` otomatis membukanya kembali (`reopen`).

**Helper.** `scripts/lib/work-item/work-item.js`
(`bind|resolve|append|progress|close|reopen|archive`; `ensure` = alias `bind`).
Dicari di `$CLAUDE_PLUGIN_ROOT`, `${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}`, `./.agents`,
`.`, `${CLAUDE_CONFIG_DIR:-$HOME/.claude}`. Bila tidak ketemu: mode standalone dengan satu baris
pemberitahuan — tidak pernah menulis `.ecc-opl/` dari inline heredoc.
`resolve --id <unknown>` keluar dengan kode 1, bukan mencetak `none`, jadi preamble tidak bisa
salah menganggap binding gagal sebagai sukses. `archive` menolak item yang belum `closed`,
memindai `archive/` saat membuat ID baru (identitas tidak pernah dipakai ulang), dan menyimpan
referensi artifact eksternal di `archive/index.json`.
Helper ini CommonJS: bila disalin manual ke proyek ber-`"type": "module"` di `package.json`,
sertakan juga `scripts/lib/work-item/package.json` dan `scripts/lib/state-store/package.json`
(isi `{"type":"commonjs"}`), kalau tidak Node menganggap `.js` sebagai ESM dan gagal dengan
`require is not defined`.

**Otoritas eksekusi tidak berubah.** `.opencode/workflows/active.json` tetap satu-satunya state
eksekusi (workflow/phase/gates). `progress.json` hanya indeks turunan dari `timeline.jsonl` dan
selalu bisa dibangun ulang. `.opencode/markers/` tetap baseline inkremental.

**Event.** `append` menerima `--run`, `--revision`, `--outcome`
(`pass|fail|blocked|pending_approval|skipped|incomplete`), `--evidence`, dan `--note` bebas.
`progress.json` menurunkan `outcomes`, `runs`, `blockers`, `pendingApprovals`, `nextActions`;
completion tidak pernah disimpulkan dari keberadaan artifact atau jumlah event, dan event lama
tidak ditimpa run berikutnya (timeline append-only).

**PRD & plan routing.** `plan-prd` menulis ke `.ecc-opl/work-items/<ITEM>/prd/`; `/plan` hanya
mengonsumsi PRD berstatus `APPROVED` (atau draft yang disebut owner secara eksplisit), dan `tdd`
hanya mengonsumsi plan yang sudah disetujui. Draft yang tidak terkait atau belum disetujui tidak
pernah dikonsumsi otomatis.

**Git.** Hanya `reports/` yang di-track; manifest, progress, timeline, working docs, approvals,
evidence, runtime, dan artifact arsip di-ignore. `bind` menulis `.ecc-opl/.gitignore` bila proyek
ber-git; `--ignore-mode local` menulis aturan yang sama ke `.git/info/exclude`, `--ignore-mode none`
tidak menulis apa pun. Tidak ada commit/push otomatis dari workflow mana pun.

**Laporan final.** `.ecc-opl/reports/<WI-ID>.md`, nama file stabil (id sudah memuat slug).
Field wajib: `deliveryStatus` (COMPLETED | COMPLETED_WITH_LIMITATIONS | BLOCKED |
PARTIALLY_COMPLETED | CANCELLED) dan `verificationStatus` (VERIFIED | PARTIAL | UNVERIFIED |
BLOCKED | NOT_RUN | NOT_SUPPORTED). Bagian yang tidak relevan dihilangkan, bukan diisi placeholder.

**Runtime.** OpenCode dan Antigravity CLI berbagi artifact yang sama tetapi kepemilikan eksekusi
terpisah: `runtime/opencode.json` / `runtime/antigravity.json` hanya mencatat runtime mana yang
memegang eksekusi berjalan. Itu pointer, bukan gate. Handoff selalu eksplisit.

**Migrasi.** Tidak ada yang dipindah. Path legacy (`docs/plans/`, `docs/research/`,
`docs/design/`, `docs/releases/*/*.tdd.md`, `.claude/prds/`) tetap terbaca sebagai arsip.
Urutan lookup plan: argumen eksplisit → `plan_ref.path` di state file → `plan/` work item →
legacy. Rollback Stage 1 lewat `git revert`; setelah `reports/` di-track, revert `.gitignore`
saja tidak menyembunyikan file yang sudah ter-track.

---

*Dokumen ini diperbarui secara lokal di `docs/CUSTOM-WORKFLOW.md` sebagai referensi standar tim pengembang.*
