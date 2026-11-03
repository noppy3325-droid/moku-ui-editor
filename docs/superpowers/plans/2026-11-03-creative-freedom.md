# Creative Freedom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 固定の見た目に制限されず、少ない操作で多様なUIを作れるエディターにする。

**Architecture:** 既存のDOM Rendererを共有し、追加の装飾モデルを後方互換で導入する。フォント管理と部品組立を独立したモジュールにし、Inspectorとパーツライブラリから利用する。

**Tech Stack:** React 19, TypeScript, Vite, Zustand, Dexie, Vitest, Fontsource。

**Spec:** docs/superpowers/specs/2026-11-03-creative-freedom-design.md

## Global Constraints

- 旧JSONの読み込みを維持する。既存部品を自動で展開しない。
- 色やレイアウトの変更はUndo/Redoで取り消せる。
- 任意のスクリプトや外部CSSを読み込まず、安全な値をスキーマで検証する。
- フォントや第三者素材のライセンスを保持する。
- キャンバス・プレビュー・書き出しは共通Rendererを使用する。

## Review Focus

- 旧データの省略項目を補完して見た目を保つ。
- フォントの実読み込み・持ち運びと大きなJSONの制限。
- 複合部品のID、回転、親子座標、Undo。
- ロックされた選択や循環する親変更。
- 新しい装飾とフォントが書き出しから失われない。

---

### Task 1: 装飾とデータ互換

**Files:** src/model.ts, src/appearance.ts, src/Renderer.tsx, src/renderer.css, src/creative.test.tsx

**Interfaces:** appearanceCSS(node: UINode): CSSProperties、default追加スタイル、Project.fontsとProject.library。

- [ ] 旧データ補完、不正値拒否、装飾の実描画を検証する失敗テストを先に追加する。
- [ ] npm test -- src/creative.test.tsx → 新機能欠如でFAIL。
- [ ] スキーマと共有CSS変換を実装する。
- [ ] npm test → 全件PASS。
- [ ] コミットする。

### Task 2: 実フォントと文字編集

**Files:** src/fonts.ts, src/TypographyControls.tsx, src/Inspector.tsx, src/main.tsx, package.json, package-lock.json, src/font.test.ts

**Interfaces:** fontCatalog, fontCSS(project), portableFonts(project)、FontPickerとTypographyControls。

- [ ] フォントデータの安全性、使用フォント選別、持ち運びをテストしFAILを確認する。
- [ ] 日本語2系統と欧文5系統を実フォントで同梱し、検索/プレビュー、ユーザーフォント追加、文字装飾と高さ調整を実装する。
- [ ] npm test → 全件PASS。
- [ ] コミットする。

### Task 3: 装飾の操作パネル

**Files:** src/AppearanceControls.tsx, src/Inspector.tsx, src/styles.css

**Interfaces:** AppearanceControls、patchStylesを通じて一貫して変更する。

- [ ] グラデーション/角丸/影の編集値がRendererと保存へ渡るテストを追加しFAILを確認する。
- [ ] 即時プレビュー付きプリセット、詳細調整、余白、ぼかし、枠線、色を実装する。
- [ ] npm test → 全件PASS。
- [ ] コミットする。

### Task 4: 編集可能な部品と再利用

**Files:** src/blocks.ts, src/StudioLibrary.tsx, src/store.ts, src/Sidebar.tsx, src/Inspector.tsx, src/editor-geometry.ts, src/blocks.test.ts

**Interfaces:** buildBlock(key, theme): UINode[]、expandNode(node): UINode[]、storeの挿入/保存/展開/親変更/スタイル貼付け。

- [ ] 子レイヤー、IDの独立、Undo、ライブラリ再読込、親の循環拒否のテストを先に追加しFAILを確認する。
- [ ] 編集可能な完成ブロック、テーマ、選択を自分の部品へ保存、スタイルコピー/貼付け、親コンテナ指定を実装する。
- [ ] npm test → 全件PASS。
- [ ] コミットする。

### Task 5: 出力と仕上げ

**Files:** src/exports.tsx, src/Dialogs.tsx, src/exports.test.ts, README.md, docs、THIRD_PARTY_NOTICES.md

**Interfaces:** 既存portableProjectに使用フォントを保持し、HTMLと画像出力にフォントを埋め込む。

- [ ] 新しい装飾、フォント、ライブラリが出力と再読込に残る失敗テストを追加する。
- [ ] 出力を更新し、実ブラウザーで編集→プレビュー→再読込→HTML/PNGを確認する。
- [ ] npm test、npm run build、git diff --check → 全件PASS。
- [ ] 新規コンテキストのレビューを受け、重要な不具合を修正してからGitHubとVercelに反映する。
