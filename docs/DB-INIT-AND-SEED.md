# DB Init and Seed

## 1) Migrate + Seed
```bash
cd backend
python3 -m app.cli init
```

## 2) Verify 25 tables have data
```bash
cd backend
python3 -m app.cli verify
```

## 3) One-shot
```bash
cd backend
python3 -m app.cli all
```

## Notes
- 主目标数据库: PostgreSQL (`DATABASE_URL=postgresql://...`)
- 本地兜底: SQLite (`sqlite:///./dev.db`)
- `seed_if_empty` 会覆盖 25 张表的初始化样例数据
- 前端需要 `NEXT_PUBLIC_API_BASE_URL` 指向后端（例: `http://localhost:8000`）
