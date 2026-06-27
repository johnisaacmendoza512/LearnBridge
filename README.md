# LearnBridge — Web Platform

AI-powered tutoring marketplace for Grade 2–6 Filipino learners (English & Mathematics).
Built with **React** (Create React App) + **Supabase** (Postgres, Auth, RLS).

## 1. Install dependencies
```bash
npm install
```

## 2. Set up Supabase
1. Create a project at https://supabase.com
2. Open the **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it.
   This creates all 8 tables (`profiles`, `tutors`, `students`, `questions`, `bookings`,
   `sessions`, `wallet_transactions`, `messages`) with Row Level Security policies.
3. Go to **Authentication → Providers** and confirm Email is enabled.
   (Optional for local testing: turn OFF "Confirm email" under Authentication → Settings.)
4. Go to **Project Settings → API** and copy your **Project URL** and **anon public key**.

## 3. Configure environment variables
Copy `.env` and fill in your Supabase values:
```
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
```

## 4. Run the app
```bash
npm start
```
Visit http://localhost:3000

## Project structure
```
src/
  components/
    auth/ProtectedRoute.jsx     # route guard (auth + role-based)
    layout/                      # Sidebar, Topbar, AppLayout
    ui/                           # Icon, Avatar, Badge, Modal, StatCard, etc.
  context/AuthContext.jsx        # Supabase auth session + sign up/in/out
  hooks/                          # useStudents, useBookings, useWallet, useProfile
  lib/
    supabase.js                  # Supabase client instance
    tokens.js                    # design tokens (colors)
  pages/
    LandingPage.jsx
    auth/        LoginPage, RegisterPage
    parent/       Dashboard, MyChildren, FindTutors, Progress, Messages, Bookings
    tutor/        Dashboard, Profile, Certification, Sessions, QuestionBank, Wallet
    admin/        Dashboard, TutorVerification, QuestionBankAdmin, Reports
  styles/globals.css             # design system (buttons, cards, badges, tables...)
  App.jsx                         # router — wires all pages together
  index.js                         # ReactDOM root + BrowserRouter

supabase/schema.sql               # full DB schema + RLS policies
```

## Notes / what's mocked vs. wired to Supabase
- **Wired to Supabase already:** auth (sign up/in/out), `useStudents`, `useBookings`, `useWallet`.
- **Still using mock/demo data (intentionally, to keep the UI testable before you have real data):**
  Find Tutors listings, Sessions feedback, Question Bank rows, Admin verification queue,
  Certification exam questions, Messages chat history.
  Each of these pages has clearly-named mock arrays at the top of the file —
  swap them for Supabase queries (similar pattern to `useStudents.js`) as you wire up that flow.

## Next steps (suggested order)
1. Get auth + student creation fully working end-to-end (already wired).
2. Wire `find-tutors` to query `tutors` table joined with `profiles`.
3. Wire booking creation (parent books a tutor → insert into `bookings`).
4. Wire tutor-side session feedback submission → insert into `sessions`.
5. Wire admin tutor verification (approve/reject → update `tutors.status`).
6. Add Supabase Storage buckets for NBI/PRC/Medical document uploads.
7. Add the OpenAI-powered certification exam generation (separate Edge Function recommended).
