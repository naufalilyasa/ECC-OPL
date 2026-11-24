# E2E V2.0 — Unified Journey Mapping & Execution (R1)

## 1. Konteks Produk

- **Masalah**: Terdapat dua perintah publik E2E — `/e2e-map` (discovery statis, pemetaan perjalanan, usulan registry, tanpa eksekusi) dan `/e2e` (lookup registry, delegasi ke `e2e-runner`, eksekusi Playwright, pembaruan registry). Keduanya harus dipelajari dan dipertahankan secara terpisah. Perilaku lama yang berbahaya tetap ada: `/e2e` mengizinkan eksekusi alur tidak terdaftar hanya dengan catatan advisory, dan `/e2e-map` memakai `stale` sebagai `State` yang bertentangan dengan enum registry terkontrol. Penurunan jumlah perintah publik tidak boleh menyembunyikan eksekusi otomatis, melemahkan tata kelola registry, atau menurunkan bukti cakupan.
- **Bukti**: Empat komponen sumber aktual memiliki hash identik dengan ekspor audit historis (`08b17f2c…`, `76b3d403…`, `94811f4b…`, `d7442445…`); salinan canonical dan global byte-identik. Tidak ada `TESTS.md` atau `.governance/docs-map.json` di repo ECC yang diperiksa. Rincian di `SOURCE-BASELINE.md`.
- **Pengguna target**:
  - **Primer**: engineer/produk yang membutuhkan cakupan E2E untuk alur kritis, dengan mode read-only untuk inspeksi dan mode eksekusi yang disengaja.
  - **Eksklusi**: agen/CI yang mengharapkan eksekusi browser tersembunyi dari perintah tanpa argumen; konsumen yang mengira `TESTS.md` adalah sumber perintah shell.
- **Tujuan & target terukur**:

| Metrik | Baseline | Target | Cara diukur |
|---|---|---|---|
| Perintah publik E2E default | 2 (`/e2e`, `/e2e-map`) | 1 (`/e2e`) setelah parity & deployment authorization DEC-10 | command discovery audit |
| Pemisahan fase map/run | Tidak eksplisit dalam satu antarmuka | `map`/`status` tidak pernah menjalankan browser; `run`/`full` saja | 48 skenario + 14 mutasi negatif |
| Registry-first execution | Tidak; tidak terdaftar masih dieksekusi | `run` tanpa `--ad-hoc` menghasilkan `REGISTRY_REQUIRED` | C02 |
| Bukti `covered` | Laporan agent browser berpotensi mencakupi | Harus spec Playwright persisten + CLI/test node/exit/evidence terverifikasi | C04, C05, C10, C12 |
| Stabilitas ID registry | Aturan concurrency belum kuat | ID unik, tidak reuse, konflik ditolak tanpa overwrite | B09, B12 |

## 2. Ruang Lingkup & Batasan

- **Scope MVP**: satu antarmuka publik `/e2e` dengan mode `map`, `run`, `full`, `status`, `help`, no-args preview; fase mapping dan execution terpisah secara internal; `TESTS.md` registry tunggal; `e2e-runner` spesialis eksekusi; approval gate, target non-produksi, dan bukti Playwright persisten.
- **Future scope**: CI automation (DEC-11), perluasan fixture lintas-stack, opsi run authority lain setelah owner menyetujui.
- **Non-goal**: audit rationalization skill/agent/command global; regenerate `TESTS.md`; database/MCP/plugin baru; modifikasi workflow frozen; auto-install dependency/browser; klaim cakupan 100% dari enumerasi rute.
- **Trade-off**: jumlah perintah dikurangi, fase dan gate dibuat lebih eksplisit. Kompatibilitas `/e2e-map` sementara dan reversible.

## 3. Aktor & Izin

