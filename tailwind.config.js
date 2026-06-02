/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#FF6B35',
        alert: {
          DEFAULT: '#E53935',
          dark: '#FF453A',
        },
        success: {
          DEFAULT: '#2E7D32',
          dark: '#32D74B',
        },
        tier: {
          t1: {
            DEFAULT: '#D94040',
            dark: '#E05555',
          },
          t2: {
            DEFAULT: '#4A7FB5',
            dark: '#6BA5D4',
          },
          t3: {
            DEFAULT: '#8A6DB8',
            dark: '#A68CC9',
          },
        },
        text: {
          main: {
            DEFAULT: '#1C1C1E',
            dark: '#FFFFFF',
          },
          secondary: {
            DEFAULT: '#6E6E73',
            dark: '#98989D',
          },
          muted: {
            DEFAULT: '#8E8E93',
            dark: '#6E6E73',
          },
        },
        bg: {
          main: {
            DEFAULT: '#F5F5F7',
            dark: '#121212',
          },
          card: {
            DEFAULT: '#FFFFFF',
            dark: '#1E1E1E',
          },
          hover: {
            DEFAULT: '#F0F0F5',
            dark: '#252525',
          },
          alert: {
            DEFAULT: '#FCE4E4',
            dark: '#3A1C1C',
          }
        },
        border: {
          card: {
            DEFAULT: '#E5E5EA',
            dark: '#2C2C2E',
          }
        }
      },
      fontSize: {
        'num-large': '32px'
      }
    }
  },
  plugins: []
};
