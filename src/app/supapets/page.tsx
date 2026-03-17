"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import BuyCreditsWidget from "@/components/BuyCreditsWidget";
import styles from "./page.module.css";

type PetCatalogItem = {
  key: string;
  name: string;
  type: string;
  trait: string;
  hatch_hours: number;
  hatch_cost_sc: number;
};

type MyPet = {
  id: string;
  pet_key: string;
  pet_name: string;
  special_trait: string;
  hatch_ready_at: string;
  is_hatched: boolean;
  level: number;
  xp: number;
  stage: "egg" | "baby" | "teen" | "adult";
  hunger: number;
  happiness: number;
  health: number;
  energy: number;
};

type SupaPetsPayload = {
  catalog: PetCatalogItem[];
  pets: MyPet[];
  shop_items: Array<{
    item_key: string;
    emoji: string;
    name: string;
    cost_sc: number;
    note: string;
  }>;
  inventory: Array<{ item_key: string; quantity: number }>;
  daily: {
    streak: number;
    last_claim_date: string | null;
    can_claim_today: boolean;
    next_reward_sc: number;
  };
  minigame: {
    plays_today: number;
    total_plays: number;
    daily_reward_sc: number;
    plays_left_today: number;
    daily_reward_left: number;
    cooldown_seconds: number;
    last_play_at: string | null;
  };
  achievements: Array<{
    achievement_key: string;
    title: string;
    reward_sc: number;
    unlocked_at: string;
  }>;
  wallet_balance_sc: number;
  server_time: string;
};

const CARE_ACTIONS: Array<{ id: "feed" | "play" | "clean" | "sleep"; icon: string; label: string }> = [
  { id: "feed", icon: "🍖", label: "Feed" },
  { id: "play", icon: "🎾", label: "Play" },
  { id: "clean", icon: "🛁", label: "Clean" },
  { id: "sleep", icon: "😴", label: "Sleep" },
];

const INTRO_PETS = [
  { icon: "🐱", name: "Fluffy", meta: "Cat · 12h hatch" },
  { icon: "🐶", name: "Barky", meta: "Dog · 12h hatch" },
  { icon: "🐉", name: "Scaly", meta: "Dragon · 24h hatch" },
  { icon: "🦄", name: "Horn", meta: "Unicorn · 24h hatch" },
];

const INTRO_LOOP = [
  "Buy/earn Supapi Credits",
  "Hatch egg and wait timer",
  "Care daily: Feed, Play, Clean, Sleep",
  "Level up and earn more SC rewards",
];
const SKELETON_ITEMS = [1, 2, 3, 4];

const PET_KEY_EMOJI: Record<string, string> = {
  fluffy: "🐱", barky: "🐶", hoppy: "🐰", scaly: "🐉", chirpy: "🐦",
  slither: "🐍", fins: "🐟", horn: "🦄", spot: "🐕", pebble: "🐢",
};