| Aktor | Tindakan yang diizinkan | Visibilitas data | Batasan |
|---|---|---|---|
| Pemilik sesi | Memilih mode, menyetujui diff registry, menyetujui target eksekusi | Registry, source, bukti teredaksi | Tidak dapat mengabaikan Guardian Angel atau approval gate |
| Main `/e2e` | Parse argumen, resolusi target, orkestrasi fase, rekonsiliasi registry | Source project, registry, manifest bukti | Tidak menjalankan browser pada `map`/`status`; tidak menulis registry tanpa approval |
| Mapping phase (internal) | Discovery source statis, journey model, diff registry | Source dan registry | Tidak eksekusi browser; tidak menulis registry tanpa approval |
| `e2e-runner` | Menghasilkan spec cakupan, menjalankan Playwright yang disetujui, mengembalikan bukti | Spec/fixture/artifact dalam project | Tidak auto-install; tidak produksi; tidak menyembunyikan gagal via skip/fixme |
| Guardian Angel / guard runtime | Menegakkan kebijakan independen | Sesuai konfigurasi runtime | Tidak boleh dilewati workflow |

## 4. Persyaratan Fungsional

Status 요구 berikut memisahkan **arsitektur yang sudah disetujui** dari **keputusan implementasi**, **otorisasi environment**, dan **otorisasi deployment**. `Gated` berarti requirement tetap berlaku sebagai kontrak, tetapi aktivasi atau bentuk finalnya menunggu keputusan yang disebut; ini tidak membatalkan prinsip arsitektur.

| ID | Persyaratan | Status (R1) | Dasar / gate | Acceptance |
|---|---|---|---|---|
| E2E-FR-001 | Satu perintah publik `/e2e` dengan mode `map`, `run`, `full`, `status`, `help`, no-args preview | Effective — architecture | DEC-01/02 confirmed | AC-001 |
| E2E-FR-002 | `map` discovery statis + usulan diff registry tanpa eksekusi browser | Effective — architecture | ADR-E2E-006 | AC-002 |
| E2E-FR-003 | `status` dan no-args read-only; tidak membuat `TESTS.md` | Effective — architecture | ADR-E2E-013 | AC-003, AC-004 |
| E2E-FR-004 | Resolusi target: ID eksak → judul unik → rute; ambiguitas menampilkan kandidat | Effective — architecture | §4.3 | AC-005 |
| E2E-FR-005 | `run` hanya entry terdaftar; tidak ditemukan → `REGISTRY_REQUIRED` | Effective — architecture | ADR-E2E-007 | AC-006 |
| E2E-FR-006 | `run --ad-hoc` eksplisit, berlabel tidak terdaftar, tidak menambah cakupan | Gated — technical DEC-05 | ADR-E2E-008 confirmed; owner dapat menolak mode ad-hoc | AC-007 |
| E2E-FR-007 | `full` mengikuti urutan discovery → review → registry → generate → run → evidence | Effective — architecture | ADR-E2E-002 | AC-008 |
| E2E-FR-008 | `TESTS.md` mempertahankan Section 2 dan Section 4 serta field lama | Effective — architecture | ADR-E2E-004 | AC-009 |
| E2E-FR-009 | ID baru mengikuti maksimum numerik aktual; tidak reuse/renumber | Effective — architecture | §7.4 | AC-009 |
| E2E-FR-010 | `stale` adalah klasifikasi assessment, bukan `State` registry | Effective — architecture | Observasi 4; migrasi baris lama gated DEC-12 | AC-010 |
| E2E-FR-011 | Eksekusi hanya pada target non-produksi yang disetujui dengan fixture aman | Effective rule; gated — environment DEC-07 | ADR-E2E-009; otorisasi per-environment masih pending | AC-011 |
| E2E-FR-012 | `covered` mensyaratkan assertions perilaku dan bukti eksekusi Playwright persisten | Effective — architecture, **not provisional** | ADR-E2E-010/012; DEC-08 **confirmed** | AC-012, AC-013 |
| E2E-FR-013 | Runner mengembalikan minimal test_id, judul node, spec hash, CLI aktual, exit, environment, artifact, redaksi | Effective — evidence contract | ADR-E2E-012 | AC-014 |
| E2E-FR-014 | Registry diperbarui hanya blok yang cocok dan hanya field yang diizinkan | Effective — registry contract | §9.2; mutasi file aktual gated DEC-06 | AC-015 |
| E2E-FR-015 | Konflik tulis registry dideteksi; proposal di-rebase tanpa overwrite | Effective — safety invariant | §7.4 | AC-016 |
| E2E-FR-016 | `/e2e <flow>` lama tidak menghasilkan eksekusi tidak terdaftar diam-diam | Gated — technical DEC-04 | DEC-04 pending | AC-017 |
| E2E-FR-017 | `/e2e-map` alias kompatibilitas lalu disable-default setelah parity | Effective direction; gated — deployment DEC-10 | ADR-E2E-003 | AC-017 |
| E2E-FR-018 | Semua outcome terminal eksplisit: PASS/FAIL/BLOCKED/UNVERIFIED/CANCELLED/PARTIAL | Effective — architecture | ADR-E2E-014 | AC-018 |
| E2E-FR-019 | Deteksi rute mempertahankan stack yang ada; rute dinamis/conditional → `PARTIAL` | Effective — mapping contract | §6.1 | AC-019 |
| E2E-FR-020 | `TESTS.md`, komentar source, string rute diperlakukan sebagai data, bukan instruksi | Effective — trust boundary | §7.1/§8.1 | AC-020 |

