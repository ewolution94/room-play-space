import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// Keep this list aligned with PRESETS in src/routes/index.tsx — used to nudge
// the model to choose recognisable preset keys when possible.
const PRESET_KEYS = [
  "chair-office",
  "armchair",
  "sofa",
  "bed-double",
  "bed-single",
  "desk",
  "round-table",
  "coffee-table",
  "side-table",
  "bookshelf",
  "wardrobe",
  "filing-cabinet",
  "stove",
  "sink",
  "fridge",
  "toilet",
  "bathtub",
  "plant",
  "floor-lamp",
  "rug",
] as const;

const OpeningSchema = z.object({
  wall: z.enum(["top", "bottom", "left", "right"]),
  position: z.number(),
  width: z.number(),
  kind: z.enum(["door", "window"]),
});

const InputSchema = z.object({
  roomW: z.number().min(50).max(2000),
  roomL: z.number().min(50).max(2000),
  roomType: z.enum([
    "office",
    "bedroom",
    "living",
    "kitchen",
    "studio",
    "dining",
    "kids",
    "gym",
  ]),
  openings: z.array(OpeningSchema).max(20),
});

const ItemOut = z.object({
  presetKey: z.string().optional(),
  name: z.string().min(1).max(40),
  width: z.number().min(10).max(400),
  length: z.number().min(10).max(400),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  x: z.number().min(0),
  y: z.number().min(0),
  rotation: z.number(),
});

const OutputSchema = z.object({
  items: z.array(ItemOut).max(14),
});

export type FurnishResult = z.infer<typeof OutputSchema>;

export const furnishRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const presetList = PRESET_KEYS.join(", ");
    const openingsDesc =
      data.openings.length === 0
        ? "no doors or windows"
        : data.openings
            .map(
              (o) =>
                `${o.kind} on ${o.wall} wall at ${Math.round(o.position)}cm (${o.width}cm wide)`,
            )
            .join("; ");

    const system =
      "You are an interior designer producing realistic top-down furniture layouts " +
      "for a room planner. All coordinates are in centimetres. x increases to the right, " +
      "y increases downward. Each item's (x, y) is the top-left corner of its unrotated " +
      "bounding box. Rotation is in degrees and must be one of 0, 90, 180, 270. " +
      "Items must fit fully inside the room and must not overlap each other or block doors. " +
      "Leave at least 80cm of clear space in front of any door for the swing. " +
      "Prefer realistic furniture sizes. When a piece matches a known preset, set presetKey " +
      "to one of: " +
      presetList +
      ". Otherwise pick a sensible name and hex color.";

    const prompt =
      `Design a ${data.roomType} layout for a room that is ${data.roomW}cm wide and ${data.roomL}cm deep. ` +
      `Openings: ${openingsDesc}. Use 6–12 items, well spaced, with a clear focal arrangement. ` +
      `Return JSON only.`;

    const { experimental_output } = await generateText({
      model,
      system,
      prompt,
      experimental_output: Output.object({ schema: OutputSchema }),
    });

    return experimental_output as FurnishResult;
  });
