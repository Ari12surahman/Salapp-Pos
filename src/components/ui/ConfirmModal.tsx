"use client";

import { useConfirmStore } from "@/store/confirmStore";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function ConfirmModal() {
  const { isOpen, title, message, confirmText, cancelText, onConfirm, onCancel } = useConfirmStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border-4 border-border w-full max-w-sm p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 text-destructive">
          <AlertTriangle className="w-8 h-8 shrink-0" />
          <h2 className="text-xl font-black uppercase tracking-tighter leading-none">{title}</h2>
        </div>
        <p className="font-mono text-sm mb-6 text-muted-foreground whitespace-pre-wrap">{message}</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 font-bold" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant="destructive" className="flex-1 font-bold" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