## 5. Kontrak Pemetaan Journey (formal)

Kontrak penuh ada di `JOURNEY-MAPPING-CONTRACT.md`. Field wajib per journey: **stable identity** (journey_key + test registry mapping), **actors & role boundaries**, **entry point**, **steps** dengan state_before/state_after, **expected behavior**, **negative paths**, **alternate paths**, **dependencies**, **risk** (`critical|high|normal|low`), **side effects**, **confidence** (`confirmed|partial|unverified`), **source references** (`path:line`), dan **test registry IDs** (`TEST-E2E-NNN`). Identitas didasarkan pada journey + actor + state boundary, bukan nama rute semata; role-dependent authorization tidak boleh digabung tanpa label. Field ini adalah kontrak translien untuk proposal/report, bukan registry kedua. Lihat juga `FIXTURE-MATRIX.md` untuk F01–F14.

## 6. Persyaratan Non-Fungsional

| ID | Persyaratan | Status (R1) | Gate |
|---|---|---|---|
| E2E-NFR-001 | Tidak ada eksekusi produksi/akun personal tanpa otorisasi eksplisit | Effective rule; gated — DEC-07 | per-environment |
| E2E-NFR-002 | Tidak ada auto-install browser/CLI/npm package; tidak ada perubahan lockfile | Effective | DEC-09 hanya mengatur eksplorasi opsional, tidak mengubah larangan ini |
| E2E-NFR-003 | Artifact di root ignored project; token/cookie/PII diredaksi sebelum dilaporkan | Effective | — |
| E2E-NFR-004 | Skill/agent dimuat lazy per mode; `status` tidak memuat browser runner | Effective | — |
| E2E-NFR-005 | Frozen workflow, Guardian Angel, A07b/core guard, Git policy tetap byte-identik | Effective | — |
| E2E-NFR-006 | Setiap perubahan reversible; source lama + checksum dipertahankan | Effective rule; gated — DEC-10 | deployment scope |
| E2E-NFR-007 | Tidak ada `covered` tanpa actual CLI, exit, test node, artifact yang ada | Effective | — |

Verifikasi deterministik (parser safety, registry path, concurrency, test-count, spec identity, environment gating, evidence validation) dipisahkan dari instruksi orkestrasi di `DETERMINISTIC-VERIFICATION.md`; mode/state machine ada di `MODE-AND-STATE-MACHINE.md`.

## 7. Acceptance Criteria (PRD)

