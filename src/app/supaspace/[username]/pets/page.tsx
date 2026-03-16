"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "../../page.module.css";

const PET_EMOJI: Record<string, string> = {
  fluffy: "🐱",
  barky: "🐶",
  hoppy: "🐰",
  scaly: "🐉",
  chirpy: "🐦",
  slither: "🐍",
  fins: "🐟",
  horn: "🦄",
  spot: "🐕",
  pebble: "🐢",
};

type PetRow = {
  id: string;
  pet_key: string;
  pet_name: string;
  stage: string;
  level: number;
  xp?: number;
  is_hatched: boolean;
  hatch_ready_at?: string | null;
  hunger: number;
  happiness: number;
  health: number;
  energy: number;
  created_at?: string;
};

function statClass(value: number) {
  if (value >= 70) return styles.petStatGood;
  if (value >= 40) return styles.petStatWarn;
  return styles.petStatBad;
}

function timeLeft(targetIso: string | null | undefined) {
  if (!targetIso) return "—";
  const ms = new Date(targetIso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "Ready to hatch!";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

/** Progress to next growth stage (0–100) for visual ring. Level 5 = Teen, 10 = Adult. */
function growthProgressPct(pet: PetRow): number {
  if (!pet.is_hatched) return 0;
  const l = Math.max(1, pet.level);
  const xp = Math.min(100, Math.max(0, pet.xp ?? 0));
  if (l < 5) {
    const current = (l - 1) * 100 + xp;
    return (current / 400) * 100;
  }
  if (l < 10) {
    return ((l - 5) * 100 + xp) / 500 * 100;
  }
  return 100;
}

export default function PetsDetailPage() {
  const params = useParams();
  const username = params.username as string;
  const { user } = useAuth();
  const [pets, setPets] = useState<PetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const isOwnProfile = !!user && user.username === username;

  useEffect(() => {
    Promise.all([
      fetch(`/api/supaspace/stats/${encodeURIComponent(username)}`).then((r) => r.json()),
      fetch(`/api/supaspace/pets/${encodeURIComponent(username)}`).then((r) => r.json()),
    ])
      .then(([statsRes, petsRes]) => {
        if (statsRes.success === false) setNotFound(true);
        if (petsRes.success && Array.isArray(petsRes.data)) setPets(petsRes.data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  if (notFound) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👤</div>
          <div className={styles.emptyTitle}>User not found</div>
          <Link href="/myspace" className={styles.emptyBtn}>Back to SupaSpace</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.followListHeader}>
        <Link href={`/myspace/${username}`} className={styles.followListBack}>← Profile</Link>
        <h1 className={styles.followListTitle}>Pets</h1>
        <p className={styles.followListSub}>
          {loading ? "..." : `${pets.length} pet${pets.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className={styles.body}>
        {loading ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⏳</div>
            <div className={styles.emptyTitle}>Loading...</div>
          </div>
        ) : pets.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🐾</div>
            <div className={styles.emptyTitle}>
              {isOwnProfile ? "No pets yet" : `@${username} has no pets yet`}
            </div>
            <div className={styles.emptyDesc}>
              {isOwnProfile
                ? "Hatch and care for virtual pets on SupaPets. Feed, play and earn SC rewards."
                : `@${username} has not adopted any pets yet.`}
            </div>
            {isOwnProfile && (
              <Link href="/supapets" className={styles.emptyBtn}>Go to SupaPets →</Link>
            )}
            {!isOwnProfile && (
              <Link href={`/myspace/${username}`} className={styles.emptyBtn}>Back to Profile</Link>
            )}
          </div>
        ) : (
          <div className={styles.petsList}>
            {pets.map((pet) => {
              const progressPct = growthProgressPct(pet);
              const stageClass = pet.is_hatched ? styles[`petVisualStage_${pet.stage}`] : styles.petVisualStage_egg;
              const emoji = pet.is_hatched ? (PET_EMOJI[pet.pet_key] ?? "🐾") : "🥚";
              return (
              <div key={pet.id} className={styles.petCard}>
                {/* Realtime visual growth: emoji scales by stage, ring shows progress to next */}
                <div className={styles.petVisualWrap} style={{ ["--growthDeg" as string]: `${(progressPct / 100) * 360}deg` }}>
                  <div className={styles.petVisualInner}>
                    <span className={`${styles.petVisualEmoji} ${stageClass}`}>{emoji}</span>
                  </div>
                </div>
                <div className={styles.petCardTop}>
                  <div className={styles.petCardInfo}>
                    <div className={styles.petCardName}>{pet.pet_name}</div>
                    <div className={styles.petCardMeta}>
                      {pet.is_hatched
                        ? `${pet.stage} · Level ${pet.level}`
                        : `Egg · ${timeLeft(pet.hatch_ready_at ?? pet.created_at ?? "")}`}
                    </div>
                  </div>
                </div>
                {pet.is_hatched ? (
                  <>
                    <div className={styles.petStatRow}>
                      <span className={styles.petStatLabel}>Hunger</span>
                      <div className={styles.petStatBar}>
                        <div
                          className={`${styles.petStatFill} ${statClass(pet.hunger)}`}
                          style={{ width: `${pet.hunger}%` }}
                        />
                      </div>
                      <span className={styles.petStatValue}>{pet.hunger}</span>
                    </div>
                    <div className={styles.petStatRow}>
                      <span className={styles.petStatLabel}>Happiness</span>
                      <div className={styles.petStatBar}>
                        <div
                          className={`${styles.petStatFill} ${statClass(pet.happiness)}`}
                          style={{ width: `${pet.happiness}%` }}
                        />
                      </div>
                      <span className={styles.petStatValue}>{pet.happiness}</span>
                    </div>
                    <div className={styles.petStatRow}>
                      <span className={styles.petStatLabel}>Health</span>
                      <div className={styles.petStatBar}>
                        <div
                          className={`${styles.petStatFill} ${statClass(pet.health)}`}
                          style={{ width: `${pet.health}%` }}
                        />
                      </div>
                      <span className={styles.petStatValue}>{pet.health}</span>
                    </div>
                    <div className={styles.petStatRow}>
                      <span className={styles.petStatLabel}>Energy</span>
                      <div className={styles.petStatBar}>
                        <div
                          className={`${styles.petStatFill} ${statClass(pet.energy)}`}
                          style={{ width: `${pet.energy}%` }}
                        />
                      </div>
                      <span className={styles.petStatValue}>{pet.energy}</span>
                    </div>
                  </>
                ) : (
                  <div className={styles.petEggNotice}>
                    🥚 Egg is hatching. Check back when the timer is done!
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}
        {!loading && pets.length > 0 && isOwnProfile && (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <Link href="/supapets" className={styles.emptyBtn}>Manage on SupaPets →</Link>
          </div>
        )}
        {!loading && pets.length > 0 && !isOwnProfile && (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <Link href={`/myspace/${username}`} className={styles.emptyBtn}>Back to Profile</Link>
          </div>
        )}
      </div>
    </div>
  );
}
