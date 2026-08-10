
<!-- Ext Files Lines
--- ----- -----
.ts    17   682 -->


# Workmate License Server

## Setup

1. Install dependencies
```
npm install
```

2. Fill in your values in .env

3. Generate your key pair (run once only)
```
node generateKeys.js
```

4. Run schema against PostgreSQL
```
psql -U postgres -d workmate -f src/db/schema.sql
```

5. Start dev server
```
npm run dev
```

## Routes

| Method | Route       | Description                        |
|--------|-------------|------------------------------------|
| POST   | /activate   | Activate a license                 |
| POST   | /purchase   | Purchase and generate serial online|

## Keys

- private.pem — server only, never commit, never share
- public.pem  — embed inside Electron client app
