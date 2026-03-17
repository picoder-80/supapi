"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import nextDynamic from "next/dynamic";
import styles from "./page.module.css";

// Leaflet must be dynamically imported (no SSR)
const MapView = nextDynamic(() => import("./MapView"), { ssr: false, loading: () => (
  <div className={styles.mapLoading}><div className={styles.mapLoadingSpinner} />Loading map...</div>
)});

interface PioneerPin {
  id: string; user_id: string; lat: number; lng: number;
  precision: string; status: string; note: string; visible_to?: string;
}
interface PioneerUser {
  id: string; username: string; display_name: string | null;
  avatar_url: string | null; kyc_status: string; bio: string | null; created_at: string;
}
interface PioneerGroup {
  id: string; name: string; description: string; lat: number | null; lng: number | null;
  location: string; cover_emoji: string; member_count: number; is_public: boolean; created_at: string;
}

const PRECISION_OPTS = [
  { id: "exact",    label: "📍 Exact",    desc: "Precise location" },
  { id: "district", label: "🏘️ District", desc: "~2km area" },
  { id: "state",    label: "🗺️ State",    desc: "~20km area" },
];
const STATUS_OPTS = [
  { id: "active", label: "🟢 Active",   desc: "Open to meet" },
  { id: "away",   label: "🟡 Away",     desc: "Busy now" },
];
function getInitial(u: string) { return (u ?? "?").charAt(0).toUpperCase(); }