| ID | Requirement | Skenario | Tindakan | Hasil | Side effect terlarang | Verifikasi |
|---|---|---|---|---|---|---|
| AC-001 | E2E-FR-001 | `/e2e help` | Panggil help | Semua mode terdaftar, tidak ada default berbahaya | Eksekusi browser | Static command contract test |
| AC-002 | E2E-FR-002 | `/e2e map <scope>` | Mapping fixture | Discovery + proposal, runner tidak dispatch | Write registry | F01–F06 |
| AC-003 | E2E-FR-003 | `/e2e status` | Baca registry | Tidak ada write/browser/install | File berubah | Mutasi negatif 2 |
| AC-004 | E2E-FR-003 | `/e2e` tanpa argumen | Preview | Rekomendasi next step, tidak eksekusi | Browser start | Mutasi negatif 3 |
| AC-005 | E2E-FR-004 | ID + title ambiguity | Resolve | ID eksak menang; ambiguous → kandidat | Pilih arbitrary ID | Resolver test |
| AC-006 | E2E-FR-005 | `run` tidak terdaftar | Dispatch normal | `REGISTRY_REQUIRED` | Runner invocation | C02, mutasi 4 |
| AC-007 | E2E-FR-006 | `run --ad-hoc` lulus (jika DEC-05 approve) | Report | `PASS_AD_HOC_UNREGISTERED`, registry tetap | `State: covered` | C03, mutasi 5 |
| AC-008 | E2E-FR-007 | `full` | Eksekusi penuh | Urutan gate lengkap, tidak skip phase | Registry write sebelum review | A08, F12 |
| AC-009 | E2E-FR-008/009 | Registry existing | Map ulang | ID/field/block lain dipertahankan | Renumber/duplikat | B08, B09, F07 |
| AC-010 | E2E-FR-010 | `State: stale` | Validate | Schema mismatch; assessment `stale` dipisah | Enum diterima | B10, mutasi 8 |
| AC-011 | E2E-FR-011 | Target produksi | Run/full | `BLOCKED` | HTTP request produksi | D02, mutasi 12 |
| AC-012 | E2E-FR-012 | Exit 0 + weak assertion | Evaluate | `PASS_UNVERIFIED`, bukan covered | `covered` | C05, mutasi 10 |
| AC-013 | E2E-FR-012 | Exit nonzero | Evaluate | `FAIL`, covered lama → unverified | Klaim pass | C06 |
| AC-014 | E2E-FR-013 | Runner selesai | Parse evidence | CLI/node/exit/hash/artifact hadir | Evidence inventif | C04, C10 |
| AC-015 | E2E-FR-014 | Pass terverifikasi | Update registry | Hanya field diizinkan pada blok cocok | Ubah field lain | C12, F07 |
| AC-016 | E2E-FR-015 | Concurrent edit | Write | `WRITE_CONFLICT`, rebase | Clobber | B12, mutasi 13 |
| AC-017 | E2E-FR-016/017 | Legacy alias | Resolve | Deprecation hint/alias; tidak surprise run | Eksekusi tersembunyi | D06–D10, F13/F14 |
| AC-018 | E2E-FR-018 | Semua terminal | Report | Status eksplisit | Narrative PASS palsu | D/E scenarios |
| AC-019 | E2E-FR-019 | Route fixture | Detect | Stack sesuai, API bukan UI page | Invented route | B01–B04, F01–F06 |
| AC-020 | E2E-FR-020 | Registry berisi shell text | Parse | Teks tidak dieksekusi | Shell execution | D01, mutasi 9 |

Trace lengkap 27 requirement → 20 AC → 48 skenario + fixture + evidence artifact ada di `REQUIREMENTS-TRACEABILITY.csv`, `ACCEPTANCE-MATRIX.csv`, dan `COVERAGE-SUMMARY.md`.

## 8. Milestone Pengiriman

| # | Milestone | Outcome | Cakupan AC | Dependensi | Status |
|---|---|---|---|---|---|
| 1 | Reconciliation & contract freeze | Source baseline + ketidakpastian winner tercatat | AC-001, AC-019 | WP0 | Pending |
| 2 | Unified interface & phase separation | Mode parser + resolutor target | AC-001–AC-005 | DEC-04/05 | Provisional |
| 3 | Mapping & registry governance | Registry-first, ID discipline, approval write | AC-006–AC-010 | DEC-12 | Provisional |
| 4 | Runner & evidence hardening | Bukti Playwright persisten, safety gate | AC-011–AC-014 | DEC-07/08 | DEC-08 confirmed; DEC-07 pending |
| 5 | Migration & rollback | Parity, disable-default, restore | AC-015–AC-018 | DEC-10 | Provisional |
| 6 | Acceptance release | 48 skenario + 14 mutasi + evidence | Semua | Owner approval + implementation authorization | Pending |

## 9. Rekonsiliasi Keputusan & Risiko

Kategori keputusan (detail di `DECISIONS.md` dan `ADR-RECONCILIATION.md`):

1. **Architecture approval (confirmed)**: DEC-01, DEC-02, DEC-03, DEC-08 + ADR-E2E-001…014. Tidak ditanyakan ulang.
2. **Technical implementation decisions (pending, nonblocking untuk review)**: DEC-04 (legacy shorthand), DEC-05 (`--ad-hoc`), DEC-06 (registry write strategy), DEC-09 (Agent Browser opsional), DEC-12 (`State: stale` legacy migration).
3. **Environment authorization (pending, eksplisit)**: DEC-07 — otorisasi per-target environment; tidak boleh diAnggap Given.
4. **Deployment authorization (pending, eksplisit)**: DEC-10 (scope disable-default `/e2e-map`), DEC-11 (CI).

