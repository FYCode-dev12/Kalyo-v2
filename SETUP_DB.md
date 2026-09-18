# Setup Database Supabase

## Langkah 1: Cek koneksi pooler (tanpa IP whitelist)
Supabase free tier menggunakan **connection pooling** (port 6543) yang **tidak perlu IP whitelist**. Hanya koneksi langsung (port 5432) yang butuh whitelist.

### Test koneksi pooler:
```bash
# Cek apakah pooler bisa diakses
node -e "
const net = require('net');
const client = net.createConnection({ host: 'aws-0-ap-southeast-1.pooler.supabase.com', port: 6543 });
client.on('connect', () => { console.log('✓ Connected to pooler:6543'); client.end(); });
client.on('error', (e) => console.log('✗ Error 6543:', e.message));
"
```

### Test koneksi langsung (butuh whitelist):
```bash
node -e "
const net = require('net');
const client = net.createConnection({ host: 'db.hbbteaqfhuqjyfbuklcv.supabase.co', port: 5432 });
client.on('connect', () => { console.log('✓ Connected to direct:5432'); client.end(); });
client.on('error', (e) => console.log('✗ Error 5432:', e.message));
"
```

## Langkah 2: Gunakan koneksi pooling di `.env.local`
```bash
DATABASE_URL="postgresql://postgres.hbbteaqfhuqjyfbuklcv:febrianyo12@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.hbbteaqfhuqjyfbuklcv:febrianyo12@db.hbbteaqfhuqjyfbuklcv.supabase.co:5432/postgres"
```

## Langkah 3: Jalankan Migrasi
```bash
pnpm prisma migrate dev --name init
pnpm prisma db seed
```

## Catatan
- **Koneksi pooling (port 6543)** → TIDAK perlu whitelist IP (untuk production/deployment).
- **Koneksi langsung (port 5432)** → Perlu whitelist IP (untuk tools seperti Prisma Studio, Supabase Dashboard).
- Prisma CLI bisa pakai pooling untuk migrate.
