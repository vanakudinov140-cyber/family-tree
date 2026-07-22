"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

interface PhotoCropperProps {
  imageSrc: string;
  onCropComplete: (area: Area) => void;
  disabled?: boolean;
}

export function PhotoCropper({
  imageSrc,
  onCropComplete,
  disabled = false,
}: PhotoCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const handleComplete = useCallback(
    (_: Area, croppedAreaPixels: Area) => {
      onCropComplete(croppedAreaPixels);
    },
    [onCropComplete],
  );

  return (
    <div className="space-y-3">
      <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-[#1B4332]/10">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={disabled ? () => undefined : setCrop}
          onZoomChange={disabled ? () => undefined : setZoom}
          onCropComplete={handleComplete}
          showGrid={false}
          objectFit="contain"
        />
      </div>
      <label className="block text-sm text-[#2D4A3E]">
        <span className="mb-1 block font-medium">Масштаб</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          disabled={disabled}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="w-full accent-[#1B4332]"
          aria-label="Масштаб обрезки"
        />
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setCrop({ x: 0, y: 0 });
          setZoom(1);
        }}
        className="text-sm font-medium text-[#2D4A3E] underline-offset-2 hover:underline disabled:opacity-50"
      >
        Сбросить положение
      </button>
    </div>
  );
}
