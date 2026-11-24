# 開発継続用の入口 — v0.1.164
ゲーム本体ZIP。別途の引き継ぎZIP・初代SAHOVERSEのデータは含めない。

- README.md冒頭、docs/TEST_REPORT.md、docs/PRE_RELEASE_CHECKLIST.mdを確認し、package.jsonと実ソースを基準に開発を続ける。
- ハースストーンをベースにした独立ゲーム。迷う場合は初代SAHOVERSEを参考にするが、新ルールとの整合性を優先する。
- 対戦処理の安定性・正確性・軽量性が最優先。1回の依頼で実行可能な限界まで、安全な単位の実装・回帰検証・修正を繰り返す。未検証項目を合格と扱わない。時間・処理上限に近づいた場合は新規実装を終了し、最終検証と本体ZIP作成を優先する。
- 旧ゲームのリポジトリ・Firebase設定・URL・保存キーは変更しない。新ゲーム専用の構成で運用する。正式名称、進化、カードバランスは未決定。
- Node v22で `npm test`。ローカル表示 `npm run serve`、試験通信 `npm run serve:room`（信頼できるLAN専用）。テスト結果を実機・実Firebase検証と混同しない。Firebase設定は未入力。公開手順は docs/FIREBASE_SETUP.md。
- 端末のカード・デッキ保存形式は維持。カタログprototype-23、状態schemaVersion 16、通信ocg-room-1。旧進行中ルームは引き継がず、全端末とNodeサーバーを同一新版に揃え、新規部屋で開始する。
- 最終報告は簡潔に、最新版のゲーム本体ZIPのみ提示する。
