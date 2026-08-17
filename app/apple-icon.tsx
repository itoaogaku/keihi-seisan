import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
        <rect width="180" height="180" fill="#7c3aed" />

        {/* receipt body with torn bottom edge */}
        <path
          d="M42,26 L138,26 L138,140 L126,152 L114,140 L102,152 L90,140 L78,152 L66,140 L54,152 L42,140 Z"
          fill="#ffffff"
        />

        {/* store name */}
        <rect x="66" y="42" width="48" height="9" rx="4.5" fill="#7c3aed" />

        {/* item rows: name + price */}
        <rect x="54" y="64" width="40" height="6" rx="3" fill="#94a3b8" />
        <rect x="104" y="64" width="22" height="6" rx="3" fill="#94a3b8" />

        <rect x="54" y="80" width="32" height="6" rx="3" fill="#94a3b8" />
        <rect x="104" y="80" width="22" height="6" rx="3" fill="#94a3b8" />

        <rect x="54" y="96" width="44" height="6" rx="3" fill="#94a3b8" />
        <rect x="104" y="96" width="22" height="6" rx="3" fill="#94a3b8" />

        {/* divider */}
        <rect x="54" y="112" width="72" height="2" fill="#e2e8f0" />

        {/* total row */}
        <rect x="54" y="122" width="26" height="9" rx="4.5" fill="#7c3aed" />
        <rect x="96" y="122" width="30" height="9" rx="4.5" fill="#7c3aed" />
      </svg>
    ),
    { ...size }
  );
}
