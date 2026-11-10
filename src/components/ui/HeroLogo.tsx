import React from 'react';

interface HeroLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  solidWhite?: boolean;
}

/**
 * The supplied logo has independent gold and wordmark colors. Rendering both
 * prepared variants lets the navigation retain its original color transition
 * without affecting the artwork or its proportions.
 */
export function HeroLogo({ className = '', solidWhite = false, ...props }: HeroLogoProps) {
  return (
    <span
      className={`relative block w-auto ${className}`}
      style={{ aspectRatio: '1500 / 510' }}
      {...props}
    >
      <img
        src="/logonew.svg"
        alt=""
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full object-contain brightness-0 invert transition-opacity duration-700 ${
          solidWhite ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <img
        src="/logonew-solid.svg"
        alt=""
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ${
          solidWhite ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </span>
  );
}
