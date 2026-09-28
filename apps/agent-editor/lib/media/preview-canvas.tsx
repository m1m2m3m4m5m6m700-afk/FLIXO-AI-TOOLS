"use client";

import { useEffect, useRef } from "react";
import type { Layer, ProjectState } from "../schemas/project";
import { getLayerSourceTime, getRenderableLayers } from "./frame-sync";

type Props = Readonly<{
  projectState: ProjectState;
  frameIndex: number;
}>;

const imageCache = new Map<string, HTMLImageElement>();

function getImage(layer: Layer): HTMLImageElement | null {
  if (!layer.url || typeof window === "undefined") return null;
  const cached = imageCache.get(layer.id);
  if (cached) return cached;

  const image = new Image();
  image.decoding = "async";
  image.src = layer.url;
  imageCache.set(layer.id, image);
  return image;
}

function drawLayer(
  context: CanvasRenderingContext2D,
  layer: Layer,
  width: number,
  height: number,
  videos: Map<string, HTMLVideoElement>,
): void {
  context.save();
  context.globalAlpha = layer.opacity;
  context.translate(width / 2 + layer.transform.x, height / 2 + layer.transform.y);
  context.rotate((layer.transform.rotation * Math.PI) / 180);
  context.scale(layer.transform.scaleX, layer.transform.scaleY);

  if (layer.type === "image") {
    const image = getImage(layer);
    if (image?.complete && image.naturalWidth > 0) {
      context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    }
  } else if (layer.type === "video") {
    const video = videos.get(layer.id);
    if (video && video.videoWidth > 0) {
      context.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);
    }
  } else if (layer.type === "text") {
    context.fillStyle = "#ffffff";
    context.font = "48px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(layer.content ?? layer.name, 0, 0);
  }

  context.restore();
}

export function PreviewCanvas({ projectState, frameIndex }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = projectState.dimensions.width;
    canvas.height = projectState.dimensions.height;

    let cancelled = false;

    const render = async () => {
      const layers = getRenderableLayers(projectState, frameIndex);
      const videos = layers.filter((layer) => layer.type === "video" && layer.url);

      await Promise.all(
        videos.map(async (layer) => {
          const video = videosRef.current.get(layer.id);
          if (!video) return;

          const target = getLayerSourceTime(layer, frameIndex, projectState.dimensions.fps);
          if (Math.abs(video.currentTime - target) < 0.001) return;

          await new Promise<void>((resolve) => {
            const finish = () => resolve();
            video.addEventListener("seeked", finish, { once: true });
            video.currentTime = target;
          });
        }),
      );

      if (cancelled) return;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#020617";
      context.fillRect(0, 0, canvas.width, canvas.height);

      for (const layer of layers) {
        drawLayer(context, layer, canvas.width, canvas.height, videosRef.current);
      }
    };

    frameRef.current = requestAnimationFrame(() => {
      void render();
    });

    return () => {
      cancelled = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [frameIndex, projectState]);

  return (
    <div className="render-surface" data-testid="render-surface">
      <canvas ref={canvasRef} className="render-canvas" aria-label="Frame-accurate media preview" />
      {projectState.layers
        .filter((layer) => layer.type === "video" && layer.url)
        .map((layer) => (
          <video
            key={layer.id}
            ref={(element) => {
              if (element) videosRef.current.set(layer.id, element);
              else videosRef.current.delete(layer.id);
            }}
            src={layer.url}
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="render-source-video"
          />
        ))}
    </div>
  );
}