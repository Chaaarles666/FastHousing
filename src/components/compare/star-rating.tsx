"use client";

import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
}

const SCORE_TEXT: Record<number, string> = {
  1: "很差",
  2: "较差",
  3: "一般",
  4: "较好",
  5: "优秀",
};

export function StarRating({ value, onChange, label }: StarRatingProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-600">{label}</p>
      <div className="mt-2 flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, index) => {
          const starValue = index + 1;
          const active = starValue <= value;

          return (
            <button
              key={starValue}
              type="button"
              onClick={() => onChange(starValue)}
              className="rounded-sm p-0.5 transition hover:scale-105"
              aria-label={`${label}${starValue}星`}
            >
              <Star
                className={`h-6 w-6 ${active ? "text-[var(--brand-accent)]" : "text-slate-300"}`}
                fill={active ? "currentColor" : "none"}
                strokeWidth={1.8}
              />
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        当前评分：{value} 星（{SCORE_TEXT[value] ?? "一般"}）
      </p>
    </div>
  );
}
