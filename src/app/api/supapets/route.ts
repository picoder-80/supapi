import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PetKey =
  | "fluffy"
  | "barky"
  | "hoppy"
  | "scaly"
  | "chirpy"
  | "slither"
  | "fins"
  | "horn"
  | "spot"
  | "pebble";

type CareAction = "feed" | "play" | "clean" | "sleep";
type ShopItemKey = "food_basic" | "toy_ball" | "soap_clean" | "pillow_nap";
type MiniGameType = "quick_tap";

const PET_CATALOG: Record<PetKey, {
  key: PetKey;
  name: string;
  type: string;
  trait: string;
  hatch_hours: number;
  hatch_cost_sc: number;
}> = {
  fluffy: { key: "fluffy", name: "Fluffy", type: "Cat", trait: "Plays with yarn, loves naps", hatch_hours: 12, hatch_cost_sc: 120 },
  barky: { key: "barky", name: "Barky", type: "Dog", trait: "Can fetch small items, friendly", hatch_hours: 12, hatch_cost_sc: 120 },
  hoppy: { key: "hoppy", name: "Hoppy", type: "Rabbit", trait: "Extra energy, fast growth", hatch_hours: 10, hatch_cost_sc: 110 },
  scaly: { key: "scaly", name: "Scaly", type: "Dragon", trait: "Fire breath, rare evolve path", hatch_hours: 24, hatch_cost_sc: 450 },
  chirpy: { key: "chirpy", name: "Chirpy", type: "Bird", trait: "Can sing for credits", hatch_hours: 8, hatch_cost_sc: 90 },
  slither: { key: "slither", name: "Slither", type: "Snake", trait: "Sneaky, unlocks secret items", hatch_hours: 10, hatch_cost_sc: 110 },
  fins: { key: "fins", name: "Fins", type: "Fish", trait: "Calm, requires water tank care", hatch_hours: 6, hatch_cost_sc: 80 },
  horn: { key: "horn", name: "Horn", type: "Unicorn", trait: "Magical powers, rare items", hatch_hours: 24, hatch_cost_sc: 500 },
  spot: { key: "spot", name: "Spot", type: "Dalmatian", trait: "Special spots pattern, playful", hatch_hours: 12, hatch_cost_sc: 140 },
  pebble: { key: "pebble", name: "Pebble", type: "Turtle", trait: "Slow but long lifespan, rare evolve", hatch_hours: 18, hatch_cost_sc: 220 },
};

const CARE_RULES: Record<CareAction, {
  reward_sc: number;
  xp_gain: number;
  cooldown_minutes: number;
  stats: Partial<Record<"hunger" | "happiness" | "health" | "energy", number>>;
  note: string;
}> = {
  feed: {
    reward_sc: 12,
    xp_gain: 8,
    cooldown_minutes: 180,
    stats: { hunger: 22, health: 4 },
    note: "Fed your pet",
  },
  play: {
    reward_sc: 14,
    xp_gain: 10,
    cooldown_minutes: 180,
    stats: { happiness: 20, energy: -8 },
    note: "Played with your pet",
  },
  clean: {
    reward_sc: 10,
    xp_gain: 7,
    cooldown_minutes: 180,
    stats: { health: 16, happiness: 6 },
    note: "Cleaned your pet",
  },
  sleep: {
    reward_sc: 9,
    xp_gain: 6,
    cooldown_minutes: 180,
    stats: { energy: 26, health: 5 },
    note: "Helped your pet rest",
  },
};

const DECAY_PER_HOUR = {
  hunger: 3,
  happiness: 2,
  health: 1,
  energy: 2,
};

const DAILY_BASE_SC = 20;
const DAILY_STREAK_BONUS_SC = 60;
const DAILY_STREAK_CYCLE = 7;
const MINIGAME_COOLDOWN_SECONDS = 60;
const MINIGAME_DAILY_PLAY_CAP = 20;
const MINIGAME_DAILY_REWARD_CAP = 400;