export default function PioneersPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const token    = () => typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : "";

  const [pins, setPins]     = useState<PioneerPin[]>([]);
  const [users, setUsers]   = useState<Record<string, PioneerUser>>({});
  const [groups, setGroups] = useState<PioneerGroup[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [myPin, setMyPin]   = useState<PioneerPin | null>(null);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<"map" | "list" | "groups">("map");
  const [showPin, setShowPin]   = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [removing, setRemoving] = useState(false);
  const [selected, setSelected] = useState<PioneerPin | null>(null);
  const [userLoc, setUserLoc]   = useState<{ lat: number; lng: number } | null>(null);
  const [toast, setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Pin form
  const [form, setForm] = useState({
    precision: "district", status: "active", visible_to: "everyone", note: "",
  });
  // Create group form
  const [groupForm, setGroupForm] = useState({
    name: "", description: "", location: "", cover_emoji: "🏘️",
  });
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = userLoc ? `?lat=${userLoc.lat}&lng=${userLoc.lng}` : "";
      const r = await fetch(`/api/pioneers${params}`);
      const d = await r.json();
      if (d.success) {
        setPins(d.data.pins ?? []);
        setUsers(d.data.users ?? {});
        setGroups(d.data.groups ?? []);
        setMyGroupIds(new Set(d.data.my_group_ids ?? []));
        if (user?.id) {
          const mine = (d.data.pins ?? []).find((p: PioneerPin) => p.user_id === user.id);
          setMyPin(mine ?? null);
          if (mine) setForm({
            precision:  mine.precision,
            status:     mine.status,
            visible_to: "everyone",
            note:       mine.note ?? "",
          });
        }
      }
    } catch {}
    setLoading(false);
  }, [user?.id, userLoc]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  const handleSavePin = async () => {
    if (!user) { router.push("/dashboard"); return; }
    if (!userLoc) { showToast("Enable location access first", "error"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/pioneers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ ...form, lat: userLoc.lat, lng: userLoc.lng }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(myPin ? "📍 Pin updated!" : "🎉 You're on the map!");
        setShowPin(false);
        fetchData();
      } else { showToast(d.error ?? "Failed to save pin", "error"); }
    } catch { showToast("Something went wrong", "error"); }
    setSaving(false);
  };

  const handleCreateGroup = async () => {
    if (!user) { router.push("/dashboard"); return; }
    const name = groupForm.name.trim();
    if (!name) { showToast("Group name required", "error"); return; }
    setCreatingGroup(true);
    try {
      const r = await fetch("/api/pioneers/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(groupForm),
      });
      const d = await r.json();
      if (d.success) {
        showToast("Group created!");
        setShowCreateGroup(false);
        setGroupForm({ name: "", description: "", location: "", cover_emoji: "🏘️" });
        fetchData();
      } else { showToast(d.error ?? "Failed to create group", "error"); }
    } catch { showToast("Something went wrong", "error"); }
    setCreatingGroup(false);
  };

  const handleJoinGroup = async (g: PioneerGroup) => {
    if (!user) { router.push("/dashboard"); return; }
    if (!g.is_public) { showToast("Private groups require an invite", "error"); return; }
    setJoiningId(g.id);
    try {
      const r = await fetch(`/api/pioneers/groups/${g.id}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d.success) {
        showToast("Joined!");
        setMyGroupIds(prev => new Set([...prev, g.id]));
        fetchData();
      } else { showToast(d.error ?? "Failed to join", "error"); }
    } catch { showToast("Something went wrong", "error"); }
    setJoiningId(null);
  };

  const handleRemovePin = async () => {
    if (!confirm("Remove your pin from the map?")) return;
    setRemoving(true);
    try {
      await fetch("/api/pioneers", { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } });
      setMyPin(null);
      showToast("Pin removed");
      fetchData();
    } catch {}
    setRemoving(false);
  };

  const selectedUser = selected ? users[selected.user_id] : null;
  const activePins   = pins.filter(p => p.status === "active").length;
  const nearbyPins   = userLoc ? pins.filter(p => {
    const dist = Math.sqrt(Math.pow((p.lat - userLoc.lat) * 111, 2) + Math.pow((p.lng - userLoc.lng) * 111, 2));
    return dist <= 10;
  }).length : 0;

  return (
    <div className={styles.page}>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.headerTitle}>🌍 I Am a Pioneer</h1>
            <p className={styles.headerSub}>Find & connect with Pi Pioneers near you</p>
          </div>
          <div className={styles.headerStats}>
            <div className={styles.headerStat}>
              <span className={styles.headerStatNum}>{pins.length}</span>
              <span className={styles.headerStatLabel}>On Map</span>
            </div>
            <div className={styles.headerStatDivider} />
            <div className={styles.headerStat}>
              <span className={styles.headerStatNum}>{activePins}</span>
              <span className={styles.headerStatLabel}>Active</span>
            </div>
            {userLoc && (
              <>
                <div className={styles.headerStatDivider} />
                <div className={styles.headerStat}>
                  <span className={styles.headerStatNum}>{nearbyPins}</span>
                  <span className={styles.headerStatLabel}>Nearby</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* My Pin CTA */}
        <div className={styles.myPinRow}>
          {myPin ? (
            <div className={styles.myPinActive}>
              <span className={styles.myPinDot} />
              <span className={styles.myPinText}>You're on the map — {myPin.precision} precision</span>
              <button className={styles.myPinEdit} onClick={() => setShowPin(true)}>Edit</button>
              <button className={styles.myPinRemove} onClick={handleRemovePin} disabled={removing}>✕</button>
            </div>
          ) : (
            <button className={styles.pinMeBtn} onClick={() => user ? setShowPin(true) : router.push("/dashboard")}>
              📍 {user ? "Pin Me on the Map" : "Sign in to Pin Yourself"}
            </button>
          )}
        </div>

        {/* View Tabs */}
        <div className={styles.viewTabs}>
          {(["map", "list", "groups"] as const).map(v => (
            <button
              key={v}
              className={`${styles.viewTab} ${view === v ? styles.viewTabActive : ""}`}
              onClick={() => setView(v)}
            >
              {v === "map" ? "🗺️ Map" : v === "list" ? "👥 Pioneers" : "🏘️ Groups"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Map View ── */}
      {view === "map" && (
        <div className={styles.mapWrap}>
          <MapView
            pins={pins}
            users={users}
            myUserId={user?.id}
            userLoc={userLoc}
            onSelectPin={setSelected}
          />
        </div>
      )}

      {/* ── List View ── */}
      {view === "list" && (
        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingRow}>
              {[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
            </div>
          ) : pins.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🌍</div>
              <div className={styles.emptyTitle}>No Pioneers on the map yet</div>
              <div className={styles.emptyDesc}>Be the first to pin yourself!</div>
              <button className={styles.emptyBtn} onClick={() => user ? setShowPin(true) : router.push("/dashboard")}>
                📍 Pin Me First
              </button>
            </div>
          ) : (
            <div className={styles.pioneerGrid}>
              {pins.map(pin => {
                const u = users[pin.user_id];
                if (!u) return null;
                const dist = userLoc ? Math.sqrt(
                  Math.pow((pin.lat - userLoc.lat) * 111, 2) +
                  Math.pow((pin.lng - userLoc.lng) * 111 * Math.cos(userLoc.lat * Math.PI / 180), 2)
                ).toFixed(1) : null;
                return (
                  <div key={pin.id} className={styles.pioneerCard} onClick={() => setSelected(pin)}>
                    <div className={styles.pioneerCardTop}>
                      <div className={styles.pioneerAvatar}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt={u.username} className={styles.pioneerAvatarImg} />
                          : <span className={styles.pioneerAvatarInitial}>{getInitial(u.username)}</span>
                        }
                        <span className={`${styles.pioneerStatus} ${pin.status === "active" ? styles.pioneerStatusActive : styles.pioneerStatusAway}`} />
                      </div>
                      <div className={styles.pioneerInfo}>
                        <div className={styles.pioneerName}>
                          {u.display_name ?? u.username}
                          {u.kyc_status === "verified" && <span className={styles.kycBadge}>✅</span>}
                        </div>
                        <div className={styles.pioneerUsername}>@{u.username}</div>
                        {dist && <div className={styles.pioneerDist}>📍 {dist} km away</div>}
                      </div>
                    </div>
                    {pin.note && <div className={styles.pioneerNote}>💬 {pin.note}</div>}
                    {u.bio && <div className={styles.pioneerBio}>{u.bio}</div>}
                    <div className={styles.pioneerCardFooter}>
                      <span className={styles.precisionTag}>{pin.precision === "exact" ? "📍 Exact" : pin.precision === "district" ? "🏘️ District" : "🗺️ State"}</span>
                      <span className={styles.viewProfileBtn}>View Profile →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Groups View ── */}
      {view === "groups" && (
        <div className={styles.body}>
          <div className={styles.groupsHeader}>
            <div className={styles.groupsHeaderText}>
              <div className={styles.groupsTitle}>Local Pi Chapters</div>
              <div className={styles.groupsSub}>Join or create a Pioneer group in your area</div>
            </div>
            <div className={styles.groupsHeaderMeta}>
              <span className={styles.groupsMetaChip}>🏘️ {groups.length} groups</span>
              <span className={styles.groupsMetaChip}>🌍 Community</span>
              {user && (
                <button className={styles.groupsCreateBtn} onClick={() => setShowCreateGroup(true)}>
                  ➕ Create
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className={styles.groupGrid}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className={styles.groupSkeletonCard}>
                  <div className={styles.groupSkeletonEmoji} />
                  <div className={styles.groupSkeletonLineLg} />
                  <div className={styles.groupSkeletonLineMd} />
                  <div className={styles.groupSkeletonLineSm} />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🏘️</div>
              <div className={styles.emptyTitle}>No groups yet</div>
              <div className={styles.emptyDesc}>Start the first Pi chapter in your area!</div>
              <button className={styles.emptyBtn} onClick={() => user ? setShowCreateGroup(true) : router.push("/dashboard")}>
                {user ? "➕ Create Group" : "Sign in to Create Group"}
              </button>
            </div>
          ) : (
            <div className={styles.groupGrid}>
              {groups.map(g => (
                <div key={g.id} className={styles.groupCard}>
                  <div className={styles.groupCardTop}>
                    <div className={styles.groupEmoji}>{g.cover_emoji}</div>
                    <span className={styles.groupVisibility}>{g.is_public ? "Public" : "Private"}</span>
                  </div>
                  <div className={styles.groupName}>{g.name}</div>
                  <div className={styles.groupLocation}>📍 {g.location}</div>
                  <div className={styles.groupDesc}>{g.description}</div>
                  <div className={styles.groupMeta}>Created {new Date(g.created_at).toLocaleDateString()}</div>
                  <div className={styles.groupFooter}>
                    <span className={styles.groupMembers}>👥 {g.member_count ?? 0} members</span>
                    {myGroupIds.has(g.id) ? (
                      <span className={styles.groupJoined}>✓ Joined</span>
                    ) : (
                      <button
                        className={styles.groupJoinBtn}
                        onClick={() => handleJoinGroup(g)}
                        disabled={joiningId === g.id}
                      >
                        {joiningId === g.id ? "..." : g.is_public ? "Join" : "Request"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Pin Profile Popup ── */}
      {selected && selectedUser && (
        <div className={styles.profileModal}>
          <div className={styles.profileModalBackdrop} onClick={() => setSelected(null)} />
          <div className={styles.profileModalSheet}>
            <div className={styles.profileModalHandle} />
            <div className={styles.profileModalTop}>
              <div className={styles.profileModalAvatar}>
                {selectedUser.avatar_url
                  ? <img src={selectedUser.avatar_url} alt={selectedUser.username} className={styles.profileModalAvatarImg} />
                  : <span className={styles.profileModalAvatarInitial}>{getInitial(selectedUser.username)}</span>
                }
                <span className={`${styles.profileModalStatus} ${selected.status === "active" ? styles.profileModalStatusActive : styles.profileModalStatusAway}`} />
              </div>
              <div className={styles.profileModalInfo}>
                <div className={styles.profileModalName}>
                  {selectedUser.display_name ?? selectedUser.username}
                  {selectedUser.kyc_status === "verified" && <span> ✅</span>}
                </div>
                <div className={styles.profileModalUsername}>@{selectedUser.username}</div>
                <div className={styles.profileModalMeta}>
                  <span>{selected.status === "active" ? "🟢 Open to meet" : "🟡 Away"}</span>
                  <span>·</span>
                  <span>{selected.precision === "exact" ? "📍 Exact" : selected.precision === "district" ? "🏘️ District" : "🗺️ State"}</span>
                </div>
              </div>
            </div>
            {selected.note && (
              <div className={styles.profileModalNote}>
                💬 <em>{selected.note}</em>
              </div>
            )}
            {selectedUser.bio && (
              <div className={styles.profileModalBio}>{selectedUser.bio}</div>
            )}
            <div className={styles.profileModalBtns}>
              <a href={`/supaspace/${selectedUser.username}`} className={styles.profileModalViewBtn}>
                🪐 View Full Profile
              </a>
              <button className={styles.profileModalCloseBtn} onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Group Modal ── */}
      {showCreateGroup && (
        <div className={styles.pinModal}>
          <div className={styles.pinModalBackdrop} onClick={() => !creatingGroup && setShowCreateGroup(false)} />
          <div className={styles.pinModalSheet}>
            <div className={styles.pinModalHandle} />
            <div className={styles.pinModalTitle}>➕ Create Local Pi Chapter</div>
            <div className={styles.pinModalSub}>Start a Pioneer group in your area</div>

            <div className={styles.pinFormLabel}>Group Name *</div>
            <input
              className={styles.pinNoteInput}
              placeholder="e.g. Pi Kuala Lumpur"
              value={groupForm.name}
              onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
              maxLength={80}
            />

            <div className={styles.pinFormLabel}>Location</div>
            <input
              className={styles.pinNoteInput}
              placeholder="e.g. Kuala Lumpur, Malaysia"
              value={groupForm.location}
              onChange={e => setGroupForm(f => ({ ...f, location: e.target.value }))}
            />

            <div className={styles.pinFormLabel}>Description</div>
            <textarea
              className={styles.pinNoteInput}
              placeholder="What's this chapter about?"
              value={groupForm.description}
              onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
            />

            <div className={styles.pinFormLabel}>Emoji</div>
            <input
              className={styles.pinNoteInput}
              placeholder="🏘️"
              value={groupForm.cover_emoji}
              onChange={e => setGroupForm(f => ({ ...f, cover_emoji: e.target.value }))}
              maxLength={4}
            />

            <button className={styles.pinSaveBtn} onClick={handleCreateGroup} disabled={creatingGroup || !groupForm.name.trim()}>
              {creatingGroup ? "Creating..." : "Create Group"}
            </button>
            <button className={styles.pinCancelBtn} onClick={() => setShowCreateGroup(false)} disabled={creatingGroup}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Pin Myself Modal ── */}
      {showPin && (
        <div className={styles.pinModal}>
          <div className={styles.pinModalBackdrop} onClick={() => !saving && setShowPin(false)} />
          <div className={styles.pinModalSheet}>
            <div className={styles.pinModalHandle} />
            <div className={styles.pinModalTitle}>📍 {myPin ? "Update Your Pin" : "Pin Yourself on the Map"}</div>
            <div className={styles.pinModalSub}>Let nearby Pioneers find and connect with you</div>

            {!userLoc && (
              <div className={styles.locationWarning}>
                ⚠️ Location access required. Please allow location in your browser.
              </div>
            )}

            {/* Precision */}
            <div className={styles.pinFormLabel}>Location Precision</div>
            <div className={styles.pinOptionGrid}>
              {PRECISION_OPTS.map(o => (
                <button
                  key={o.id}
                  className={`${styles.pinOption} ${form.precision === o.id ? styles.pinOptionActive : ""}`}
                  onClick={() => setForm(f => ({ ...f, precision: o.id }))}
                >
                  <span className={styles.pinOptionLabel}>{o.label}</span>
                  <span className={styles.pinOptionDesc}>{o.desc}</span>
                </button>
              ))}
            </div>

            {/* Status */}
            <div className={styles.pinFormLabel}>Status</div>
            <div className={styles.pinOptionRow}>
              {STATUS_OPTS.map(o => (
                <button
                  key={o.id}
                  className={`${styles.pinOptionHalf} ${form.status === o.id ? styles.pinOptionActive : ""}`}
                  onClick={() => setForm(f => ({ ...f, status: o.id }))}
                >
                  <span className={styles.pinOptionLabel}>{o.label}</span>
                  <span className={styles.pinOptionDesc}>{o.desc}</span>
                </button>
              ))}
            </div>

            {/* Note */}
            <div className={styles.pinFormLabel}>Meet-up Note <span className={styles.pinFormOptional}>(optional)</span></div>
            <textarea
              className={styles.pinNoteInput}
              placeholder="e.g. Available weekends, interested in Pi meetups..."
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              maxLength={120}
              rows={2}
            />
            <div className={styles.pinNoteCount}>{form.note.length}/120</div>

            <button className={styles.pinSaveBtn} onClick={handleSavePin} disabled={saving || !userLoc}>
              {saving ? "Saving..." : myPin ? "Update Pin 📍" : "Pin Me on the Map 🌍"}
            </button>
            {myPin && (
              <button className={styles.pinRemoveBtn} onClick={() => { setShowPin(false); handleRemovePin(); }}>
                Remove my pin
              </button>
            )}
            <button className={styles.pinCancelBtn} onClick={() => setShowPin(false)} disabled={saving}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
