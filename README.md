# 環境構築

1. `.env.development.local` の `DATABASE_URL` を `file:./dev.db` にする
2. `task reset`

`DATABASE_URL` の相対パスは `prisma/` からの位置になる。

# コマンド

`task reset`: 依存を入れ直し、開発用のDBを作り直す
`npm test`: Vitestでテストを実行する（テストごとに一時フォルダへ空のSQLiteを作るので、開発用のDBには触れない）
`npm run db:generate`: Prismaで型生成
`npm run db:migrate`: Prismaでマイグレーションファイル生成
`npm run db:deploy`: マイグレーションファイルを反映

# 本番環境

Railwayのボリュームを `/data` にマウントし、`DATABASE_URL` を `file:/data/db.sqlite` にする。マイグレーションは `npm start` で起動するときに反映される。

`npm start` の `exec` は、Railwayがデプロイを切り替えるときに送るSIGTERMをBotに直接届けるために付けている。外すと合図が `sh` で止まり、Botが正常に終了できず、異常終了の通知が届く。
