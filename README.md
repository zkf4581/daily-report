# 外包人员日报登记系统

外包每天汇报当天工作的轻量多用户系统：外包填日报、雇主（管理员）看全部并管理账号，到点邮件提醒未交的人。

## 📖 开发前必读

完整的需求、技术方案、数据库设计、分阶段任务和当前进度，全部在：

👉 **[需求与技术方案.md](./需求与技术方案.md)**

接手开发请先读它，**尤其是第 5 节「Next.js 16 关键差异」**（`proxy.ts` 取代 `middleware.ts`、cookies/params 全异步等），否则会用到过时写法。

## 技术栈

Next.js 16（App Router）+ TypeScript · Tailwind v4 · shadcn/ui · Supabase（Postgres + Auth + RLS）· Resend（邮件）· Vercel

## 当前进度

- ✅ **P0 脚手架**：项目初始化、shadcn 组件、Supabase 依赖与目录均已就绪（详见技术方案第 6 节）。
- ⬜ **P1 起**：数据库 migration + RLS、登录守卫、外包端、管理员端、账号管理、邮件提醒、部署。

## 本地启动

```bash
cp .env.local.example .env.local   # 填入 Supabase / Resend 密钥
npm install
npm run dev                         # http://localhost:3000
```

> 需要一个 Supabase 项目（云端或本地 `supabase start`，后者需 Docker）。密钥获取方式见 `.env.local.example` 注释。
