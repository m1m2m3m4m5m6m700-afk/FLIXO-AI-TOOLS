import { z, type ZodType } from "zod";

export type CanonicalCapabilityState = "RECOGNIZED" | "PLANNABLE" | "EXECUTABLE" | "UNAVAILABLE";
export type CanonicalExecutionMode = "LOCAL" | "HYBRID" | "CLOUD";
export type CanonicalCapabilityParameters = Record<string, string | number | boolean>;
export type CanonicalCapabilityVerifier = (
  inputBlob: Blob,
  outputBlob: Blob,
  parameters: CanonicalCapabilityParameters,
  signal?: AbortSignal,
) => Promise<boolean>;
export type CanonicalCapabilityLimits = Readonly<{
  maxPixels: number;
  maxFileSizeBytes: number;
  timeoutMs: number;
}>;
export type CanonicalCapabilityDefinition = Readonly<{
  id: string;
  title: string;
  description: string;
  category: "Images" | "Video";
  family: "image" | "video";
  state: "EXECUTABLE";
  executionMode: "LOCAL";
  execution: "browser-local" | "browser-worker";
  intents: readonly string[];
  parameterSchema: ZodType;
  safetyLimits: CanonicalCapabilityLimits;
  verifier: CanonicalCapabilityVerifier;
  requirements: Readonly<{ browser: true; network: false }>;
  recovery: Readonly<{ maxAttempts: 3; replanOnFailure: false }>;
  operational: Readonly<{
    lifecycle: "ready";
    execution: "browser-local" | "browser-worker";
    contracts: readonly ["structural", "runtime", "artifact"];
    executorId: string;
    outputContractId: string;
  }>;
}>;

const MIME_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
const PARAMETER_SCHEMAS = {
  "background-remover": z.object({ tolerance: z.number().finite().min(0).max(255).optional() }).strict(),
  "image-upscaler": z.object({ scale: z.number().finite().positive().max(8).optional() }).strict(),
  "image-cropper": z.object({
    x: z.number().int().nonnegative().max(40_000).optional(),
    y: z.number().int().nonnegative().max(40_000).optional(),
    cropWidth: z.number().int().positive().max(40_000).optional(),
    cropHeight: z.number().int().positive().max(40_000).optional(),
    width: z.number().int().positive().max(4000).optional(),
    height: z.number().int().positive().max(4000).optional(),
    aspectRatio: z.string().regex(/^\d{1,3}:\d{1,3}$/).optional(),
    mode: z.literal("exact").optional(),
  }).strict(),
  "image-compressor": z.object({
    quality: z.number().finite().min(0.01).max(1).optional(),
    format: z.enum(MIME_TYPES).optional(),
    targetSizeKB: z.number().finite().int().positive().max(64 * 1024).optional(),
    maxWidth: z.number().int().positive().max(4000).optional(),
    maxHeight: z.number().int().positive().max(4000).optional(),
  }).strict(),
  "image-converter": z.object({ format: z.enum(MIME_TYPES) }).strict(),
  "image-effects": z.object({
    brightness: z.number().finite().min(0).max(200).optional(),
    contrast: z.number().finite().min(0).max(200).optional(),
    saturate: z.number().finite().min(0).max(200).optional(),
    grayscale: z.number().finite().min(0).max(100).optional(),
  }).strict(),
  "video-trimmer": z.object({
    startSec: z.number().finite().min(0).max(86_400).optional(),
    endSec: z.number().finite().min(0).max(86_400).optional(),
  }).strict(),
  "video-cropper": z.object({
    x: z.number().finite().min(0).max(20_000).optional(),
    y: z.number().finite().min(0).max(20_000).optional(),
    width: z.number().int().positive().max(20_000),
    height: z.number().int().positive().max(20_000),
  }).strict(),
  "video-resizer": z.object({
    width: z.number().int().positive().max(8000),
    height: z.number().int().positive().max(8000),
    fps: z.number().finite().positive().max(120).optional(),
  }).strict(),
  "video-compressor": z.object({
    videoBitsPerSecond: z.number().int().positive().max(50_000_000).optional(),
    audioBitsPerSecond: z.number().int().positive().max(512_000).optional(),
  }).strict(),
} as const;

export const MVP_EXECUTABLE_TOOL_IDS = Object.freeze([
  "background-remover","image-upscaler","image-cropper","image-compressor","image-converter",
  "image-effects","video-trimmer","video-cropper","video-resizer","video-compressor",
] as const);

const INTENTS: Record<string, readonly string[]> = {
  "background-remover": ["remove background","transparent background","cut out background","background removal","إزالة الخلفية","خلفية شفافة"],
  "image-upscaler": ["upscale","sharper","higher quality","increase resolution","make it clearer","رفع الجودة","زيادة الدقة"],
  "image-cropper": ["crop","resize","dimensions","aspect ratio","قص الصورة","تغيير الحجم"],
  "image-compressor": ["compress","smaller","reduce size","file size","lighter","ضغط الصور","تصغير حجم الصورة"],
  "image-converter": ["convert format","jpg to png","png to jpg","webp","change format","تحويل الصيغة","تحويل الصورة"],
  "image-effects": ["brightness","contrast","saturation","grayscale","adjust image","سطوع","تباين","تشبع"],
  "video-trimmer": ["trim video","cut video","video trim","اقتطاع الفيديو","اقتطع الفيديو","اقتطع أول","قص أول"],
  "video-cropper": ["crop video","video crop","قص الفيديو من الاطراف","قص الفيديو من الأطراف"],
  "video-resizer": ["resize video","change video resolution","video dimensions","تغيير حجم الفيديو","تغيير دقة الفيديو"],
  "video-compressor": ["compress video","reduce video size","video compression","ضغط الفيديو","تصغير حجم الفيديو"],
};

