"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => <div style={{ minHeight: 200, border: "1px solid #ddd", borderRadius: 8, padding: 12, background: "#f9f9f9" }}>Loading editor...</div>,
});

import "react-quill-new/dist/quill.snow.css";

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ color: [] }, { background: [] }],
    ["link"],
    ["clean"],
  ],
};

const QUILL_FORMATS = [
  "header",
  "bold", "italic", "underline", "strike",
  "list", // "ordered" and "bullet" are values of "list", not separate formats
  "color", "background",
  "link",
];

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
};

export default function RichTextEditor({ value, onChange, placeholder = "Write your message...", minHeight = 200, className }: RichTextEditorProps) {
  const modules = useMemo(() => QUILL_MODULES, []);

  return (
    <div className={className} style={{ minHeight }}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={QUILL_FORMATS}
        placeholder={placeholder}
        style={{ minHeight: minHeight - 42 }}
      />
    </div>
  );
}
