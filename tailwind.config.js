/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          canvas: '#212121',
          panel: '#171717',
          card: '#2f2f2f',
          subtle: '#262626',
          border: '#303030',
        },
        chatgpt: {
          canvas: '#212121',
          sidebar: '#171717',
          surface: '#2f2f2f',
          hover: '#2a2a2a',
          active: '#383838',
          border: '#303030',
          borderLight: '#383838',
          text: '#ececec',
          muted: '#b4b4b4',
          subtleText: '#707070',
        },
        accent: {
          blue: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
