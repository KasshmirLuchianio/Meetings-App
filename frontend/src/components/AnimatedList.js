import React from 'react';

export function AnimatedList({ children, className }) {
  return (
    <div className={`animated-list ${className || ''}`}>
      {children}
    </div>
  );
}

export function AnimatedItem({ children, className }) {
  return (
    <div className={`animated-item ${className || ''}`}>
      {children}
    </div>
  );
}

export function FadeIn({ children, delay = 0, className }) {
  return (
    <div
      className={`fade-in ${className || ''}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}
