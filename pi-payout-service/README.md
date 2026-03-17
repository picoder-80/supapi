# Supapi Pi Payout Service

Perkhidmatan A2U (App-to-User) payout self-hosted untuk Pi Network. Guna `pi-backend` rasmi.

## Setup

1. **Install dependencies**
   ```bash
   cd pi-payout-service && npm install
   ```

2. **Buat `.env`**
   ```env
   PI_API_KEY=<App Server API Key dari Pi Developer Portal>
   PI_WALLET_SEED=<Private seed wallet app anda — bermula dengan S_>
   PAYOUT_API_KEY=<API key untuk auth — buat string rawak>
   PORT=3100
   ```

3. **Dapatkan credentials**
   - **PI_API_KEY**: Pi Developer Portal (develop.pi dalam Pi Browser) → App anda → Server API Key
   - **PI_WALLET_SEED**: Wallet private seed app anda (S_...) — ini wallet yang akan hantar Pi
   - **PAYOUT_API_KEY**: Buat sendiri (contoh: `openssl rand -hex 32`)

4. **Jalankan**
   ```bash
   npm start
   ```

## Konfigurasi Supapi

Dalam `.env` Supapi:

```env
PI_PAYOUT_API_URL=http://localhost:3100/transfer
PI_PAYOUT_API_KEY=<PAYOUT_API_KEY yang sama>
```

Untuk production, ganti URL dengan domain anda (contoh: `https://payout.supapi.com/transfer`).

## API

### POST /transfer

**Auth:** `Authorization: Bearer <PAYOUT_API_KEY>`

**Body:**
```json
{
  "amount_pi": 1.5,
  "recipient_uid": "a1111111-aaaa-bbbb-2222-ccccccc3333d",
  "note": "SupaChat tip"
}
```

**Response:**
```json
{
  "success": true,
  "txid": "...",
  "payment_id": "..."
}
```

**Nota:** Pi A2U guna `recipient_uid` (Pi user ID), bukan wallet address. Dapatkan dari `users.pi_uid` bila user sign in dengan Pi.

## Jual / White-label

Perkhidmatan ini boleh di-host dan dijual sebagai produk. Pastikan:
- Host pada server selamat
- Guna HTTPS
- Simpan PI_WALLET_SEED dengan selamat
- Rate limit dan monitoring untuk production
