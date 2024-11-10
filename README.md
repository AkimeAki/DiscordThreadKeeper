# URL

`phpMyAdmin`: http://localhost:25237

# 環境構築

1. `make init`
2. `make attach`
3. `npm ci`
4. `npm run db:generate`
5. `npm run db:deploy`

# コマンド

`npm run db:generate`: Prismaで型生成
`npm run db:migrate`: Prismaでマイグレーションファイル生成
`npm run db:deploy`: マイグレーションファイルを反映