function timeLeft(targetIso: string) {
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return "Ready to hatch";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

function statClass(value: number) {
  if (value >= 70) return styles.statGood;
  if (value >= 40) return styles.statWarn;
  return styles.statBad;
}

/** Growth stage: label + progress to next stage (level 5 = Teen, level 10 = Adult) */
function growthStageInfo(level: number, stage: string, xp: number): { label: string; nextLabel: string; progressPct: number; progressText: string } {
  const l = Math.max(1, level);
  const xpInLevel = Math.min(100, Math.max(0, xp));
  if (stage === "baby" || l < 5) {
    const totalXpToTeen = 400;
    const currentXp = (l - 1) * 100 + xpInLevel;
    return {
      label: "Baby",
      nextLabel: "Teen (Level 5)",
      progressPct: l >= 5 ? 100 : (currentXp / totalXpToTeen) * 100,
      progressText: l >= 5 ? "Ready for Teen!" : `Level ${l}/5 to Teen`,
    };
  }
  if (stage === "teen" || l < 10) {
    return {
      label: "Teen",
      nextLabel: "Adult (Level 10)",
      progressPct: l >= 10 ? 100 : ((l - 5) * 100 + xpInLevel) / 500 * 100,
      progressText: l >= 10 ? "Full growth!" : `Level ${l}/10 to Adult`,
    };
  }
  return {
    label: "Adult",
    nextLabel: "—",
    progressPct: 100,
    progressText: "Full growth",
  };
}

export default function SupaPetsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<SupaPetsPayload | null>(null);
  const [miniGamePetId, setMiniGamePetId] = useState("");
  const token = () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "");

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch("/api/supapets", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d?.success) setData(d.data as SupaPetsPayload);
      else setMsg(`❌ ${d?.error ?? "Failed to load SupaPets"}`);
    } catch {
      setMsg("❌ Failed to load SupaPets");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!data?.pets?.length) {
      setMiniGamePetId("");
      return;
    }
    if (miniGamePetId && data.pets.some((p) => p.id === miniGamePetId)) return;
    const firstHatched = data.pets.find((p) => p.is_hatched);
    setMiniGamePetId(firstHatched?.id ?? data.pets[0]?.id ?? "");
  }, [data, miniGamePetId]);

  const hatchEgg = async (petKey: string) => {
    if (!user || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/supapets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ action: "hatch_egg", pet_key: petKey }),
      });
      const d = await r.json();
      if (d?.success) {
        setMsg(`✅ ${d?.data?.message ?? "Egg hatching started"}`);
        await fetchData();
      } else {
        setMsg(`❌ ${d?.error ?? "Failed to hatch egg"}`);
      }
    } catch {
      setMsg("❌ Failed to hatch egg");
    } finally {
      setBusy(false);
    }
  };

  const carePet = async (petId: string, careAction: "feed" | "play" | "clean" | "sleep") => {
    if (!user || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/supapets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ action: "care_pet", pet_id: petId, care_action: careAction }),
      });
      const d = await r.json();
      if (d?.success) {
        setMsg(`✅ ${d?.data?.message ?? "Pet care completed"}`);
        await fetchData();
      } else {
        setMsg(`❌ ${d?.error ?? "Failed to care pet"}`);
      }
    } catch {
      setMsg("❌ Failed to care pet");
    } finally {
      setBusy(false);
    }
  };

  const claimDaily = async () => {
    if (!user || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/supapets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ action: "daily_checkin" }),
      });
      const d = await r.json();
      if (d?.success) {
        setMsg(`✅ ${d?.data?.message ?? "Daily claimed"}`);
        await fetchData();
      } else {
        setMsg(`❌ ${d?.error ?? "Failed to claim daily"}`);
      }
    } catch {
      setMsg("❌ Failed to claim daily");
    } finally {
      setBusy(false);
    }
  };

  const buyItem = async (itemKey: string) => {
    if (!user || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/supapets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ action: "buy_item", item_key: itemKey, quantity: 1 }),
      });
      const d = await r.json();
      if (d?.success) {
        setMsg(`✅ ${d?.data?.message ?? "Item purchased"}`);
        await fetchData();
      } else {
        setMsg(`❌ ${d?.error ?? "Failed to buy item"}`);
      }
    } catch {
      setMsg("❌ Failed to buy item");
    } finally {
      setBusy(false);
    }
  };

  const useItem = async (petId: string, itemKey: string) => {
    if (!user || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/supapets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ action: "use_item", pet_id: petId, item_key: itemKey }),
      });
      const d = await r.json();
      if (d?.success) {
        setMsg(`✅ ${d?.data?.message ?? "Item used"}`);
        await fetchData();
      } else {
        setMsg(`❌ ${d?.error ?? "Failed to use item"}`);
      }
    } catch {
      setMsg("❌ Failed to use item");
    } finally {
      setBusy(false);
    }
  };

  const playMiniGame = async () => {
    if (!user || busy || !miniGamePetId) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/supapets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ action: "play_minigame", game_type: "quick_tap", pet_id: miniGamePetId }),
      });
      const d = await r.json();
      if (d?.success) {
        setMsg(`✅ ${d?.data?.message ?? "Mini-game completed"}`);
        await fetchData();
      } else {
        setMsg(`❌ ${d?.error ?? "Failed to play mini-game"}`);
      }
    } catch {
      setMsg("❌ Failed to play mini-game");
    } finally {
      setBusy(false);
    }
  };

  const inventoryMap = new Map(
    (data?.inventory ?? []).map((row) => [String(row.item_key), Number(row.quantity ?? 0)]),
  );

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.introHero}>
          <div className={styles.heroBadge}>🎮 Pi Virtual Pet Game</div>
          <div className={styles.introIcon}>🐾</div>
          <h1 className={styles.title}>SupaPets</h1>
          <p className={styles.sub}>Raise virtual pets, care daily, level up, and earn Supapi Credits.</p>
          <div className={styles.introActions}>
            <button className={styles.btnPrimary} onClick={() => router.push("/dashboard")}>
              Sign in with Pi to Start
            </button>
            <Link href="/rewards" className={styles.btnSecondary}>
              See Supapi Credits Wallet
            </Link>
          </div>
        </div>

        <div className={styles.introSection}>
          <div className={styles.sectionTitle}>🐣 Featured Pets</div>
          <div className={styles.introPetsGrid}>
            {INTRO_PETS.map((pet) => (
              <div key={pet.name} className={styles.introPetCard}>
                <div className={styles.introPetIcon}>{pet.icon}</div>
                <div>
                  <div className={styles.introPetName}>{pet.name}</div>
                  <div className={styles.introPetMeta}>{pet.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.introSection}>
          <div className={styles.sectionTitle}>🔁 Core Game Loop</div>
          <div className={styles.introLoop}>
            {INTRO_LOOP.map((step, idx) => (
              <div key={step} className={styles.introLoopRow}>
                <span className={styles.introStepNo}>{idx + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <div className={styles.introNote}>
            Reward range: daily care and gameplay can scale from low to high SC based on progression.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.icon}>🐾</span>
          <div className={styles.headerText}>
            <div className={styles.heroBadge}>🎮 Pi Virtual Pet Game</div>
            <h1 className={styles.title}>SupaPets</h1>
            <p className={styles.sub}>Hatch pets, care daily, and grow your Supapi Credit rewards.</p>
            <div className={styles.heroMetaRow}>
              <span className={styles.heroMetaChip}>🔥 Streak: {Number(data?.daily?.streak ?? 0)} day(s)</span>
              <span className={styles.heroMetaChip}>🎁 Next: +{Number(data?.daily?.next_reward_sc ?? 20)} SC</span>
            </div>
          </div>
        </div>
        <Link href="/rewards" className={styles.walletBtn}>
          <span className={styles.walletLabel}>💎 Wallet</span>
          <span className={styles.walletValue}>{Number(data?.wallet_balance_sc ?? 0).toLocaleString()} SC</span>
        </Link>
      </div>

      {!!msg && <div className={styles.msg}>{msg}</div>}

      <section className={styles.section}>
        <div className={styles.sectionTitle}>📅 Daily Streak</div>
        <div className={styles.dailyRow}>
          <div className={styles.dailyStat}>
            <div className={styles.dailyLabel}>Current Streak</div>
            <div className={styles.dailyValue}>{Number(data?.daily?.streak ?? 0)} day(s)</div>
          </div>
          <div className={styles.dailyStat}>
            <div className={styles.dailyLabel}>Next Claim</div>
            <div className={styles.dailyValue}>+{Number(data?.daily?.next_reward_sc ?? 20)} SC</div>
          </div>
          <button
            className={styles.btnPrimary}
            disabled={busy || !Boolean(data?.daily?.can_claim_today)}
            onClick={claimDaily}
          >
            {data?.daily?.can_claim_today ? "Claim Daily Reward" : "Claimed Today"}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>🎮 Mini-Game</div>
        <div className={styles.dailyRow}>
          <div className={styles.dailyStat}>
            <div className={styles.dailyLabel}>Plays Today</div>
            <div className={styles.dailyValue}>
              {Number(data?.minigame?.plays_today ?? 0)} / 20
            </div>
          </div>
          <div className={styles.dailyStat}>
            <div className={styles.dailyLabel}>Earned Today</div>
            <div className={styles.dailyValue}>
              +{Number(data?.minigame?.daily_reward_sc ?? 0)} SC
            </div>
          </div>
          <div className={styles.dailyStat}>
            <div className={styles.dailyLabel}>Play With Pet</div>
            <select
              className={styles.selectInput}
              value={miniGamePetId}
              onChange={(e) => setMiniGamePetId(e.target.value)}
            >
              {(data?.pets ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pet_name} {p.is_hatched ? "" : "(hatching)"}
                </option>
              ))}
            </select>
          </div>
          <button
            className={styles.btnPrimary}
            disabled={
              busy ||
              !miniGamePetId ||
              Number(data?.minigame?.plays_left_today ?? 0) <= 0
            }
            onClick={playMiniGame}
          >
            Play Quick Tap (+SC)
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>🥚 Hatchery</div>
        {loading ? (
          <div className={styles.grid}>
            {SKELETON_ITEMS.map((n) => (
              <div key={`hatch-${n}`} className={styles.skeletonCard} />
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {(data?.catalog ?? []).map((pet) => {
              const canHatch = Number(data?.wallet_balance_sc ?? 0) >= pet.hatch_cost_sc;
              return (
                <div key={pet.key} className={styles.card}>
                  <div className={styles.cardHead}>
                    <div className={styles.petName}>{pet.name}</div>
                    <div className={styles.petType}>{pet.type}</div>
                  </div>
                  <div className={styles.petTrait}>{pet.trait}</div>
                  <div className={styles.petMeta}>
                    <span>⏱ {pet.hatch_hours}h</span>
                    <span>💎 {pet.hatch_cost_sc} SC</span>
                  </div>
                  <button
                    className={styles.btnPrimary}
                    disabled={busy || !canHatch}
                    onClick={() => hatchEgg(pet.key)}
                  >
                    {canHatch ? "Hatch Egg" : "Not enough SC"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>🛒 Shop & Inventory</div>
        <div className={styles.grid}>
          {(data?.shop_items ?? []).map((item) => {
            const qty = Number(inventoryMap.get(item.item_key) ?? 0);
            return (
              <div key={item.item_key} className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={styles.petName}>
                    {item.emoji} {item.name}
                  </div>
                  <div className={styles.petType}>{qty} owned</div>
                </div>
                <div className={styles.petTrait}>{item.note}</div>
                <div className={styles.petMeta}>
                  <span>Cost</span>
                  <span>💎 {item.cost_sc} SC</span>
                </div>
                <button className={styles.btnSecondary} disabled={busy} onClick={() => buyItem(item.item_key)}>
                  Buy 1
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>🐶 My Pets</div>
        {loading ? (
          <div className={styles.grid}>
            {SKELETON_ITEMS.map((n) => (
              <div key={`pet-${n}`} className={styles.skeletonCard} />
            ))}
          </div>
        ) : !(data?.pets?.length ?? 0) ? (
          <div className={styles.empty}>No pets yet. Hatch your first egg above.</div>
        ) : (
          <div className={styles.grid}>
            {(data?.pets ?? []).map((pet) => {
              const growth = pet.is_hatched ? growthStageInfo(pet.level, pet.stage, pet.xp) : null;
              const progressPct = growth?.progressPct ?? 0;
              const stageClass = pet.is_hatched ? styles[`petVisualStage_${pet.stage}`] : styles.petVisualStage_egg;
              const emoji = pet.is_hatched ? (PET_KEY_EMOJI[pet.pet_key] ?? "🐾") : "🥚";
              return (
              <div key={pet.id} className={styles.card}>
                {/* Realtime visual growth: emoji scales by stage, ring shows progress to next */}
                <div className={styles.petVisualWrap} style={{ ["--growthDeg" as string]: `${(progressPct / 100) * 360}deg` }}>
                  <div className={styles.petVisualInner}>
                    <span className={`${styles.petVisualEmoji} ${stageClass}`}>{emoji}</span>
                  </div>
                </div>
                <div className={styles.cardHead}>
                  <div className={styles.petName}>{pet.pet_name}</div>
                  <div className={styles.stageBadge}>{pet.stage.charAt(0).toUpperCase() + pet.stage.slice(1)}</div>
                </div>

                {!pet.is_hatched ? (
                  <div className={styles.hatchBox}>
                    <div className={styles.hatchLabel}>Egg in incubator</div>
                    <div className={styles.hatchTimer}>{timeLeft(pet.hatch_ready_at)}</div>
                  </div>
                ) : (
                  <>
                    <div className={styles.levelRow}>
                      <span>Level {pet.level}</span>
                      <span>XP {pet.xp}/100</span>
                    </div>

                    {/* Growth: current stage + progress to next */}
                    {(() => {
                      const g = growthStageInfo(pet.level, pet.stage, pet.xp);
                      return (
                        <div className={styles.growthBlock}>
                          <div className={styles.growthHeader}>
                            <span className={styles.growthLabel}>🌱 Growth</span>
                            <span className={styles.growthStage}>{g.label}</span>
                          </div>
                          <div className={styles.growthProgressWrap}>
                            <div className={styles.growthProgressBar}>
                              <i style={{ width: `${g.progressPct}%` }} />
                            </div>
                            <div className={styles.growthProgressText}>{g.progressText}</div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className={styles.statBlock}>
                      <div className={styles.statRow}>
                        <span>Hunger</span>
                        <span>{pet.hunger}</span>
                      </div>
                      <div className={`${styles.statBar} ${statClass(pet.hunger)}`}>
                        <i style={{ width: `${pet.hunger}%` }} />
                      </div>
                    </div>

                    <div className={styles.statBlock}>
                      <div className={styles.statRow}>
                        <span>Happiness</span>
                        <span>{pet.happiness}</span>
                      </div>
                      <div className={`${styles.statBar} ${statClass(pet.happiness)}`}>
                        <i style={{ width: `${pet.happiness}%` }} />
                      </div>
                    </div>

                    <div className={styles.statBlock}>
                      <div className={styles.statRow}>
                        <span>Health</span>
                        <span>{pet.health}</span>
                      </div>
                      <div className={`${styles.statBar} ${statClass(pet.health)}`}>
                        <i style={{ width: `${pet.health}%` }} />
                      </div>
                    </div>

                    <div className={styles.statBlock}>
                      <div className={styles.statRow}>
                        <span>Energy</span>
                        <span>{pet.energy}</span>
                      </div>
                      <div className={`${styles.statBar} ${statClass(pet.energy)}`}>
                        <i style={{ width: `${pet.energy}%` }} />
                      </div>
                    </div>

                    <div className={styles.careGrid}>
                      {CARE_ACTIONS.map((a) => (
                        <button
                          key={a.id}
                          className={styles.btnSecondary}
                          disabled={busy}
                          onClick={() => carePet(pet.id, a.id)}
                        >
                          {a.icon} {a.label}
                        </button>
                      ))}
                    </div>
                    <div className={styles.itemUseGrid}>
                      {(data?.shop_items ?? [])
                        .filter((i) => Number(inventoryMap.get(i.item_key) ?? 0) > 0)
                        .slice(0, 4)
                        .map((item) => (
                          <button
                            key={`${pet.id}-${item.item_key}`}
                            className={styles.itemUseBtn}
                            disabled={busy}
                            onClick={() => useItem(pet.id, item.item_key)}
                          >
                            {item.emoji} Use ({Number(inventoryMap.get(item.item_key) ?? 0)})
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            );
            })}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>🏆 Achievements</div>
        {!(data?.achievements?.length ?? 0) ? (
          <div className={styles.empty}>No achievements yet. Hatch and claim daily to unlock rewards.</div>
        ) : (
          <div className={styles.achievementList}>
            {(data?.achievements ?? []).slice(0, 8).map((a) => (
              <div key={`${a.achievement_key}-${a.unlocked_at}`} className={styles.achievementCard}>
                <div className={styles.achievementTitle}>{a.title}</div>
                <div className={styles.achievementMeta}>+{a.reward_sc} SC</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <BuyCreditsWidget
        onSuccess={fetchData}
        onMessage={setMsg}
        showTitle={true}
        className={styles.buySection}
      />
    </div>
  );
}
