"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface TurnstileProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

// Throw error at module-level in production if the public site key is missing
if (
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
) {
  throw new Error(
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY environment variable is missing in production!"
  );
}

export default function Turnstile({ onSuccess, onError, onExpire }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

  useEffect(() => {
    // Define onload callback for Turnstile script
    (window as any).onloadTurnstileCallback = () => {
      if (!containerRef.current || widgetIdRef.current) return;

      try {
        const widgetId = (window as any).turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onSuccess(token),
          "error-callback": () => onError?.(),
          "expired-callback": () => onExpire?.(),
        });
        widgetIdRef.current = widgetId;
      } catch (err) {
        console.error("Turnstile render error on load:", err);
      }
    };

    // If Turnstile is already loaded, render directly
    if ((window as any).turnstile && containerRef.current && !widgetIdRef.current) {
      try {
        const widgetId = (window as any).turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onSuccess(token),
          "error-callback": () => onError?.(),
          "expired-callback": () => onExpire?.(),
        });
        widgetIdRef.current = widgetId;
      } catch (err) {
        console.error("Turnstile render error direct:", err);
      }
    }

    return () => {
      // Clean up widget instance on unmount to prevent memory leaks/duplicate widgets
      if (widgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(widgetIdRef.current);
        } catch (err) {
          console.error("Turnstile remove error:", err);
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onSuccess, onError, onExpire]);

  return (
    <div className="flex justify-center my-4 min-h-[65px]">
      <div ref={containerRef} />
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback"
        async
        defer
      />
    </div>
  );
}
