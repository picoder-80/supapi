"use client";

import { useEffect, useRef } from "react";
import styles from "../dm/[conversationId]/page.module.css";

type MessageInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onPiTransfer?: () => void;
  onAttachListing?: () => void;
  onCreateDeal?: () => void;
  secondaryIcon?: string;
  secondaryLabel?: string;
  sending?: boolean;
  placeholder?: string;
  disabled?: boolean;
};

export default function MessageInput({
  value,
  onChange,
  onSend,
  onPiTransfer,
  onAttachListing,
  onCreateDeal,
  secondaryIcon = "🤝",
  secondaryLabel = "Create deal",
  sending = false,
  placeholder = "Type a message...",
  disabled = false,
}: MessageInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  return (
    <div className={styles.inputBar}>
      <button type="button" className={styles.inputIconBtn} onClick={onAttachListing} aria-label="Attach listing" disabled={disabled}>
        📎
      </button>
      {onCreateDeal && (
        <button type="button" className={styles.inputIconBtn} onClick={onCreateDeal} aria-label={secondaryLabel} disabled={disabled}>
          {secondaryIcon}
        </button>
      )}
      <textarea
        ref={ref}
        className={styles.textInput}
        value={value}
        rows={1}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <button type="button" className={styles.inputIconBtn} onClick={onPiTransfer} aria-label="Send Pi" disabled={disabled}>
        π
      </button>
      <button type="button" className={styles.sendBtn} onClick={onSend} disabled={disabled || sending || !value.trim()} aria-label="Send">
        ➤
      </button>
    </div>
  );
}
