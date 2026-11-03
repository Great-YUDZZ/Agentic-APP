import React from 'react';

export interface ProviderLogoProps {
  provider: string;
  className?: string;
  size?: number;
}

/**
 * Logo Resmi Vektor SVG untuk Provider AI, Local Runner & Hub
 * Didesain presisi, tajam, dan selaras dengan tema gelap solid.
 */
export const ProviderLogo: React.FC<ProviderLogoProps> = ({
  provider,
  className = '',
  size = 20,
}) => {
  const norm = (provider || '').toLowerCase().trim();

  // 1. Google Gemini
  if (norm.includes('gemini') || norm.includes('google')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-label="Google Gemini"
      >
        <path d="M11.04 1.48C11.38.7 12.62.7 12.96 1.48l1.77 4.09a10.93 10.93 0 0 0 5.7 5.7l4.09 1.77c.78.34.78 1.58 0 1.92l-4.09 1.77a10.93 10.93 0 0 0-5.7 5.7l-1.77 4.09c-.34.78-1.58.78-1.92 0l-1.77-4.09a10.93 10.93 0 0 0-5.7-5.7L1.48 14.96c-.78-.34-.78-1.58 0-1.92l4.09-1.77a10.93 10.93 0 0 0 5.7-5.7l1.77-4.09z" />
      </svg>
    );
  }

  // 2. Anthropic Claude
  if (norm.includes('claude') || norm.includes('anthropic')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-label="Anthropic Claude"
      >
        <path d="M4.7 12.7c-.5 0-.9-.3-1-.8-.1-.6.2-1.1.7-1.3l3.6-1.1-2-3.2c-.3-.5-.2-1.1.2-1.4.5-.4 1.1-.3 1.5.1l2.4 2.9.7-3.7c.1-.5.6-.9 1.1-.9.6 0 1 .4 1.1.9l.7 3.7 2.4-2.9c.4-.4 1-.5 1.5-.1.4.3.5.9.2 1.4l-2 3.2 3.6 1.1c.5.2.8.7.7 1.3-.1.5-.5.8-1 .8l-3.7-.4 1.6 3.4c.3.5.1 1.1-.3 1.4-.4.4-1.1.3-1.4-.1l-2.1-3.1-1.3 3.5c-.2.5-.7.8-1.3.8-.5 0-1-.3-1.2-.8l-1.3-3.5-2.1 3.1c-.4.4-1 .5-1.4.1-.4-.3-.6-.9-.3-1.4l1.6-3.4-3.7.4z" />
      </svg>
    );
  }

  // 3. OpenAI
  if (norm.includes('openai') || norm.includes('gpt')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-label="OpenAI"
      >
        <path d="M22.28 9.87a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.52-2.82A6.07 6.07 0 0 0 10.8.34a6.03 6.03 0 0 0-5.77 4.2A6.03 6.03 0 0 0 .94 7.6a6.05 6.05 0 0 0 .52 7.03 5.98 5.98 0 0 0 .52 4.9 6.05 6.05 0 0 0 6.52 2.83 6.07 6.07 0 0 0 4.44 1.8 6.03 6.03 0 0 0 5.77-4.2 6.03 6.03 0 0 0 4.09-3.06 6.05 6.05 0 0 0-.52-7.03zM13.2 22.46a4.52 4.52 0 0 1-2.92-1.06l.14-.08 4.86-2.81a.78.78 0 0 0 .39-.68v-6.85l2.06 1.19a.07.07 0 0 1 .04.05v5.82a4.55 4.55 0 0 1-4.57 4.42zm-8.8-3.72a4.51 4.51 0 0 1-.54-3.06l.14.09 4.86 2.8a.78.78 0 0 0 .78 0l5.93-3.43v2.38a.07.07 0 0 1-.03.06l-5.04 2.91a4.55 4.55 0 0 1-6.14-1.75zM2.87 8.28a4.52 4.52 0 0 1 2.38-2l-.14.09v5.62a.78.78 0 0 0 .39.68l5.93 3.42-2.06 1.19a.07.07 0 0 1-.07 0L4.26 14.37a4.55 4.55 0 0 1-1.39-6.09zm15.42 4.22l-5.93-3.42 2.06-1.19a.07.07 0 0 1 .07 0l5.04 2.91a4.54 4.54 0 0 1-.99 8.16v-5.78a.78.78 0 0 0-.39-.68h.14zm2.84-4.5l-.14-.09-4.86-2.8a.78.78 0 0 0-.78 0L9.48 9.52V7.14a.07.07 0 0 1 .03-.06l5.04-2.91a4.55 4.55 0 0 1 6.68 4.81v.8zm-8.86 3.12l-2.38-1.38 2.38-1.37 2.38 1.37-2.38 1.38zm-1.84-9.36a4.52 4.52 0 0 1 2.92 1.06l-.14.08-4.86 2.81a.78.78 0 0 0-.39.68v6.85L5.96 11.2a.07.07 0 0 1-.04-.05V5.33a4.55 4.55 0 0 1 4.56-4.42z" />
      </svg>
    );
  }

  // 4. LM Studio
  if (norm.includes('lmstudio') || norm.includes('lm studio') || norm.includes('lms')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-label="LM Studio"
      >
        <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.2l6.9 3.8-3.4 1.9-6.9-3.8 3.4-1.9zM5.1 8.8l6 3.3v6.7l-6-3.3V8.8zm7.8 10V12.1l6-3.3v6.7l-6 3.3z" />
      </svg>
    );
  }

  // 5. Ollama
  if (norm.includes('ollama')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-label="Ollama"
      >
        <path d="M9.5 2C8.67 2 8 2.67 8 3.5V7H7C5.34 7 4 8.34 4 10v7a4 4 0 0 0 4 4h7a4 4 0 0 0 4-4v-7c0-1.66-1.34-3-3-3h-1V3.5c0-.83-.67-1.5-1.5-1.5h-1c-.83 0-1.5.67-1.5 1.5V7h-1V3.5c0-.83-.67-1.5-1.5-1.5h-1zM9 11a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-5.5 5.5h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1 0-1.5z" />
      </svg>
    );
  }

  // 6. DeepSeek
  if (norm.includes('deepseek')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-label="DeepSeek"
      >
        <path d="M22 13.8c-.5-.1-1-.4-1.5-.5-1.5-2.2-4.1-3.8-7.1-4.2-.4-1.5-1.3-2.9-2.5-3.8-1.9-1.4-4.3-1.8-6.5-1-.5.1-.9.5-1 1-.1.5.1 1 .6 1.2 1.8.6 3.5.9 5.3.6.4.8 1 1.4 1.8 1.9-3.5.6-6.6 2.6-8.5 5.6-1.6 2.6-2 5.8-1 8.6.1.5.6.9 1.1.9.5 0 1-.3 1.1-.8.3-.8.6-1.5 1.1-2.1 2.3 1.4 4.9 2 7.5 1.8 4.6-.5 8.5-3.5 10.1-7.8.3-.3.1-.6-.3-.9zm-13.8-2.8c-.8 0-1.3-.5-1.3-1.3s.5-1.3 1.3-1.3 1.3.5 1.3 1.3-.5 1.3-1.3 1.3z" />
      </svg>
    );
  }

  // 7. Groq
  if (norm.includes('groq')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-label="Groq"
      >
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.5a4.5 4.5 0 1 1 4.5-4.5v1.5h-3v-1.5a1.5 1.5 0 1 0-1.5 1.5z" />
      </svg>
    );
  }

  // 8. OpenRouter
  if (norm.includes('openrouter')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-label="OpenRouter"
      >
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v6.5M12 15.5V22M2 12h6.5M15.5 12H22M4.93 4.93l4.6 4.6M14.47 14.47l4.6 4.6M19.07 4.93l-4.6 4.6M9.53 14.47l-4.6 4.6" />
      </svg>
    );
  }

  // 9. Mistral
  if (norm.includes('mistral')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-label="Mistral"
      >
        <rect x="3" y="4" width="4" height="4" rx="0.5" />
        <rect x="17" y="4" width="4" height="4" rx="0.5" />
        <rect x="3" y="10" width="4" height="4" rx="0.5" />
        <rect x="10" y="10" width="4" height="4" rx="0.5" />
        <rect x="17" y="10" width="4" height="4" rx="0.5" />
        <rect x="3" y="16" width="4" height="4" rx="0.5" />
        <rect x="17" y="16" width="4" height="4" rx="0.5" />
      </svg>
    );
  }

  // Fallback: Custom Endpoint / Proxy Node
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="Custom Node"
    >
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
};
