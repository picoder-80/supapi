"use client";

import { useState, useEffect, useRef } from "react";
import { ALL_COUNTRIES, getCountry } from "@/lib/market/countries";
import styles from "./CountrySelect.module.css";

interface CountrySelectProps {
  value: string;
  onChange: (code: string) => void;
  /** If true, exclude "Worldwide" from options (e.g. for create forms) */
  excludeWorldwide?: boolean;
}

export function CountrySelect({ value, onChange, excludeWorldwide }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = ALL_COUNTRIES.filter(
    (c) =>
      (!excludeWorldwide || c.code !== "WORLDWIDE") &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()))
  );

  const selected = getCountry(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={styles.root}>
      <button className={styles.btn} type="button" onClick={() => setOpen((p) => !p)}>
        {selected.flag} {selected.name} ▾
      </button>
      {open && (
        <div className={styles.dropdown}>
          <input
            className={styles.search}
            placeholder="Search country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className={styles.list}>
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                className={`${styles.option} ${value === c.code ? styles.optionActive : ""}`}
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {c.flag} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
