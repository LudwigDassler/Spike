import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    '';

  const supabasePublishableOrAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    '';

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    env.NEXT_PUBLIC_APP_URL ||
    '';

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'tedcloud-safe-auth-fetch',
        transform(code, id) {
          const cleanId = id.replace(/\\/g, '/');
          if (
            !cleanId.includes('/src/') ||
            cleanId.includes('/node_modules/') ||
            cleanId.endsWith('/src/lib/apiSession.ts') ||
            cleanId.includes('/src/server/')
          ) {
            return null;
          }
          if (!/\bfetch\s*\(/.test(code)) return null;
          const transformed = code.replace(
            /(?<![.\w$])fetch\s*\(/g,
            '((typeof window !== "undefined" && window.__tedcloudFetch) || fetch)('
          );
          return transformed !== code ? { code: transformed, map: null } : null;
        },
      },
    ],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        supabasePublishableOrAnonKey
      ),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(
        supabasePublishableOrAnonKey
      ),
      'process.env.NEXT_PUBLIC_SITE_URL': JSON.stringify(siteUrl),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        supabasePublishableOrAnonKey
      ),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        supabasePublishableOrAnonKey
      ),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(
        supabasePublishableOrAnonKey
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
