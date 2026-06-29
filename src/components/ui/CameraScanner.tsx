"use client";

import { useEffect, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Monkey-patch HTMLMediaElement.play to catch AbortError safely
// This prevents Next.js dev overlay from crashing when camera is closed rapidly
if (typeof window !== "undefined") {
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    return originalPlay.apply(this, arguments as any).catch((err: any) => {
      if (err.name === 'AbortError') return;
      throw err;
    });
  };
}

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let html5QrCode: Html5Qrcode | null = null;
    let isStarting = false;

    const initScanner = async () => {
      if (!document.getElementById("reader")) return;
      
      // Explicitly support all common formats, especially 1D barcodes
      const formatsToSupport = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.MAXICODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.RSS_14,
        Html5QrcodeSupportedFormats.RSS_EXPANDED
      ];

      html5QrCode = new Html5Qrcode("reader", { formatsToSupport, verbose: false });
      isStarting = true;

      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { 
            fps: 20, 
            disableFlip: false,
          },
          (decodedText) => {
            if (!isMounted) return;
            isMounted = false; // Prevent multiple scans
            
            html5QrCode?.stop().then(() => {
              html5QrCode?.clear();
              onScan(decodedText);
            }).catch(() => {
              // Fallback if stop fails, just pass the result
              onScan(decodedText);
            });
          },
          (err) => { /* ignore */ }
        );
        isStarting = false;

        if (!isMounted) {
          // Component unmounted while camera was starting up
          html5QrCode.stop().then(() => html5QrCode?.clear()).catch(() => {});
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        isStarting = false;
        if (isMounted) {
          setIsLoading(false);
          setError("Gagal mengakses kamera. Pastikan browser memiliki izin akses kamera.");
        }
      }
    };

    // Delay initialization to bypass React 18 Strict Mode double-invoke unmount
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        initScanner();
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          // Catch and suppress errors during cleanup
          html5QrCode.stop().then(() => html5QrCode?.clear()).catch(() => {});
        }
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border-2 border-border p-4 w-full max-w-md shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h2 className="font-bold uppercase tracking-widest text-lg font-mono">Kamera Scanner</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-none hover:bg-destructive hover:text-destructive-foreground transition-colors">
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="relative w-full bg-black min-h-[300px] border border-border flex items-center justify-center overflow-hidden">
          {isLoading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground z-10 bg-black">
              <span className="font-mono text-xs uppercase animate-pulse">Memulai Kamera...</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center z-10 bg-black">
              <span className="font-mono text-xs text-destructive">{error}</span>
            </div>
          )}
          <div id="reader" className="w-full h-full"></div>
        </div>
        
        <p className="font-mono text-xs text-muted-foreground text-center mt-2">
          Arahkan kamera ke Barcode Produk atau QR Code / Barcode Identitas Santri.
        </p>

        <div className="flex flex-col items-center gap-2 border-t border-border pt-4 mt-2">
          <span className="font-mono text-xs text-muted-foreground uppercase">ATAU</span>
          <div className="relative w-full">
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const file = e.target.files[0];
                  setIsLoading(true);
                  setError("");
                  const html5QrCode = new Html5Qrcode("reader");
                  html5QrCode.scanFile(file, true)
                    .then(decodedText => {
                      onScan(decodedText);
                    })
                    .catch(err => {
                      setIsLoading(false);
                      setError("Gagal membaca barcode dari gambar tersebut.");
                    });
                }
              }}
            />
            <Button variant="outline" className="w-full font-mono text-xs pointer-events-none">
              UPLOAD GAMBAR BARCODE
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
