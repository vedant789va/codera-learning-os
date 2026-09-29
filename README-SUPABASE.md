# CODERA Supabase authentication

The CODERA authentication layer has been switched from browser-local authentication to Supabase Authentication.

## Implemented

- Supabase session restoration on page load
- Email/password sign up
- Email/password login
- Username stored in Supabase user metadata during sign up
- Google OAuth login
- Supabase auth state listener
- Email-confirmation message handling
- GitHub Pages OAuth redirect based on Vite `BASE_URL`
- Existing CODERA workspace remains behind authentication
- `.env.local` is ignored by Git
- CSS import corrected to `styles.css`

## Required environment values

Copy the values from Supabase Project Settings > API into `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

Do not use the `service_role` or secret key in this frontend application.

## Supabase settings already expected by this code

- Email provider enabled
- Email confirmation enabled
- Google provider enabled
- Google OAuth redirect URI points to Supabase's `/auth/v1/callback`
- Site URL is the GitHub Pages CODERA URL

For local development, also add the local app URL to Supabase Authentication > URL Configuration > Redirect URLs, for example:

`http://localhost:5173/codera-learning-os/`

For GitHub Pages:

`https://vedant789va.github.io/codera-learning-os/`

## Install

Run once in the project folder:

```bash
npm install
```

Then:

```bash
npm run dev
```

The Google button redirects through Supabase and returns to the CODERA base path.