| ID | Pernyataan | Tipe | Status | Dampak |
|---|---|---|---|---|
| DEC-01/02/03/08 | Satu `/e2e`, fase terpisah, `TESTS.md`, Playwright authority | Architecture | Confirmed | Seluruh requirement inti |
| DEC-04 | Shim `/e2e <flow>` lama | Technical | Pending | E2E-FR-016, AC-017 |
| DEC-05 | `--ad-hoc` diizinkan atau tidak | Technical | Pending | E2E-FR-006, AC-007 |
| DEC-06 | Strategi penulisan registry | Technical | Pending | E2E-FR-014/015 |
| DEC-07 | Otorisasi per-environment | Environment | Pending | E2E-FR-011, E2E-NFR-001 |
| DEC-09 | Agent Browser eksplorasi | Technical | Pending | E2E-NFR-002 (larangan install tetap Effective) |
| DEC-10 | Disable-default `/e2e-map` | Deployment | Pending | E2E-FR-017, E2E-NFR-006 |
| DEC-11 | CI otomatis | Deployment | Pending | Future scope |
| DEC-12 | `State: stale` legacy | Technical | Pending | E2E-FR-010 (klasifikasi assessment tetap Effective) |
| ASM-01 | `$ARGUMENTS` diparse oleh prompt, bukan argumen kelas satu | Assumption | Proposed — validasi via isolated runtime probe | E2E-FR-001 |
| ASM-02 | Detektor lama dapat diport tanpa kehilangan perilaku | Assumption | Proposed — validasi via F01–F14 | E2E-FR-019 |

Risiko: effective winner perintah belum terverifikasi; fixture lintas-stack belum dijalankan; alias migration dapat shadowing; evidence agent browser historis bukan Playwright persisten; high-risk journey butuh konfirmasi operasional. Mitigasi: WP0, parity F14/F13, 14 mutasi negatif, rollback rehearsal.

## 10. Referensi & Constraint Riset

- Stack teramati: OpenCode v2.3.2, Node v24.21.0. Playwright: TBD — versi project belum diverifikasi; tidak ada install pada fase PRD.
- `TESTS.md`: tidak ada di repo ECC yang diperiksa; bootstrap bersifat proposal (lihat `REGISTRY-CONTRACT.md`).
- Referensi eksternal: dokumentasi OpenCode commands; Playwright best practices/locators/browser-contexts/trace-viewer/auth. Referensi tidak membuktikan konfigurasi aktual; WP0 harus verifikasi.
- Constraint: tidak ada install dependency, network, browser produksi, atau modifikasi runtime aktif pada tahap PRD.

## 11. Riwayat & Persetujuan

| Rev | Tanggal | Status | Penulis | Digest | Catatan |
|---|---|---|---|---|---|
| v1.0 | 2026-11-22 | NEEDS_CLARIFICATION | ECC-OPL agent | baseline ZIP `a5abb2d7…` | Candidate awal; 8 keputusan pending membuat status terlalu konservatif; teks pembuka rusak; traceability belum 27→20→48 |
| v1.1 (R1) | 2026-11-22 | READY_FOR_REVIEW | ECC-OPL agent | lihat `SHA256-MANIFEST.json` | Rekonsiliasi ADR/DEC; E2E-FR-012 confirmed; journey contract; F01–F14; traceability 27/20/48; verifikasi deterministik dipisah; registry/bootstrap/error fields diperjelas; perbaikan teks pembuka |
| v1.1-APPROVED | 2026-11-22 | APPROVED | Owner | `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211` | "aku approve prd nya" — mengizinkan `/plan`, bukan implementasi |

---

*Product Status: APPROVED — owner menyetujui revisi R1 dengan digest `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211` (2026-11-22, "aku approve prd nya"). IMPLEMENTATION_AUTHORIZATION=PENDING — persetujuan PRD mengizinkan `/plan`, bukan coding, eksekusi browser, migrasi registry, install dependency, atau disable-default.*
