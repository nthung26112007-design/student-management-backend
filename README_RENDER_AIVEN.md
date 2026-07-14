# Backend trên Render, database trên Aiven

Render phải có các biến `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`, `JWT_SECRET`; hoặc dùng `DATABASE_URL`.

Build command:

```text
npm install
```

Start command:

```text
npm start
```

Sau khi push code, chọn Manual Deploy trên Render. Không commit file `.env` thật.
