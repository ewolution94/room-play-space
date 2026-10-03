import React, { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TranslationStrings } from "@/lib/planner-translations";
import { encodeShare, shareUrl } from "@/lib/share";

interface ShareLinkDialogProps {
  t: TranslationStrings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The room as it is right now; read once each time the dialog opens. */
  buildPayload: () => unknown;
}

/** The link to a copy of this room (lib/share.ts), ready to copy. */
export function ShareLinkDialog({ t, open, onOpenChange, buildPayload }: ShareLinkDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Read at open time, not a dependency: the function is new on every render, and re-encoding
  // the room each time would only make the link flicker.
  const build = useRef(buildPayload);
  build.current = buildPayload;

  useEffect(() => {
    if (!open) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void encodeShare(build.current()).then((encoded) => {
      if (!cancelled) setUrl(shareUrl(window.location.origin, encoded));
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t.shareCopied);
    } catch {
      // Clipboard access can be refused (permissions, an insecure origin): hand it over to the
      // user's own copy instead.
      input.current?.focus();
      input.current?.select();
      toast.error(t.shareCopyFailed);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.shareTitle}</DialogTitle>
          <DialogDescription>{t.shareBody}</DialogDescription>
        </DialogHeader>
        <Input
          ref={input}
          readOnly
          value={url ?? ""}
          aria-label={t.shareTitle}
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs"
        />
        <DialogFooter>
          <Button onClick={copy} disabled={!url}>
            <Copy className="mr-1.5 h-4 w-4" />
            {t.shareCopy}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
