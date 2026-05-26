import { motion } from "framer-motion";
import { useMemo } from "react";

type Props = {
  text: string;
  /** ms between consecutive words. Default 26ms ≈ 38 wpm cinematic reveal. */
  speedMs?: number;
  /** Skip the animation entirely (already-revealed cards). */
  instant?: boolean;
  /** Optional cap so very long passages don't take forever. */
  maxDurationMs?: number;
};

/**
 * Reveals a passage of text word-by-word with a soft fade + tiny rise.
 * Preserves whitespace and newlines. Animations only run once (no loops).
 */
export function WordStream({ text, speedMs = 26, instant = false, maxDurationMs = 4500 }: Props) {
  // Memo so we don't re-split (and re-trigger the in-view animations) on
  // unrelated parent re-renders.
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);

  if (instant) return <>{text}</>;

  // If the passage is huge, compress speed so it doesn't crawl forever.
  const wordCount = tokens.filter((t) => t.trim().length > 0).length;
  const naturalDuration = wordCount * speedMs;
  const speed =
    naturalDuration > maxDurationMs
      ? Math.max(8, Math.floor(maxDurationMs / Math.max(1, wordCount)))
      : speedMs;

  return (
    <>
      {tokens.map((token, i) => {
        const isWord = token.trim().length > 0;
        if (!isWord) return <span key={i}>{token}</span>;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, filter: "blur(2px)", y: 2 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{
              delay: (i * speed) / 1000 / 2, // every other token is whitespace
              duration: 0.32,
              ease: [0.2, 0.7, 0.2, 1],
            }}
            style={{ display: "inline-block", whiteSpace: "pre" }}
          >
            {token}
          </motion.span>
        );
      })}
    </>
  );
}