const META: Record<string, {title:string;description:string;category:"Images"|"Video";family:"image"|"video"}> = {
  "background-remover": {title:"Background Remover",description:"Remove connected, uniform backgrounds locally.",category:"Images",family:"image"},
  "image-upscaler": {title:"Image Upscaler",description:"Increase image dimensions with high-quality resampling.",category:"Images",family:"image"},
  "image-cropper": {title:"Image Cropper",description:"Crop and resize images for exact dimensions.",category:"Images",family:"image"},
  "image-compressor": {title:"Image Compressor",description:"Reduce JPG, PNG, and WebP file size in your browser.",category:"Images",family:"image"},
  "image-converter": {title:"Image Converter",description:"Convert common raster image formats locally.",category:"Images",family:"image"},
  "image-effects": {title:"Image Effects",description:"Apply brightness, contrast, saturation, and grayscale.",category:"Images",family:"image"},
  "video-trimmer": {title:"Video Trimmer",description:"Trim a video locally in the browser with WebCodecs-compatible playback and MediaRecorder output.",category:"Video",family:"video"},
  "video-cropper": {title:"Video Cropper",description:"Crop a video locally to a deterministic rectangle.",category:"Video",family:"video"},
  "video-resizer": {title:"Video Resizer",description:"Resize a video locally to exact output dimensions.",category:"Video",family:"video"},
  "video-compressor": {title:"Video Compressor",description:"Compress a video locally with bounded browser recording bitrate.",category:"Video",family:"video"},
};

const defaultVerifier: CanonicalCapabilityVerifier = async (_input, output, _parameters, signal) =>
  !signal?.aborted && output.size > 0;
const targetSizeVerifier: CanonicalCapabilityVerifier = async (_input, output, parameters, signal) => {
  if (signal?.aborted || output.size <= 0) return false;
  const target = typeof parameters.targetSizeKB === "number" ? parameters.targetSizeKB : undefined;
  return target === undefined ? true : output.size <= target * 1024;
};
const formatVerifier: CanonicalCapabilityVerifier = async (_input, output, parameters, signal) => {
  const format = parameters.format;
  return !signal?.aborted && output.size > 0 && (typeof format !== "string" || output.type === format);
};
const videoVerifier: CanonicalCapabilityVerifier = async (_input, output, _parameters, signal) => {
  if (signal?.aborted || output.size <= 0 || output.type !== "video/webm" || typeof document === "undefined") return false;
  const url = URL.createObjectURL(output);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = url;
  try {
    await new Promise<void>((resolve,reject)=>{
      video.onloadedmetadata=()=>resolve();
      video.onerror=()=>reject(new Error("Video output metadata could not be decoded."));
    });
    return Number.isFinite(video.duration)&&video.duration>0&&video.videoWidth>0&&video.videoHeight>0;
  } catch { return false; }
  finally {
    URL.revokeObjectURL(url); video.removeAttribute("src"); video.load();
  }
};

function createCapability(id:(typeof MVP_EXECUTABLE_TOOL_IDS)[number]):CanonicalCapabilityDefinition{
  const meta=META[id];
  const isVideo=id.startsWith("video-");
  const execution=(isVideo || id==="image-effects")?"browser-worker":"browser-local";
  const safetyLimits=Object.freeze(isVideo
    ? {maxPixels:64_000_000,maxFileSizeBytes:512*1024*1024,timeoutMs:10*60*1000}
    : {maxPixels:16_000_000,maxFileSizeBytes:64*1024*1024,timeoutMs:30_000});
  const verifier=id==="image-compressor"?targetSizeVerifier:id==="image-converter"?formatVerifier:isVideo?videoVerifier:defaultVerifier;
  return Object.freeze({
    id,...meta,state:"EXECUTABLE" as const,executionMode:"LOCAL" as const,execution,
    intents:Object.freeze(INTENTS[id]),
    parameterSchema:PARAMETER_SCHEMAS[id],
    safetyLimits,verifier,
    requirements:Object.freeze({browser:true as const,network:false as const}),
    recovery:Object.freeze({maxAttempts:3 as const,replanOnFailure:false as const}),
    operational:Object.freeze({lifecycle:"ready" as const,execution,contracts:["structural","runtime","artifact"] as const,executorId:id,outputContractId:id}),
  });
}
export const CAPABILITY_DEFINITIONS:readonly CanonicalCapabilityDefinition[]=Object.freeze(MVP_EXECUTABLE_TOOL_IDS.map(createCapability));
const BY_ID=new Map(CAPABILITY_DEFINITIONS.map((definition)=>[definition.id,definition]));
export function getCanonicalCapabilityDefinition(id:string){return BY_ID.get(id);}