const SHOP_ITEMS: Record<ShopItemKey, {
  item_key: ShopItemKey;
  emoji: string;
  name: string;
  cost_sc: number;
  effects: Partial<Record<"hunger" | "happiness" | "health" | "energy", number>>;
  xp_gain: number;
  note: string;
}> = {
  food_basic: {
    item_key: "food_basic",
    emoji: "🍖",
    name: "Basic Food",
    cost_sc: 8,
    effects: { hunger: 18, health: 3 },
    xp_gain: 3,
    note: "Fed premium food",
  },
  toy_ball: {
    item_key: "toy_ball",
    emoji: "🎾",
    name: "Toy Ball",
    cost_sc: 12,
    effects: { happiness: 16, energy: -3 },
    xp_gain: 4,
    note: "Played with toy ball",
  },
  soap_clean: {
    item_key: "soap_clean",
    emoji: "🧼",
    name: "Clean Soap",
    cost_sc: 10,
    effects: { health: 14, happiness: 4 },
    xp_gain: 3,
    note: "Deep cleaned pet",
  },
  pillow_nap: {
    item_key: "pillow_nap",
    emoji: "🛏️",
    name: "Nap Pillow",
    cost_sc: 9,
    effects: { energy: 20, health: 4 },
    xp_gain: 2,
    note: "Comfort rest boost",
  },
};

function getUserId(req: NextRequest): string | null {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch {
    return null;
  }
}

function clampStat(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toDateOnly(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function seededRand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const x = (h >>> 0) / 4294967295;
  return Number.isFinite(x) ? x : Math.random();
}

function evolveStage(level: number): "baby" | "teen" | "adult" {
  if (level >= 10) return "adult";
  if (level >= 5) return "teen";
  return "baby";
}

async function ensureWallet(userId: string) {
  await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
}

async function readWallet(userId: string) {
  const { data } = await supabase
    .from("supapi_credits")
    .select("balance, total_earned, total_spent")
    .eq("user_id", userId)
    .single();
  return data;
}

async function creditSC(userId: string, amount: number, activity: string, note: string) {
  await ensureWallet(userId);
  const wallet = await readWallet(userId);
  const current = Number(wallet?.balance ?? 0);
  const next = current + amount;
  await supabase
    .from("supapi_credits")
    .update({
      balance: next,
      total_earned: Number(wallet?.total_earned ?? 0) + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "earn",
    activity,
    amount,
    balance_after: next,
    note,
  });
  return next;
}

async function spendSC(userId: string, amount: number, activity: string, note: string) {
  await ensureWallet(userId);
  const wallet = await readWallet(userId);
  const current = Number(wallet?.balance ?? 0);
  if (current < amount) return { ok: false as const, balance: current };
  const next = current - amount;
  await supabase
    .from("supapi_credits")
    .update({
      balance: next,
      total_spent: Number(wallet?.total_spent ?? 0) + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "spend",
    activity,
    amount,
    balance_after: next,
    note,
  });
  return { ok: true as const, balance: next };
}

async function autoHatchReadyPets(userId: string) {
  const nowIso = new Date().toISOString();
  await supabase
    .from("supapets_pets")
    .update({
      is_hatched: true,
      hatched_at: nowIso,
      stage: "baby",
      updated_at: nowIso,
      hunger: 78,
      happiness: 78,
      health: 78,
      energy: 78,
    })
    .eq("user_id", userId)
    .eq("is_hatched", false)
    .lte("hatch_ready_at", nowIso);
}

async function applyPetDecay(userId: string) {
  const now = new Date();
  const nowIso = now.toISOString();
  const { data: pets } = await supabase
    .from("supapets_pets")
    .select("id, is_hatched, updated_at, hunger, happiness, health, energy")
    .eq("user_id", userId)
    .eq("is_hatched", true);
  if (!pets?.length) return;

  for (const pet of pets as any[]) {
    const updatedAt = new Date(String(pet.updated_at ?? nowIso));
    const elapsedHours = Math.floor((now.getTime() - updatedAt.getTime()) / 3600000);
    if (elapsedHours < 1) continue;
    const nextHunger = clampStat(Number(pet.hunger ?? 0) - elapsedHours * DECAY_PER_HOUR.hunger);
    const nextHappiness = clampStat(Number(pet.happiness ?? 0) - elapsedHours * DECAY_PER_HOUR.happiness);
    const nextHealth = clampStat(Number(pet.health ?? 0) - elapsedHours * DECAY_PER_HOUR.health);
    const nextEnergy = clampStat(Number(pet.energy ?? 0) - elapsedHours * DECAY_PER_HOUR.energy);

    await supabase
      .from("supapets_pets")
      .update({
        hunger: nextHunger,
        happiness: nextHappiness,
        health: nextHealth,
        energy: nextEnergy,
        updated_at: nowIso,
      })
      .eq("id", pet.id);
  }
}

async function readInventory(userId: string) {
  const { data } = await supabase
    .from("supapets_inventory")
    .select("item_key, quantity")
    .eq("user_id", userId);
  return data ?? [];
}

async function readDaily(userId: string) {
  let { data } = await supabase
    .from("supapets_daily")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) {
    await supabase.from("supapets_daily").insert({ user_id: userId, streak: 0 });
    const { data: inserted } = await supabase
      .from("supapets_daily")
      .select("*")
      .eq("user_id", userId)
      .single();
    data = inserted;
  }
  return data;
}

