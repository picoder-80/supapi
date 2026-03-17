"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import ConversationList from "./components/ConversationList";
import RoomList from "./components/RoomList";
import GroupList from "./components/GroupList";

type TabId = "dms" | "rooms" | "groups";

export default function SupaChatInboxPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("dms");
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeUsername, setComposeUsername] = useState("");
  const [composeLoading, setComposeLoading] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createGroupName, setCreateGroupName] = useState("");
  const [createGroupDesc, setCreateGroupDesc] = useState("");
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverGroups, setDiscoverGroups] = useState<any[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  const token = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem("supapi_token") ?? "" : ""),
    []
  );

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [dmRes, roomRes, groupsRes] = await Promise.all([
        fetch("/api/supachat/conversations", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/supachat/rooms"),
        fetch("/api/supachat/groups", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [dmJson, roomJson, groupsJson] = await Promise.all([dmRes.json(), roomRes.json(), groupsRes.json()]);
      if (dmJson.success) setConversations(dmJson.data ?? []);
      if (roomJson.success) setRooms(roomJson.data ?? []);
      if (groupsJson.success) setGroups(groupsJson.data ?? []);
      if (!dmJson.success || !roomJson.success || !groupsJson.success) {
        setError(dmJson.error || roomJson.error || groupsJson.error || "Unable to load chat data.");
      }
    } catch {
      setError("Unable to load chat data.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createGroup = async () => {
    const name = createGroupName.trim();
    if (!name) return;
    setCreateGroupLoading(true);
    try {
      const r = await fetch("/api/supachat/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, description: createGroupDesc.trim() }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Unable to create group");
      setCreateGroupOpen(false);
      setCreateGroupName("");
      setCreateGroupDesc("");
      router.push(`/supachat/group/${d.data.id}`);
      fetchAll();
    } catch (err: any) {
      setError(err?.message || "Unable to create group.");
    }
    setCreateGroupLoading(false);
  };

  const openDiscover = async () => {
    setDiscoverOpen(true);
    setDiscoverLoading(true);
    try {
      const r = await fetch("/api/supachat/groups/discover", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) setDiscoverGroups(d.data ?? []);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const joinGroup = async (g: { id: string }) => {
    try {
      const r = await fetch(`/api/supachat/groups/${g.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Unable to join");
      setDiscoverGroups((prev) => prev.filter((x) => x.id !== g.id));
      fetchAll();
      router.push(`/supachat/group/${g.id}`);
    } catch (err: any) {
      setError(err?.message || "Unable to join group.");
    }
  };

  const startDM = async () => {
    const username = composeUsername.trim().replace(/^@/, "");
    if (!username) return;
    setComposeLoading(true);
    try {
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(username)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      const candidate = d?.data?.find(
        (u: any) => String(u.username).toLowerCase() === username.toLowerCase()
      );
      if (!candidate?.id) throw new Error("User not found");

      const dm = await fetch("/api/supachat/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiverId: candidate.id }),
      });
      const dmJson = await dm.json();
      if (!dmJson.success) throw new Error(dmJson.error || "Unable to create conversation");
      setComposeOpen(false);
      setComposeUsername("");
      router.push(`/supachat/dm/${dmJson.data.conversationId}`);
    } catch (err: any) {
      setError(err?.message || "Unable to start conversation.");
    }
    setComposeLoading(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarTitle}>SupaChat 💬</div>
        <button className={styles.composeBtn} onClick={() => setComposeOpen(true)} aria-label="Compose">
          ✏️
        </button>
      </header>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "dms" ? styles.tabActive : ""}`} onClick={() => setTab("dms")}>DMs</button>
        <button className={`${styles.tab} ${tab === "rooms" ? styles.tabActive : ""}`} onClick={() => setTab("rooms")}>Rooms</button>
        <button className={`${styles.tab} ${tab === "groups" ? styles.tabActive : ""}`} onClick={() => setTab("groups")}>Groups</button>
      </div>

      <main className={styles.content}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        {loading ? (
          <div className={styles.skeletonList}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className={styles.skeletonRow} />
            ))}
          </div>
        ) : tab === "dms" ? (
          conversations.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>💬</div>
              <div className={styles.emptyTitle}>No messages yet</div>
              <div className={styles.emptySub}>Start a conversation!</div>
              <button className={styles.emptyBtn} onClick={() => setComposeOpen(true)}>Start DM</button>
            </div>
          ) : (
            <ConversationList conversations={conversations} />
          )
        ) : tab === "rooms" ? (
          rooms.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🏘️</div>
              <div className={styles.emptyTitle}>No rooms yet</div>
              <div className={styles.emptySub}>Create or join rooms to chat with community.</div>
            </div>
          ) : (
            <RoomList rooms={rooms} />
          )
        ) : groups.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>👥</div>
            <div className={styles.emptyTitle}>No groups yet</div>
            <div className={styles.emptySub}>Create a group or discover public groups to join.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
              <button className={styles.emptyBtn} onClick={() => setCreateGroupOpen(true)}>Create Group</button>
              <button className={styles.emptyBtn} onClick={openDiscover}>Discover Groups</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button className={styles.emptyBtn} onClick={() => setCreateGroupOpen(true)} style={{ padding: "8px 14px", fontSize: 13 }}>+ Create</button>
              <button className={styles.emptyBtn} onClick={openDiscover} style={{ padding: "8px 14px", fontSize: 13 }}>Discover</button>
            </div>
            <GroupList groups={groups} />
          </>
        )}
      </main>

      {composeOpen && (
        <div className={styles.modalOverlay} onClick={() => setComposeOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Start new DM</div>
            <input
              className={styles.modalInput}
              placeholder="@username"
              value={composeUsername}
              onChange={(e) => setComposeUsername(e.target.value)}
            />
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setComposeOpen(false)}>Cancel</button>
              <button className={styles.modalConfirm} onClick={startDM} disabled={composeLoading || !composeUsername.trim()}>
                {composeLoading ? "Opening..." : "Chat"}
              </button>
            </div>
          </div>
        </div>
      )}

      {createGroupOpen && (
        <div className={styles.modalOverlay} onClick={() => setCreateGroupOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Create group</div>
            <input
              className={styles.modalInput}
              placeholder="Group name"
              value={createGroupName}
              onChange={(e) => setCreateGroupName(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <input
              className={styles.modalInput}
              placeholder="Description (optional)"
              value={createGroupDesc}
              onChange={(e) => setCreateGroupDesc(e.target.value)}
            />
            <div className={styles.modalActions} style={{ marginTop: 12 }}>
              <button className={styles.modalCancel} onClick={() => setCreateGroupOpen(false)}>Cancel</button>
              <button className={styles.modalConfirm} onClick={createGroup} disabled={createGroupLoading || !createGroupName.trim()}>
                {createGroupLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {discoverOpen && (
        <div className={styles.modalOverlay} onClick={() => setDiscoverOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxHeight: "70vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className={styles.modalTitle}>Discover groups</div>
            <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
              {discoverLoading ? (
                <div className={styles.skeletonList}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={styles.skeletonRow} />
                  ))}
                </div>
              ) : discoverGroups.length === 0 ? (
                <div className={styles.emptySub} style={{ padding: 16 }}>No public groups to join.</div>
              ) : (
                <div className={styles.listWrap} style={{ padding: "8px 0" }}>
                  {discoverGroups.map((g) => (
                    <div key={g.id} className={styles.roomRow} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "default" }}>
                      <div style={{ flex: 1, minWidth: 0 }} onClick={() => { setDiscoverOpen(false); router.push(`/supachat/group/${g.id}`); }}>
                        <div className={styles.roomTop}>
                          <div className={styles.roomName}>{g.name}</div>
                          <div className={styles.roomMeta}>👥 {g.member_count}</div>
                        </div>
                        <div className={styles.roomDesc}>{g.description || `By @${g.creator?.username ?? "unknown"}`}</div>
                      </div>
                      <button className={styles.modalConfirm} style={{ flexShrink: 0, marginLeft: 8 }} onClick={() => joinGroup(g)}>Join</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className={styles.modalCancel} style={{ marginTop: 12 }} onClick={() => setDiscoverOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
