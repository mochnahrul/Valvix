import React from "react";

interface ValvixMarkProps {
  className?: string;
}

/**
 * Custom geometric "V" brand mark for Valvix.
 * Matches /favicon.svg 1:1 for unified brand identity across tabs, navbar, and login.
 */
export const ValvixMark: React.FC<ValvixMarkProps> = ({ className = "w-5 h-5" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left crisp blade */}
      <path d="M3 5H8.2L12.6 15.6L10.2 21L3 5Z" fill="#F3F4F6" />
      {/* Right emerald blade */}
      <path d="M15.8 5H21L13.8 21H10.2L15.8 5Z" fill="#00E599" />
      {/* Inner apex facet */}
      <path d="M12 10.2L14.2 5H9.8L12 10.2Z" fill="#00E599" fillOpacity="0.35" />
    </svg>
  );
};
