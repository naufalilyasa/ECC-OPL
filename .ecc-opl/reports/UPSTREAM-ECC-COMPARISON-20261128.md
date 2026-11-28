# Upstream ECC vs ECC-OPL — Perbandingan 2026-11-28

## Fakta divergensi

| Item | Nilai |
|---|---|
| Fork point (merge-base) | `b38be6a7` — "Merge pull request #3809" |
| Upstream HEAD | `4adeee67` (`affaan-m/ECC` main, 2026-11-19) |
| Commit upstream setelah fork | 853 |
| Commit lokal setelah fork | 87 |
| `VERSION` kedua sisi | 2.2.3 |
| Fast-forward mungkin? | Tidak. `583f22b9` bukan ancestor `upstream/main`, jadi hanya bisa reset (destruktif) atau merge/cherry-pick |
| File upstream | 4.951 |
| File lokal | 5.129 |
| File berubah di kedua sisi | 52 |

Branch `upstream-tracking` dibuat dari `refs/remotes/upstream/main` untuk diff. Tidak ada satu pun file lokal yang ditimpa.

## Yang layak diambil dari upstream

Urut dari nilai tertinggi untuk konfigurasi Anda (OpenCode + Antigravity + Claude).

### 1. Dukungan Antigravity — HIGH

Anda memakai Antigravity, dan upstream sudah punya adapter yang belum ada di ecc-opl:

- `scripts/antigravity/hook-bridge.js`
- `scripts/hooks/antigravity-hook-bridge.js`
- `scripts/lib/antigravity-cli-bootstrap.js`
- `scripts/lib/antigravity-hooks.js`
- `scripts/lib/antigravity-mcp.js`
- `scripts/lib/antigravity-plugin.js`
- `scripts/lib/install-targets/antigravity-home.js`
- `hooks/antigravity-hooks.json`

Nilai: jalur install + hook untuk Antigravity, bukan sekadar proyeksi file. Ambil utuh, lalu sesuaikan `manifests/install-modules.json`.

### 2. Verifikasi work item — HIGH

- `scripts/lib/work-item-verification.js`

Kontrak verifikasi artifact (`harness-adapter-documentation/v1`) dengan digest SHA-256, whitelist status, batas ukuran, dan path traversal guard. Ini melengkapi `scripts/lib/work-item/work-item.js` milik ecc-opl dan langsung menyentuh alur UWW yang sedang dipakai. Ambil file + test-nya.

### 3. Validator baru — MEDIUM

- `scripts/ci/skill-references.js` — cek referensi skill antar-file
- `scripts/ci/check-spec-freshness.js`
- `scripts/ci/evaluate-context-routing.js`

Berguna karena repo ini baru saja memangkas 96 command; validator referensi skill akan menangkap sisa rujukan mati.

### 4. UI Canvas — MEDIUM

- `commands/ui-canvas.md`
- `scripts/ui-canvas.js`
- `scripts/lib/ui-canvas/{delivery,editor,editor-gestures,feedback,fields,inspector,server-routes,ui,ui-css}.js`
- `skills/ui-canvas/`

Upstream mempertahankan `plan-canvas` **dan** menambah `ui-canvas`. Jadi ini bukan pengganti; ia kanvas generik yang lebih luas. Ambil hanya jika Anda butuh kanvas di luar artefak plan.

### 5. Ketahanan hook dan konteks — MEDIUM

- `scripts/hooks/context-gate.js`
- `scripts/hooks/hook-watchdog.js`
- `scripts/lib/context-gate-state.js`
- `scripts/lib/context-neighbors.js`
- `scripts/lib/hooks/recovery-hints.js`

### 6. Config health — MEDIUM

- `scripts/config-health.py` + `config_health_{constants,paths,scan}.py`
- `manifests/install-assets/config-health-hooks.json`
- `skills/config-health/`

### 7. Runtime plugin OpenCode — LOW/MEDIUM

- `.opencode/plugins/lib/ecc-runtime.ts`
- `.opencode/plugins/lib/ecc-runtime-support.ts`

Rekan `.opencode` yang Anda pakai; perlu disesuaikan dengan plugin lokal yang sudah ada.

### 8. Skill baru — selektif

15 skill baru di upstream. Yang relevan untuk repo ini: `terraform-patterns`, `rails-security`, `web-perimeter-owasp-2025-audit`, `config-health`, `ui-canvas`. Sisanya niche dan sebaiknya dilewati: `godot-patterns`, `godot-testing`, `yoruba-localization-testing`, `roundhouse-x402`, `leanrea`, `platform-factory`, `short-video-distribution`, `scientific-db-openalex-database`, `devfleet`, `ecc-contribution-review`.

## Yang sebaiknya dilewati

- `scripts/grok-install.js`, `scripts/lib/grok-harness-adapter.js`, `scripts/lib/grok-source-identity.js`, `scripts/lib/install-targets/grok-home.js`, `scripts/ci/validate-grok-pin.js` — harness Grok, tidak dipakai.
- `scripts/lib/install-targets/mistral-vibe-project.js` — tidak dipakai.
- `agents/gdscript-reviewer.md` — hanya untuk Godot.
- 94 command upstream yang tidak ada di sini — semuanya justru yang baru dipangkas. Mengambilnya membatalkan pruning.
- 120 file `.agents/skills/` + 66 `.kiro/agents` + 39 `.cursor/rules` — proyeksi harness yang sudah Anda minta dihapus.

## Yang wajib dipertahankan dari sisi lokal

- 1.151 file di `skills/` (upstream hanya 660) — versi lokal lebih dalam, banyak `references/` dan `examples/`.
- `.ecc-opl/work-items/**` — riwayat UWW dan approval artifact.
- `scripts/lib/work-item/**`, `scripts/work-items.js` — implementasi work item lokal.
- `scripts/lib/plan-canvas/**` + runtime kanvas yang sudah jalan.
- `.guardian-angel/**` — hook pengaman lokal.
- `docs/e2e-v2/**` — bukti E2E yang belum ada di upstream.

## Permukaan konflik (52 file)

File yang berubah di kedua sisi, yaitu kandidat `git cherry-pick` paling langsung: 9 di `scripts/`, 5 di `docs/`, 4 di `tests/`, 4 di `.agents/skills/`, 3 di `schemas/`, 3 di `manifests/`, plus `yarn.lock`, `SOUL.md`, dan sisanya di `.kiro/`.

## Rekomendasi urutan pengambilan

1. `scripts/lib/work-item-verification.js` + test — paling kecil risikonya, paling relevan.
2. Adapter Antigravity (8 file) — Anda memakainya setiap hari.
3. `scripts/ci/skill-references.js` lalu jalankan; ini memverifikasi sisa pruning.
4. Config health + validator lain.
5. `ui-canvas` hanya jika ada kebutuhan nyata.
6. Skill selektif (terraform, rails-security, owasp-2025).

Jangan merge `upstream/main` utuh: 853 commit akan mengembalikan 94 command, seluruh proyeksi `.agents`/`.kiro`/`.cursor`, dan menimpa 52 file yang kita ubah.

## Catatan

Perbandingan berbasis `git ls-tree` dan `git diff` antar-branch; tidak ada eksekusi kode upstream.
