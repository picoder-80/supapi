"use client";

import { useState, useEffect } from "react";
import styles from "./AdminTabs.module.css";

interface Tab {
  id: string;
  label: string;
}

interface AdminTabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export default function AdminTabs({ tabs, active, onChange }: AdminTabsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isMobile) {
    return (
      <div className={styles.dropdownWrap}>
        <select
          className={styles.dropdown}
          value={active}
          onChange={(e) => onChange(e.target.value)}
        >
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <span className={styles.dropdownArrow}>▾</span>
      </div>
    );
  }

  return (
    <div className={styles.tabs}>
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`${styles.tab} ${active === t.id ? styles.tabActive : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}