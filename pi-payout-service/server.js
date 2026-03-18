/**
 * Supapi Pi Payout Service
 * Self-hosted A2U payout API — guna pi-backend rasmi Pi Network
 *
 * Env: PI_API_KEY, PI_WALLET_SEED, PAYOUT_API_KEY
 * POST /transfer
 * Body: { amount_pi, recipient_uid, note? }
 * Auth: Bearer <PAYOUT_API_KEY>
 */

import "dotenv/config";
import express from "express";
// pi-backend is CJS; ESM interop gives { default: { default: PiNetwork } } in Node — use .default.default
import PiBackend from "pi-backend";
const PiNetwork = PiBackend?.default?.default ?? PiBackend?.default ?? PiBackend;

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3100;
const PI_API_KEY = process.env.PI_API_KEY;
const PI_WALLET_SEED = process.env.PI_WALLET_SEED;
const PAYOUT_API_KEY = process.env.PAYOUT_API_KEY;

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!PAYOUT_API_KEY || token !== PAYOUT_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.post("/transfer", authMiddleware, async (req, res) => {
  try {
    const { amount_pi, recipient_uid, destination_wallet, note } = req.body;

    if (!amount_pi || amount_pi <= 0) {
      return res.status(400).json({ error: "amount_pi required and must be > 0" });
    }

    // Pi API A2U guna uid — destination_wallet tidak disokong oleh pi-backend rasmi
    const uid = (recipient_uid || "").trim();
    if (!uid) {
      return res.status(400).json({
        error: "recipient_uid required. Pi A2U uses Pi user ID (uid). Get from users.pi_uid when user signed in with Pi.",
      });
    }

    if (!PI_API_KEY || !PI_WALLET_SEED) {
      return res.status(500).json({
        error: "PI_API_KEY and PI_WALLET_SEED not configured. Set in .env",
      });
    }

    const pi = new PiNetwork(PI_API_KEY, PI_WALLET_SEED);
    const amount = Number(Number(amount_pi).toFixed(7));
    const memo = (note || `Payout`).slice(0, 250);

    const paymentId = await pi.createPayment({
      amount,
      memo,
      metadata: { source: "supapi-payout" },
      uid,
    });

    const txid = await pi.submitPayment(paymentId);
    await pi.completePayment(paymentId, txid);

    res.json({ success: true, txid, payment_id: paymentId });
  } catch (err) {
    console.error("[Payout] Error:", err.message);
    res.status(500).json({
      error: err.message || "Payout failed",
    });
  }
});

app.get("/health", (req, res) => {
  const configured = Boolean(PI_API_KEY && PI_WALLET_SEED && PAYOUT_API_KEY);
  res.json({
    ok: true,
    a2u_configured: configured,
    message: configured ? "Pi A2U payout ready" : "Set PI_API_KEY, PI_WALLET_SEED, PAYOUT_API_KEY",
  });
});

app.listen(PORT, () => {
  console.log(`[Pi Payout] Listening on port ${PORT}`);
  if (!PI_API_KEY || !PI_WALLET_SEED || !PAYOUT_API_KEY) {
    console.warn("[Pi Payout] ⚠️ Set PI_API_KEY, PI_WALLET_SEED, PAYOUT_API_KEY in .env");
  }
});
