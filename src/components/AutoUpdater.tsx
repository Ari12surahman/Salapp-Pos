"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function AutoUpdater() {
  const initialVersion = useRef<string | null>(null);
  
  const checkVersion = async () => {
    try {
      // Add a random cache buster to bypass browser cache
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      
      if (!data || !data.version) return;
      
      if (!initialVersion.current) {
        // First load, save the version
        initialVersion.current = data.version;
      } else {
        // Subsequent checks
        if (initialVersion.current !== data.version) {
          console.log(`[AutoUpdater] New version detected (${data.version}), reloading...`);
          toast.info("Memperbarui aplikasi ke versi terbaru...");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      }
    } catch (e) {
      console.warn("[AutoUpdater] Failed to check version", e);
    }
  };

  useEffect(() => {
    // Check version on initial load
    checkVersion();

    // Check version when the app comes to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Also check periodically every 15 minutes just in case
    const interval = setInterval(checkVersion, 15 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  return null;
}
