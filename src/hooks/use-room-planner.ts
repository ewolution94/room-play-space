import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type {
  Lang,
  Item,
  Opening,
  Preset,
  Snapshot,
  Point,
  MarqueeRect,
  MarqueeState,
  DragState,
  UseRoomPlannerReturn,
} from "@/types/planner";
import { STRINGS } from "@/lib/planner-translations";
import { clampPos, collidesWithOthers, findFreeSpot } from "@/lib/planner-math";
import { importSchema } from "@/lib/planner-schema";

export function useRoomPlanner(): UseRoomPlannerReturn {
  const [lang, setLang] = useState<Lang>("en");
  const t = STRINGS[lang];
  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem("planner-lang") : null;
    if (saved === "en" || saved === "de") setLang(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("planner-lang", lang);
  }, [lang]);

  const [roomW, setRoomW] = useState(480);
  const [roomL, setRoomL] = useState(360);
  const [draftW, setDraftW] = useState("480");
  const [draftL, setDraftL] = useState("360");
  const dirty = draftW !== String(roomW) || draftL !== String(roomL);
  const [threeDActive, setThreeDActive] = useState(false);

  // Cozy living-room + work-nook default. Door is on the bottom wall near the
  // bottom-left corner with its swing arc landing on clear floor space.
  const [items, setItems] = useState<Item[]>(() => [
    {
      id: "default-desk",
      name: "Desk",
      width: 160,
      length: 75,
      color: "#c28a5e",
      x: 160,
      y: 15,
      rotation: 0,
      kind: "furniture",
      icon: "desk",
    },
    {
      id: "default-chair",
      name: "Office chair",
      width: 60,
      length: 60,
      color: "#556270",
      x: 210,
      y: 100,
      rotation: 0,
      kind: "chair",
      icon: "chair-office",
    },
    {
      id: "default-bookshelf",
      name: "Bookshelf",
      width: 30,
      length: 200,
      color: "#a07855",
      x: 440,
      y: 130,
      rotation: 0,
      kind: "furniture",
      icon: "bookshelf",
    },
    {
      id: "default-cabinet",
      name: "Filing cabinet",
      width: 60,
      length: 45,
      color: "#cfd8dc",
      x: 340,
      y: 15,
      rotation: 0,
      kind: "furniture",
      icon: "filing-cabinet",
    },
    {
      id: "default-plant",
      name: "Plant",
      width: 50,
      length: 50,
      color: "#4ade80",
      x: 20,
      y: 20,
      rotation: 0,
      kind: "furniture",
      icon: "plant",
    },
  ]);
  const [openings, setOpenings] = useState<Opening[]>(() => [
    {
      id: "default-door-1",
      wall: "bottom",
      position: 233,
      width: 90,
      kind: "door",
      hinge: "start",
      swing: "in",
    },
    { id: "default-window-1", wall: "top", position: 60, width: 80, kind: "window" },
    { id: "default-window-2", wall: "right", position: 30, width: 80, kind: "window" },
  ]);

  // -------- History (undo / redo) --------
  const stateRef = useRef<Snapshot>({ items, openings, roomW, roomL });
  useEffect(() => {
    stateRef.current = { items, openings, roomW, roomL };
  }, [items, openings, roomW, roomL]);

  const historyRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const [, forceHistoryTick] = useState(0);

  const snapshotEqual = (a: Snapshot, b: Snapshot) => JSON.stringify(a) === JSON.stringify(b);

  const pushHistory = () => {
    const snap: Snapshot = JSON.parse(JSON.stringify(stateRef.current));
    const top = historyRef.current[historyRef.current.length - 1];
    if (top && snapshotEqual(top, snap)) return;
    historyRef.current = [...historyRef.current.slice(-99), snap];
    futureRef.current = [];
    forceHistoryTick((n) => n + 1);
  };

  const applySnapshot = (s: Snapshot) => {
    setItems(s.items);
    setOpenings(s.openings);
    setRoomW(s.roomW);
    setRoomL(s.roomL);
    setDraftW(String(s.roomW));
    setDraftL(String(s.roomL));
  };

  const undo = () => {
    if (!historyRef.current.length) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    futureRef.current = [...futureRef.current, JSON.parse(JSON.stringify(stateRef.current))];
    historyRef.current = historyRef.current.slice(0, -1);
    applySnapshot(prev);
    forceHistoryTick((n) => n + 1);
  };

  const redo = () => {
    if (!futureRef.current.length) return;
    const next = futureRef.current[futureRef.current.length - 1];
    historyRef.current = [...historyRef.current, JSON.parse(JSON.stringify(stateRef.current))];
    futureRef.current = futureRef.current.slice(0, -1);
    applySnapshot(next);
    forceHistoryTick((n) => n + 1);
  };

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // -------- Room dims --------
  const applyRoom = (customW?: number, customL?: number) => {
    const w = customW !== undefined ? customW : Math.max(50, parseInt(draftW, 10) || 0);
    const l = customL !== undefined ? customL : Math.max(50, parseInt(draftL, 10) || 0);
    if (w === roomW && l === roomL) return;
    pushHistory();
    setRoomW(w);
    setRoomL(l);
    setDraftW(String(w));
    setDraftL(String(l));
    setItems((prev) =>
      prev.map((i) => {
        const c = clampPos(i, w, l, i.x, i.y);
        return { ...i, x: c.x, y: c.y };
      }),
    );
  };

  // -------- Custom box form --------
  const [nName, setNName] = useState("");
  const [nW, setNW] = useState(80);
  const [nL, setNL] = useState(40);
  const [nColor, setNColor] = useState("#5cbdb9");

  // -------- New opening form --------
  const [oKind, setOKind] = useState<"door" | "window">("door");
  const [oWall, setOWall] = useState<Opening["wall"]>("top");
  const [oPos, setOPos] = useState(50);
  const [oWidth, setOWidth] = useState(90);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = 40;
  const scale = Math.min((stageSize.w - pad * 2) / roomW, (stageSize.h - pad * 2) / roomL);
  const cm = (v: number) => v * scale;
  const roomPxW = cm(roomW);
  const roomPxL = cm(roomL);
  const offsetX = (stageSize.w - roomPxW) / 2 - 4;
  const offsetY = (stageSize.h - roomPxL) / 2 - 4;

  // -------- Selection --------
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  // Scroll the selected item's row into view inside the right-column scroller
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedIds.size === 0) return;
    const id = Array.from(selectedIds).pop()!;
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-item-row="${id}"]`);
      if (!el) return;
      let scroller: HTMLElement | null = el.parentElement;
      while (scroller && scroller !== document.body) {
        const style = window.getComputedStyle(scroller);
        const canScrollY = /(auto|scroll)/.test(style.overflowY);
        if (canScrollY && scroller.scrollHeight > scroller.clientHeight) break;
        scroller = scroller.parentElement;
      }
      if (!scroller || scroller === document.body) return;
      const elRect = el.getBoundingClientRect();
      const scRect = scroller.getBoundingClientRect();
      const fullyVisible = elRect.top >= scRect.top && elRect.bottom <= scRect.bottom;
      if (fullyVisible) return;
      const offset = elRect.top - scRect.top;
      const target = Math.max(
        0,
        scroller.scrollTop + offset - Math.max(0, (scroller.clientHeight - el.offsetHeight) / 2),
      );
      scroller.scrollTo({ top: target, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedIds]);

  // -------- Add items --------
  const addPreset = (preset: Preset) => {
    const draft: Item = {
      id: crypto.randomUUID(),
      name: lang === "de" ? preset.nameDe : preset.nameEn,
      width: preset.w,
      length: preset.l,
      color: preset.color,
      x: 10,
      y: 10,
      rotation: 0,
      kind: preset.iconUrl && preset.key === "chair-office" ? "chair" : "furniture",
      icon: preset.key,
    };
    const spot = findFreeSpot(draft, items, roomW, roomL, collisionEnabled);
    if (!spot) {
      toast.error(t.noFreeSpace);
      return;
    }
    pushHistory();
    const added = { ...draft, x: spot.x, y: spot.y };
    setItems((prev) => [...prev, added]);
    setSelectedIds(new Set([added.id]));
  };

  const addCustomBox = () => {
    if (!nName.trim()) return;
    const draft: Item = {
      id: crypto.randomUUID(),
      name: nName.trim(),
      width: nW,
      length: nL,
      color: nColor,
      x: 10,
      y: 10,
      rotation: 0,
      kind: "furniture",
    };
    const spot = findFreeSpot(draft, items, roomW, roomL, collisionEnabled);
    if (!spot) {
      toast.error(t.noFreeSpace);
      return;
    }
    pushHistory();
    const added = { ...draft, x: spot.x, y: spot.y };
    setItems((prev) => [...prev, added]);
    setSelectedIds(new Set([added.id]));
    setNName("");
  };

  const removeItem = (id: string) => {
    pushHistory();
    setItems((p) => p.filter((i) => i.id !== id));
    setSelectedIds((s) => {
      if (!s.has(id)) return s;
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  const removeSelected = () => {
    const ids = selectedIdsRef.current;
    if (!ids.size) return;
    pushHistory();
    setItems((p) => p.filter((i) => !ids.has(i.id)));
    setSelectedIds(new Set());
  };

  const duplicateSelected = () => {
    const ids = selectedIdsRef.current;
    if (!ids.size) return;
    pushHistory();
    setItems((prev) => {
      const toDup = prev.filter((i) => ids.has(i.id));
      const next = [...prev];
      const newIds: string[] = [];
      for (const src of toDup) {
        const draft: Item = { ...src, id: crypto.randomUUID(), x: src.x + 20, y: src.y + 20 };
        const spot = findFreeSpot(draft, next, roomW, roomL, collisionEnabled);
        if (!spot) continue;
        const added = { ...draft, x: spot.x, y: spot.y };
        next.push(added);
        newIds.push(added.id);
      }
      if (newIds.length) {
        queueMicrotask(() => setSelectedIds(new Set(newIds)));
      } else {
        toast.error(t.noFreeSpace);
      }
      return next;
    });
  };

  const updateItem = (id: string, patch: Partial<Item>, options?: { history?: boolean }) => {
    if (options?.history !== false) pushHistory();
    setItems((p) =>
      p.map((i) => {
        if (i.id !== id) return i;
        const merged = { ...i, ...patch };
        const c = clampPos(merged, roomW, roomL, merged.x, merged.y);
        const candidate = { ...merged, x: c.x, y: c.y };
        if (collidesWithOthers(candidate, p)) return i;
        return candidate;
      }),
    );
  };

  const addOpening = () => {
    pushHistory();
    setOpenings((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        kind: oKind,
        wall: oWall,
        position: oPos,
        width: oWidth,
        ...(oKind === "door" ? { hinge: "start" as const, swing: "in" as const } : {}),
      },
    ]);
  };
  const removeOpening = (id: string) => {
    pushHistory();
    setOpenings((p) => p.filter((o) => o.id !== id));
  };
  const updateOpening = (id: string, patch: Partial<Opening>) => {
    pushHistory();
    setOpenings((p) => p.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  // -------- Reset --------
  const [resetMode, setResetMode] = useState<"items" | "all" | null>(null);

  const clearItemsOnly = () => {
    pushHistory();
    setItems([]);
    setSelectedIds(new Set());
  };
  const clearAll = () => {
    pushHistory();
    setItems([]);
    setOpenings([]);
    setSelectedIds(new Set());
  };
  const confirmReset = () => {
    if (resetMode === "items") clearItemsOnly();
    else if (resetMode === "all") clearAll();
    setResetMode(null);
  };

  // -------- Ruler --------
  const [rulerMode, setRulerMode] = useState(false);
  const [collisionEnabled, setCollisionEnabled] = useState(true);
  const [rulerStart, setRulerStart] = useState<Point | null>(null);
  const [rulerEnd, setRulerEnd] = useState<Point | null>(null);
  const [rulerHover, setRulerHover] = useState<Point | null>(null);
  const clearRuler = () => {
    setRulerStart(null);
    setRulerEnd(null);
    setRulerHover(null);
  };
  useEffect(() => {
    if (!rulerMode) clearRuler();
  }, [rulerMode]);

  // -------- Onboarding tour --------
  const TOUR_KEY = "planner-tour-v1-done";
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(TOUR_KEY)) {
      setTourOpen(true);
      setTourStep(0);
    }
  }, []);
  const closeTour = () => {
    setTourOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOUR_KEY, "1");
    }
  };

  // -------- Drag & marquee --------
  const dragRef = useRef<DragState | null>(null);

  const marqueeRef = useRef<MarqueeState | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);

  const stageToCm = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      x: (clientX - r.left - offsetX - 4) / scale,
      y: (clientY - r.top - offsetY - 4) / scale,
    };
  };

  const onItemPointerDown = (e: React.PointerEvent, item: Item) => {
    if (rulerMode) {
      e.stopPropagation();
      const p = stageToCm(e.clientX, e.clientY);
      const cmPt = { x: p.x, y: p.y };
      if (!rulerStart || (rulerStart && rulerEnd)) {
        setRulerStart(cmPt);
        setRulerEnd(null);
        setRulerHover(cmPt);
      } else {
        setRulerEnd(cmPt);
      }
      return;
    }
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);

    if (e.shiftKey) {
      setSelectedIds((s) => {
        const n = new Set(s);
        if (n.has(item.id)) n.delete(item.id);
        else n.add(item.id);
        return n;
      });
      return;
    }

    const cur = selectedIdsRef.current;
    let ids: string[];
    if (cur.has(item.id) && cur.size > 1) {
      ids = Array.from(cur);
    } else {
      setSelectedIds(new Set([item.id]));
      ids = [item.id];
    }
    const startPos = new Map<string, { x: number; y: number }>();
    for (const it of items) {
      if (ids.includes(it.id)) startPos.set(it.id, { x: it.x, y: it.y });
    }
    pushHistory();
    dragRef.current = {
      mode: "move",
      ids,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPos,
    };
  };

  const onRotateHandleDown = (e: React.PointerEvent, item: Item) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const stageRect = stageEl.getBoundingClientRect();
    const centerClientX = stageRect.left + offsetX + 4 + cm(item.x + item.width / 2);
    const centerClientY = stageRect.top + offsetY + 4 + cm(item.y + item.length / 2);
    const startAngle =
      (Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * 180) / Math.PI;
    pushHistory();
    dragRef.current = {
      mode: "rotate",
      id: item.id,
      centerClientX,
      centerClientY,
      startAngle,
      startRotation: item.rotation,
    };
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (!stageRef.current) return;
    if (rulerMode) {
      const p = stageToCm(e.clientX, e.clientY);
      const cmPt = { x: p.x, y: p.y };
      if (!rulerStart || (rulerStart && rulerEnd)) {
        setRulerStart(cmPt);
        setRulerEnd(null);
        setRulerHover(cmPt);
      } else {
        setRulerEnd(cmPt);
      }
      return;
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = stageToCm(e.clientX, e.clientY);
    marqueeRef.current = { startCx: p.x, startCy: p.y, addToSelection: e.shiftKey };
    if (!e.shiftKey) setSelectedIds(new Set());
    setMarqueeRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    if (rulerMode) {
      const p = stageToCm(e.clientX, e.clientY);
      setRulerHover({ x: p.x, y: p.y });
      return;
    }
    const d = dragRef.current;
    if (d) {
      if (d.mode === "move") {
        const dx = (e.clientX - d.startMouseX) / scale;
        const dy = (e.clientY - d.startMouseY) / scale;
        const idsSet = new Set(d.ids);
        setItems((prev) =>
          prev.map((i) => {
            if (!idsSet.has(i.id)) return i;
            const start = d.startPos.get(i.id)!;
            const c = clampPos(i, roomW, roomL, start.x + dx, start.y + dy);
            const candidate = { ...i, x: c.x, y: c.y };

            if (collisionEnabled) {
              if (collidesWithOthers(candidate, prev, idsSet)) {
                const xOnly = clampPos(i, roomW, roomL, start.x + dx, i.y);
                const cx = { ...i, x: xOnly.x, y: xOnly.y };
                if (!collidesWithOthers(cx, prev, idsSet)) return cx;

                const yOnly = clampPos(i, roomW, roomL, i.x, start.y + dy);
                const cy = { ...i, x: yOnly.x, y: yOnly.y };
                if (!collidesWithOthers(cy, prev, idsSet)) return cy;

                return i;
              }
            }
            return candidate;
          }),
        );
      } else {
        const angle =
          (Math.atan2(e.clientY - d.centerClientY, e.clientX - d.centerClientX) * 180) / Math.PI;
        const delta = angle - d.startAngle;
        const next = (((d.startRotation + delta) % 360) + 360) % 360;
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== d.id) return i;
            const merged = { ...i, rotation: next };
            const c = clampPos(merged, roomW, roomL, merged.x, merged.y);
            const candidate = { ...merged, x: c.x, y: c.y };
            if (collidesWithOthers(candidate, prev)) return i;
            return candidate;
          }),
        );
      }
      return;
    }

    const m = marqueeRef.current;
    if (m) {
      const p = stageToCm(e.clientX, e.clientY);
      const x = Math.min(p.x, m.startCx);
      const y = Math.min(p.y, m.startCy);
      const w = Math.abs(p.x - m.startCx);
      const h = Math.abs(p.y - m.startCy);
      setMarqueeRect({ x, y, w, h });
    }
  };

  const onStagePointerUp = () => {
    const d = dragRef.current;
    if (d) {
      if (d.mode === "move") {
        const idsSet = new Set(d.ids);
        setItems((prev) => {
          let anyCollision = false;
          for (const i of prev) {
            if (!idsSet.has(i.id)) continue;
            if (collidesWithOthers(i, prev, idsSet)) {
              anyCollision = true;
              break;
            }
          }
          if (!anyCollision) return prev;
          return prev.map((i) => {
            if (!idsSet.has(i.id)) return i;
            const start = d.startPos.get(i.id);
            return start ? { ...i, x: start.x, y: start.y } : i;
          });
        });
      }
      dragRef.current = null;
      return;
    }

    const m = marqueeRef.current;
    const r = marqueeRect;
    if (m && r) {
      const picked: string[] = [];
      if (r.w > 1 && r.h > 1) {
        for (const it of items) {
          const cx = it.x + it.width / 2;
          const cy = it.y + it.length / 2;
          if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) picked.push(it.id);
        }
      }
      if (picked.length || m.addToSelection) {
        setSelectedIds((prev) => {
          const next = m.addToSelection ? new Set(prev) : new Set<string>();
          for (const id of picked) next.add(id);
          return next;
        });
      }
    }
    marqueeRef.current = null;
    setMarqueeRect(null);
  };

  // -------- Keyboard --------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === "Escape") {
        if (rulerMode) {
          if (rulerStart || rulerEnd) clearRuler();
          else setRulerMode(false);
          e.preventDefault();
          return;
        }
      }

      const ids = selectedIdsRef.current;
      if (!ids.size) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
        return;
      }

      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        const dir = e.shiftKey ? -15 : 15;
        pushHistory();
        setItems((prev) =>
          prev.map((i) => {
            if (!ids.has(i.id)) return i;
            const merged = { ...i, rotation: (((i.rotation + dir) % 360) + 360) % 360 };
            const c = clampPos(merged, roomW, roomL, merged.x, merged.y);
            const candidate = { ...merged, x: c.x, y: c.y };
            if (collidesWithOthers(candidate, prev, ids)) return i;
            return candidate;
          }),
        );
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "Escape") {
        setSelectedIds(new Set());
        return;
      } else return;

      e.preventDefault();
      pushHistory();
      setItems((prev) => {
        const next = prev.map((i) => {
          if (!ids.has(i.id)) return i;
          const c = clampPos(i, roomW, roomL, i.x + dx, i.y + dy);
          return { ...i, x: c.x, y: c.y };
        });
        for (const i of next) {
          if (!ids.has(i.id)) continue;
          if (collidesWithOthers(i, next, ids)) return prev;
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomW, roomL, collisionEnabled]);

  // -------- Export / Import --------
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const payload = {
      version: 2,
      room: { width: roomW, length: roomL },
      openings,
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `room-planner-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t.exported);
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t.importFail + "File size exceeds 2MB limit.");
      return;
    }

    try {
      const text = await file.text();
      const parsedJSON = JSON.parse(text);
      const data = importSchema.parse(parsedJSON);

      pushHistory();
      const nextW = Math.max(50, Math.round(data.room.width));
      const nextL = Math.max(50, Math.round(data.room.length));
      setRoomW(nextW);
      setRoomL(nextL);
      setDraftW(String(nextW));
      setDraftL(String(nextL));
      setOpenings(
        data.openings.map((o) => ({
          id: o.id || crypto.randomUUID(),
          wall: o.wall,
          position: o.position,
          width: o.width,
          kind: o.kind,
          hinge: o.kind === "door" ? (o.hinge === "end" ? "end" : "start") : undefined,
          swing: o.kind === "door" ? (o.swing === "out" ? "out" : "in") : undefined,
        })),
      );
      setItems(
        data.items.map((i) => ({
          id: i.id || crypto.randomUUID(),
          name: i.name,
          width: i.width,
          length: i.length,
          color: i.color,
          x: i.x,
          y: i.y,
          rotation: i.rotation,
          kind: i.kind,
          icon: i.icon,
        })),
      );
      setSelectedIds(new Set());
      toast.success(t.imported);
    } catch (err) {
      console.error("Import failed:", err);
      let errorMsg = "";
      if (err instanceof z.ZodError) {
        errorMsg = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      } else if (err instanceof Error) {
        errorMsg = err.message;
      } else {
        errorMsg = "Unknown error";
      }
      toast.error(t.importFail + errorMsg);
    }
  };

  return {
    // State
    lang,
    setLang,
    t,
    roomW,
    setRoomW,
    roomL,
    setRoomL,
    draftW,
    setDraftW,
    draftL,
    setDraftL,
    dirty,
    items,
    setItems,
    openings,
    setOpenings,
    selectedIds,
    setSelectedIds,
    rulerMode,
    setRulerMode,
    collisionEnabled,
    setCollisionEnabled,
    rulerStart,
    rulerEnd,
    rulerHover,
    resetMode,
    setResetMode,
    marqueeRect,
    stageSize,
    scale,
    roomPxW,
    roomPxL,
    offsetX,
    offsetY,
    canUndo,
    canRedo,
    tourOpen,
    setTourOpen,
    tourStep,
    setTourStep,
    threeDActive,
    setThreeDActive,

    // Form inputs
    nName,
    setNName,
    nW,
    setNW,
    nL,
    setNL,
    nColor,
    setNColor,
    oKind,
    setOKind,
    oWall,
    setOWall,
    oPos,
    setOPos,
    oWidth,
    setOWidth,

    // Refs
    stageRef,
    fileInputRef,

    // Helpers / Actions
    cm,
    undo,
    redo,
    applyRoom,
    addPreset,
    addCustomBox,
    removeItem,
    removeSelected,
    duplicateSelected,
    updateItem,
    addOpening,
    removeOpening,
    updateOpening,
    confirmReset,
    clearRuler,
    closeTour,
    exportJSON,
    onImportFile,
    onItemPointerDown,
    onRotateHandleDown,
    onStagePointerDown,
    onStagePointerMove,
    onStagePointerUp,
    pushHistory,
  };
}
