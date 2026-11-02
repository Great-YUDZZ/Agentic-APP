import React from 'react';

export interface ProviderLogoProps {
  provider: string;
  className?: string;
  size?: number;
}

/**
 * Logo Resmi Vektor SVG untuk Provider AI & Hub
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
        <path d="M12 24C12 17.3726 6.62742 12 0 12C6.62742 12 12 6.62742 12 0C12 6.62742 17.3726 12 24 12C17.3726 12 12 17.3726 12 24Z" />
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
        <path d="M13.8 2.5a1.2 1.2 0 0 0-1.8 0L9.8 4.7a1.2 1.2 0 0 1-1.3.2L5.8 3.8a1.2 1.2 0 0 0-1.5 1.1L4.1 7.7a1.2 1.2 0 0 1-.7 1.1L1 10.3a1.2 1.2 0 0 0-.5 1.7l1.7 2.4a1.2 1.2 0 0 1 .1 1.3L1.2 18a1.2 1.2 0 0 0 .9 1.6l2.8.7a1.2 1.2 0 0 1 1 .9l.9 2.8a1.2 1.2 0 0 0 1.6.8l2.6-1.3a1.2 1.2 0 0 1 1.3.1l2.4 1.7a1.2 1.2 0 0 0 1.7-.5l1.5-2.5a1.2 1.2 0 0 1 1.1-.7l2.8-.2a1.2 1.2 0 0 0 1.1-1.5l-1.1-2.7a1.2 1.2 0 0 1 .2-1.3l2.2-2.2a1.2 1.2 0 0 0 0-1.8l-2.2-2.2a1.2 1.2 0 0 1-.2-1.3l1.1-2.7a1.2 1.2 0 0 0-1.1-1.5l-2.8-.2a1.2 1.2 0 0 1-1.1-.7l-1.5-2.5z" />
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
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-label="OpenAI"
      >
        <path d="M20.5 10.2A5.6 5.6 0 0 0 19 4.3a5.7 5.7 0 0 0-6.7-.4 5.6 5.6 0 0 0-4.3-2 5.7 5.7 0 0 0-5.3 3.6 5.6 5.6 0 0 0-1.4 5.9 5.7 5.7 0 0 0 1.5 5.9 5.6 5.6 0 0 0 4.3 2 5.7 5.7 0 0 0 5.3-3.6 5.6 5.6 0 0 0 1.4-5.9 5.7 5.7 0 0 0-1.5-5.9" />
        <path d="M12 12l4-2.3" />
        <path d="M12 12v4.6" />
        <path d="M12 12L8 9.7" />
        <path d="M12 12l-4 2.3" />
        <path d="M12 12V7.4" />
        <path d="M12 12l4 2.3" />
      </svg>
    );
  }

  // 4. Ollama
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

  // 5. DeepSeek
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
        <path d="M21.5 14.2c-.4-.1-.8-.3-1.2-.4-1.2-1.8-3.3-3.1-5.7-3.4-.3-1.2-1-2.3-2-3-1.5-1.1-3.4-1.4-5.2-.8-.4.1-.7.4-.8.8-.1.4.1.8.5 1 1.4.5 2.8.7 4.2.5.3.6.8 1.1 1.4 1.5-2.8.5-5.3 2.1-6.8 4.5-1.3 2.1-1.6 4.6-.8 6.9.1.4.5.7.9.7.4 0 .8-.2.9-.6.2-.6.5-1.2.9-1.7 1.8 1.1 3.9 1.6 6 1.4 3.7-.4 6.8-2.8 8.1-6.2.2-.2.1-.5-.2-.7zm-11-2.2c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z" />
      </svg>
    );
  }

  // 6. Groq
  if (norm.includes('groq')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-label="Groq"
      >
        <path d="M12 3a9 9 0 1 0 9 9h-9V8" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }

  // 7. OpenRouter
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
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v7" />
        <path d="M12 15v7" />
        <path d="M2 12h7" />
        <path d="M15 12h7" />
        <path d="M4.9 4.9l5 5" />
        <path d="M14.1 14.1l5 5" />
      </svg>
    );
  }

  // 8. Mistral
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
