/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './js/**/*.js'
  ],
  // These classes are added or selected at runtime. Keeping them explicit
  // prevents production builds from removing styles that are not visible in
  // the initial HTML state.
  safelist: [
    'hidden',
    'fixed',
    'inset-0',
    'z-50',
    'bg-white',
    'overflow-auto',
    'grid',
    'grid-cols-1',
    'grid-cols-2',
    'grid-cols-3',
    'gap-2',
    'mb-2',
    'mb-3',
    'mr-2',
    'bg-gray-900',
    'bg-emerald-600',
    'bg-orange-500',
    'bg-gray-200',
    'bg-primary',
    'bg-secondary',
    'bg-accent',
    'text-white',
    'text-red-500',
    'text-primary',
    'text-secondary',
    'text-orange-600',
    'text-gray-600',
    'text-xs',
    'font-bold',
    'font-semibold',
    'ring-2',
    'ring-primary',
    'scale-105',
    'scale-110',
    'border-secondary',
    'border-gray-200',
    'shadow-lg',
    'col-span-full',
    'text-center',
    'py-10',
    'w-full',
    'h-full',
    'object-contain',
    'rounded-lg',
    'shadow-md',
    'animate-spin',
    'hover:bg-gray-300',
    'hover:border-primary/50'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        secondary: '#F97316',
        accent: '#10B981',
        light: '#F3F4F6',
        dark: '#1F2937'
      },
      fontFamily: {
        nunito: ['Nunito', 'sans-serif', 'system-ui']
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
        float: 'float 3s ease-in-out infinite',
        wiggle: 'wiggle 1s ease-in-out infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '50%': { transform: 'rotate(1deg)' }
        },
        popScale: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' }
        }
      }
    }
  },
  plugins: []
};
