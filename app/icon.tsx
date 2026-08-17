import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="#7c3aed" />

        {/* receipt body with torn bottom edge */}
        <path
          d="M8,5 L24,5 L24,23 L21,26 L18,23 L15,26 L12,23 L9,26 L8,23 Z"
          fill="#ffffff"
        />

        <rect x="12" y="9" width="8" height="2" rx="1" fill="#7c3aed" />
        <rect x="10" y="14" width="12" height="1.6" rx="0.8" fill="#94a3b8" />
        <rect x="10" y="18" width="9" height="1.6" rx="0.8" fill="#94a3b8" />
      </svg>
    ),
    { ...size }
  );
}