async function readMinigameState(userId: string) {
  let { data } = await supabase
    .from("supapets_minigame_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) {
    await supabase.from("supapets_minigame_state").insert({
      user_id: userId,
      last_reset_date: toDateOnly(new Date().toISOString()),
      plays_today: 0,
      total_plays: 0,
      daily_reward_sc: 0,
    });
    const { data: inserted } = await supabase
      .from("supapets_minigame_state")
      .select("*")
      .eq("user_id", userId)
      .single();
    data = inserted;
  }
  return data;
}

async function normalizeMinigameState(userId: string) {
  const state = await readMinigameState(userId);
  const today = toDateOnly(new Date().toISOString());
  if (String(state?.last_reset_date ?? "") === today) return state;
  await supabase
    .from("supapets_minigame_state")
    .update({
      plays_today: 0,
      daily_reward_sc: 0,
      last_reset_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  const { data } = await supabase
    .from("supapets_minigame_state")
    .select("*")
    .eq("user_id", userId)
    .single();
  return data;
}

async function readAchievements(userId: string) {
  const { data } = await supabase
    .from("supapets_achievements")
    .select("achievement_key, title, reward_sc, unlocked_at")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false });
  return data ?? [];
}

async function unlockAchievement(params: {
  userId: string;
  achievementKey: string;
  title: string;
  rewardSC: number;
  detail?: Record<string, unknown>;
}) {
  const { data: exists } = await supabase
    .from("supapets_achievements")
    .select("id")
    .eq("user_id", params.userId)
    .eq("achievement_key", params.achievementKey)
    .maybeSingle();
  if (exists) return null;

  const unlockedAt = new Date().toISOString();
  await supabase.from("supapets_achievements").insert({
    user_id: params.userId,
    achievement_key: params.achievementKey,
    title: params.title,
    reward_sc: params.rewardSC,
    detail: params.detail ?? {},
    unlocked_at: unlockedAt,
  });

  let balance: number | null = null;
  if (params.rewardSC > 0) {
    balance = await creditSC(
      params.userId,
      params.rewardSC,
      `supapets_achievement_${params.achievementKey}`,
      `🏆 Achievement unlocked: ${params.title}`,
    );
  }
  return { unlocked_at: unlockedAt, reward_sc: params.rewardSC, wallet_balance_sc: balance };
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  const catalog = Object.values(PET_CATALOG);

  if (!userId) {
    return NextResponse.json({
      success: true,
      data: {
        catalog,
        pets: [],
        wallet_balance_sc: 0,
        server_time: new Date().toISOString(),
      },
    });
  }

  await autoHatchReadyPets(userId);
  await applyPetDecay(userId);
  await ensureWallet(userId);
  const wallet = await readWallet(userId);

  const { data: pets, error } = await supabase
    .from("supapets_pets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const inventory = await readInventory(userId);
  const daily = await readDaily(userId);
  const achievements = await readAchievements(userId);
  const minigame = await normalizeMinigameState(userId);
  const today = toDateOnly(new Date().toISOString());
  const lastClaim = toDateOnly(daily?.last_claim_at);

  return NextResponse.json({
    success: true,
    data: {
      catalog,
      pets: pets ?? [],
      shop_items: Object.values(SHOP_ITEMS),
      inventory,
      daily: {
        streak: Number(daily?.streak ?? 0),
        last_claim_date: lastClaim || null,
        can_claim_today: today !== lastClaim,
        next_reward_sc: DAILY_BASE_SC,
      },
      achievements,
      minigame: {
        plays_today: Number(minigame?.plays_today ?? 0),
        total_plays: Number(minigame?.total_plays ?? 0),
        daily_reward_sc: Number(minigame?.daily_reward_sc ?? 0),
        plays_left_today: Math.max(0, MINIGAME_DAILY_PLAY_CAP - Number(minigame?.plays_today ?? 0)),
        daily_reward_left: Math.max(0, MINIGAME_DAILY_REWARD_CAP - Number(minigame?.daily_reward_sc ?? 0)),
        cooldown_seconds: MINIGAME_COOLDOWN_SECONDS,
        last_play_at: minigame?.last_play_at ?? null,
      },
      wallet_balance_sc: Number(wallet?.balance ?? 0),
      server_time: new Date().toISOString(),
    },
  });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const now = new Date();

  if (action === "hatch_egg") {
    const petKey = String(body?.pet_key ?? "").toLowerCase() as PetKey;
    const petDef = PET_CATALOG[petKey];
    if (!petDef) return NextResponse.json({ success: false, error: "Invalid pet type" }, { status: 400 });

    const spend = await spendSC(userId, petDef.hatch_cost_sc, "supapets_hatch_egg", `🐾 Hatched ${petDef.name} egg`);
    if (!spend.ok) {
      return NextResponse.json({
        success: false,
        error: `Not enough SC to hatch ${petDef.name}. Need ${petDef.hatch_cost_sc} SC`,
      }, { status: 400 });
    }

    const hatchReady = new Date(now.getTime() + petDef.hatch_hours * 3600 * 1000).toISOString();
    const nowIso = now.toISOString();

    const { data: pet, error } = await supabase
      .from("supapets_pets")
      .insert({
        user_id: userId,
        pet_key: petDef.key,
        pet_name: petDef.name,
        special_trait: petDef.trait,
        hatch_hours: petDef.hatch_hours,
        hatch_cost_sc: petDef.hatch_cost_sc,
        is_hatched: false,
        hatch_ready_at: hatchReady,
        stage: "egg",
        level: 1,
        xp: 0,
        hunger: 60,
        happiness: 60,
        health: 60,
        energy: 60,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    await supabase.from("supapets_actions").insert({
      pet_id: pet.id,
      user_id: userId,
      action: "hatch",
      reward_sc: 0,
      xp_gain: 0,
      meta: { pet_key: petDef.key, hatch_hours: petDef.hatch_hours },
    });

    const { count } = await supabase
      .from("supapets_pets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (Number(count ?? 0) === 1) {
      await unlockAchievement({
        userId,
        achievementKey: "first_hatch",
        title: "First Hatch",
        rewardSC: 50,
        detail: { pet_key: petDef.key },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        pet,
        wallet_balance_sc: spend.balance,
        message: `${petDef.name} egg started hatching`,
      },
    });
  }

  if (action === "care_pet") {
    const petId = String(body?.pet_id ?? "");
    const careAction = String(body?.care_action ?? "").toLowerCase() as CareAction;
    const rule = CARE_RULES[careAction];
    if (!petId || !rule) return NextResponse.json({ success: false, error: "Invalid care action" }, { status: 400 });

    await autoHatchReadyPets(userId);
    await applyPetDecay(userId);

    const { data: pet, error: petErr } = await supabase
      .from("supapets_pets")
      .select("*")
      .eq("id", petId)
      .eq("user_id", userId)
      .single();

    if (petErr || !pet) return NextResponse.json({ success: false, error: "Pet not found" }, { status: 404 });

    if (!pet.is_hatched) {
      return NextResponse.json({ success: false, error: "Pet is still hatching" }, { status: 400 });
    }

    const lastActionField = `last_${careAction}_at`;
    const lastActionTime = pet[lastActionField] ? new Date(String(pet[lastActionField])) : null;
    if (lastActionTime) {
      const elapsedMs = now.getTime() - lastActionTime.getTime();
      const cooldownMs = rule.cooldown_minutes * 60 * 1000;
      if (elapsedMs < cooldownMs) {
        const remainMin = Math.ceil((cooldownMs - elapsedMs) / 60000);
        return NextResponse.json({
          success: false,
          error: `${careAction} cooldown active. Try again in ${remainMin} minute(s)`,
        }, { status: 400 });
      }
    }

    let level = Number(pet.level ?? 1);
    let xp = Number(pet.xp ?? 0) + rule.xp_gain;
    while (xp >= 100) {
      xp -= 100;
      level += 1;
    }

    const updatedPetPayload: Record<string, unknown> = {
      hunger: clampStat(Number(pet.hunger ?? 0) + Number(rule.stats.hunger ?? 0)),
      happiness: clampStat(Number(pet.happiness ?? 0) + Number(rule.stats.happiness ?? 0)),
      health: clampStat(Number(pet.health ?? 0) + Number(rule.stats.health ?? 0)),
      energy: clampStat(Number(pet.energy ?? 0) + Number(rule.stats.energy ?? 0)),
      level,
      xp,
      stage: evolveStage(level),
      updated_at: now.toISOString(),
      [lastActionField]: now.toISOString(),
    };

    const { data: updatedPet, error: updateErr } = await supabase
      .from("supapets_pets")
      .update(updatedPetPayload)
      .eq("id", petId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateErr) return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });

    const reward = Number(rule.reward_sc);
    const newBalance = await creditSC(userId, reward, `supapets_${careAction}`, `🐾 ${rule.note}`);

    await supabase.from("supapets_actions").insert({
      pet_id: petId,
      user_id: userId,
      action: careAction,
      reward_sc: reward,
      xp_gain: rule.xp_gain,
      meta: { cooldown_minutes: rule.cooldown_minutes },
    });

    return NextResponse.json({
      success: true,
      data: {
        pet: updatedPet,
        reward_sc: reward,
        wallet_balance_sc: newBalance,
        message: `${rule.note} · +${reward} SC`,
      },
    });
  }

  if (action === "daily_checkin") {
    const daily = await readDaily(userId);
    const today = toDateOnly(new Date().toISOString());
    const yesterday = toDateOnly(new Date(Date.now() - 86400000).toISOString());
    const lastClaim = toDateOnly(daily?.last_claim_at);

    if (lastClaim === today) {
      return NextResponse.json({ success: false, error: "Daily reward already claimed today" }, { status: 400 });
    }

    const nextStreak = lastClaim === yesterday ? Number(daily?.streak ?? 0) + 1 : 1;
    const streakBonus = nextStreak % DAILY_STREAK_CYCLE === 0 ? DAILY_STREAK_BONUS_SC : 0;
    const rewardTotal = DAILY_BASE_SC + streakBonus;

    await supabase
      .from("supapets_daily")
      .update({
        streak: nextStreak,
        last_claim_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    const newBalance = await creditSC(
      userId,
      rewardTotal,
      "supapets_daily_checkin",
      streakBonus > 0 ? `📅 Daily check-in + streak bonus` : `📅 Daily check-in`,
    );

    if (nextStreak === 1) {
      await unlockAchievement({
        userId,
        achievementKey: "first_daily",
        title: "First Daily Claim",
        rewardSC: 20,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        streak: nextStreak,
        reward_sc: rewardTotal,
        streak_bonus_sc: streakBonus,
        wallet_balance_sc: newBalance,
        message: streakBonus > 0
          ? `Daily claimed + streak bonus! +${rewardTotal} SC`
          : `Daily claimed! +${rewardTotal} SC`,
      },
    });
  }

  if (action === "buy_item") {
    const itemKey = String(body?.item_key ?? "") as ShopItemKey;
    const qtyRaw = Number(body?.quantity ?? 1);
    const quantity = Number.isFinite(qtyRaw) ? Math.max(1, Math.min(999, Math.floor(qtyRaw))) : 1;
    const item = SHOP_ITEMS[itemKey];
    if (!item) return NextResponse.json({ success: false, error: "Invalid shop item" }, { status: 400 });

    const totalCost = item.cost_sc * quantity;
    const spent = await spendSC(
      userId,
      totalCost,
      "supapets_buy_item",
      `🛒 Bought ${quantity}x ${item.name}`,
    );
    if (!spent.ok) {
      return NextResponse.json({ success: false, error: `Not enough SC. Need ${totalCost} SC` }, { status: 400 });
    }

    const { data: inv } = await supabase
      .from("supapets_inventory")
      .select("quantity")
      .eq("user_id", userId)
      .eq("item_key", itemKey)
      .maybeSingle();
    const nextQty = Number(inv?.quantity ?? 0) + quantity;

    if (inv) {
      await supabase
        .from("supapets_inventory")
        .update({ quantity: nextQty, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("item_key", itemKey);
    } else {
      await supabase.from("supapets_inventory").insert({
        user_id: userId,
        item_key: itemKey,
        quantity,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        item_key: itemKey,
        quantity: nextQty,
        wallet_balance_sc: spent.balance,
        message: `Bought ${quantity}x ${item.name}`,
      },
    });
  }

  if (action === "use_item") {
    const itemKey = String(body?.item_key ?? "") as ShopItemKey;
    const petId = String(body?.pet_id ?? "");
    const item = SHOP_ITEMS[itemKey];
    if (!item || !petId) return NextResponse.json({ success: false, error: "Invalid item usage request" }, { status: 400 });

    await autoHatchReadyPets(userId);
    await applyPetDecay(userId);

    const { data: inv } = await supabase
      .from("supapets_inventory")
      .select("quantity")
      .eq("user_id", userId)
      .eq("item_key", itemKey)
      .maybeSingle();
    const qty = Number(inv?.quantity ?? 0);
    if (qty <= 0) return NextResponse.json({ success: false, error: "Item not available in inventory" }, { status: 400 });

    const { data: pet } = await supabase
      .from("supapets_pets")
      .select("*")
      .eq("id", petId)
      .eq("user_id", userId)
      .single();
    if (!pet) return NextResponse.json({ success: false, error: "Pet not found" }, { status: 404 });
    if (!pet.is_hatched) return NextResponse.json({ success: false, error: "Pet is still hatching" }, { status: 400 });

    let level = Number(pet.level ?? 1);
    let xp = Number(pet.xp ?? 0) + Number(item.xp_gain ?? 0);
    while (xp >= 100) {
      xp -= 100;
      level += 1;
    }

    const { data: updatedPet } = await supabase
      .from("supapets_pets")
      .update({
        hunger: clampStat(Number(pet.hunger ?? 0) + Number(item.effects.hunger ?? 0)),
        happiness: clampStat(Number(pet.happiness ?? 0) + Number(item.effects.happiness ?? 0)),
        health: clampStat(Number(pet.health ?? 0) + Number(item.effects.health ?? 0)),
        energy: clampStat(Number(pet.energy ?? 0) + Number(item.effects.energy ?? 0)),
        level,
        xp,
        stage: evolveStage(level),
        updated_at: new Date().toISOString(),
      })
      .eq("id", petId)
      .eq("user_id", userId)
      .select("*")
      .single();

    await supabase
      .from("supapets_inventory")
      .update({ quantity: Math.max(0, qty - 1), updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("item_key", itemKey);

    await supabase.from("supapets_actions").insert({
      pet_id: petId,
      user_id: userId,
      action: "item_use",
      reward_sc: 0,
      xp_gain: item.xp_gain,
      meta: { item_key: itemKey },
    });

    return NextResponse.json({
      success: true,
      data: {
        pet: updatedPet,
        item_key: itemKey,
        inventory_left: Math.max(0, qty - 1),
        message: `${item.note}`,
      },
    });
  }

  if (action === "play_minigame") {
    const gameType = String(body?.game_type ?? "quick_tap") as MiniGameType;
    const petId = String(body?.pet_id ?? "");
    if (gameType !== "quick_tap" || !petId) {
      return NextResponse.json({ success: false, error: "Invalid mini-game request" }, { status: 400 });
    }

    await autoHatchReadyPets(userId);
    await applyPetDecay(userId);

    const { data: pet } = await supabase
      .from("supapets_pets")
      .select("*")
      .eq("id", petId)
      .eq("user_id", userId)
      .single();
    if (!pet) return NextResponse.json({ success: false, error: "Pet not found" }, { status: 404 });
    if (!pet.is_hatched) return NextResponse.json({ success: false, error: "Pet is still hatching" }, { status: 400 });

    const state = await normalizeMinigameState(userId);
    const now = new Date();
    const nowIso = now.toISOString();
    const lastPlay = state?.last_play_at ? new Date(String(state.last_play_at)) : null;
    if (lastPlay) {
      const elapsedSec = Math.floor((now.getTime() - lastPlay.getTime()) / 1000);
      if (elapsedSec < MINIGAME_COOLDOWN_SECONDS) {
        return NextResponse.json({
          success: false,
          error: `Mini-game cooldown active. Try again in ${MINIGAME_COOLDOWN_SECONDS - elapsedSec}s`,
        }, { status: 400 });
      }
    }

    const playsToday = Number(state?.plays_today ?? 0);
    const dailyEarned = Number(state?.daily_reward_sc ?? 0);
    if (playsToday >= MINIGAME_DAILY_PLAY_CAP) {
      return NextResponse.json({ success: false, error: "Daily mini-game play cap reached" }, { status: 400 });
    }
    if (dailyEarned >= MINIGAME_DAILY_REWARD_CAP) {
      return NextResponse.json({ success: false, error: "Daily mini-game reward cap reached" }, { status: 400 });
    }

    const avgStat = Math.round((Number(pet.hunger ?? 0) + Number(pet.happiness ?? 0) + Number(pet.health ?? 0) + Number(pet.energy ?? 0)) / 4);
    const statBonus = Math.max(0, Math.floor((avgStat - 50) / 10));
    const rand = seededRand(`${userId}:${petId}:${nowIso}`);
    const baseReward = 6 + Math.floor(rand * 13) + statBonus;
    const finalReward = Math.min(baseReward, Math.max(0, MINIGAME_DAILY_REWARD_CAP - dailyEarned));

    const walletBalance = finalReward > 0
      ? await creditSC(userId, finalReward, "supapets_minigame_quick_tap", "🎮 SupaPets mini-game reward")
      : Number((await readWallet(userId))?.balance ?? 0);

    const nextState = {
      plays_today: playsToday + 1,
      total_plays: Number(state?.total_plays ?? 0) + 1,
      daily_reward_sc: dailyEarned + finalReward,
      last_play_at: nowIso,
      last_reset_date: toDateOnly(nowIso),
      updated_at: nowIso,
    };
    await supabase.from("supapets_minigame_state").update(nextState).eq("user_id", userId);

    await supabase.from("supapets_actions").insert({
      pet_id: petId,
      user_id: userId,
      action: "play",
      reward_sc: finalReward,
      xp_gain: 4,
      meta: { game_type: gameType, avg_stat: avgStat },
    });

    let level = Number(pet.level ?? 1);
    let xp = Number(pet.xp ?? 0) + 4;
    while (xp >= 100) {
      xp -= 100;
      level += 1;
    }
    await supabase
      .from("supapets_pets")
      .update({
        xp,
        level,
        stage: evolveStage(level),
        updated_at: nowIso,
      })
      .eq("id", petId)
      .eq("user_id", userId);

    if (nextState.total_plays >= 10) {
      await unlockAchievement({
        userId,
        achievementKey: "minigame_10",
        title: "Mini Gamer x10",
        rewardSC: 40,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        game_type: gameType,
        reward_sc: finalReward,
        wallet_balance_sc: walletBalance,
        minigame: {
          plays_today: nextState.plays_today,
          total_plays: nextState.total_plays,
          daily_reward_sc: nextState.daily_reward_sc,
          plays_left_today: Math.max(0, MINIGAME_DAILY_PLAY_CAP - nextState.plays_today),
          daily_reward_left: Math.max(0, MINIGAME_DAILY_REWARD_CAP - nextState.daily_reward_sc),
          cooldown_seconds: MINIGAME_COOLDOWN_SECONDS,
          last_play_at: nextState.last_play_at,
        },
        message: finalReward > 0
          ? `Mini-game completed! +${finalReward} SC`
          : "Mini-game completed. Daily reward cap reached.",
      },
    });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
