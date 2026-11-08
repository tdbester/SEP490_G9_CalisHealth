import { useState } from "react";

/**
 * Logo CalisHealth (gradient) — dùng chung cho Topbar và các màn fullscreen
 * như "Real-time AI Pose Tracking" để thương hiệu nhất quán giữa mọi màn.
 *
 * Gradient id phải unique cho từng instance vì SVG gradient trong DOM là
 * global — hai bản cùng id sẽ dùng nhầm gradient của nhau.
 */
let logoSequence = 0;

export default function BrandLogo({ width = 12, height = 18, className = "" }) {
  const [gradientId] = useState(() => {
    logoSequence += 1;
    return `calishealth-logo-gradient-${logoSequence}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 12 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5.6316 0C6.7146 4.332 11.0466 6.498 11.0466 11.913C11.0466 13.3491 10.4761 14.7265 9.46058 15.742C8.44507 16.7575 7.06775 17.328 5.6316 17.328C4.19545 17.328 2.81812 16.7575 1.80262 15.742C0.787106 14.7265 0.216599 13.3491 0.216599 11.913C0.216599 9.747 1.2996 8.664 2.3826 7.581C2.3826 9.747 3.4656 10.83 4.5486 10.83C4.5486 6.498 3.4656 4.332 5.6316 0Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M0.758101 12.996H3.4656L4.8735 10.2885L6.9312 15.7035L8.3391 12.996H10.5051"
        strokeWidth="1.5162"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="white"
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="2.3826"
          y1="-2.22058e-07"
          x2="14.1558"
          y2="12.2638"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#B44CFF" />
          <stop offset="1" stopColor="#FF77A8" />
        </linearGradient>
      </defs>
    </svg>
  );
}
