-- ============================================================
-- LEARNBRIDGE DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor (one query)
-- ============================================================

-- Enable UUID generation (usually already on in Supabase)
create extension if not exists "pgcrypto";

-- ── PROFILES (extends auth.users) ──────────────────────────
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  role text check (role in ('parent','tutor','admin')) not null,
  full_name text,
  email text,
  phone text,
  location text,
  gender text,
  avatar_url text,
  bio text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;

create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);
create policy "Public profiles visible" on profiles
  for select using (true);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- ── TUTORS ──────────────────────────────────────────────────
create table tutors (
  id uuid references profiles(id) on delete cascade primary key,
  specialization text[],
  years_experience int default 0,
  rate_per_session numeric(10,2),
  approved_rate numeric(10,2),
  prc_license_url text,
  nbi_clearance_url text,
  medical_cert_url text,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  wallet_balance numeric(10,2) default 0,
  certification_scores jsonb,
  created_at timestamptz default now()
);
alter table tutors enable row level security;

create policy "Tutors can view/manage own data" on tutors
  for all using (auth.uid() = id);
create policy "Parents can view approved tutors" on tutors
  for select using (status = 'approved');
create policy "Admins can manage all tutors" on tutors
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── STUDENTS ────────────────────────────────────────────────
create table students (
  id uuid default gen_random_uuid() primary key,
  parent_id uuid references profiles(id) on delete cascade,
  name text not null,
  grade_level int check (grade_level between 2 and 6),
  notes text,
  assessment_results jsonb,
  created_at timestamptz default now()
);
alter table students enable row level security;

create policy "Parents manage own students" on students
  for all using (auth.uid() = parent_id);

-- ── QUESTION BANK ───────────────────────────────────────────
create table questions (
  id uuid default gen_random_uuid() primary key,
  tutor_id uuid references profiles(id),
  subject text check (subject in ('english','mathematics')) not null,
  topic text not null,
  difficulty text check (difficulty in ('easy','medium','hard')) not null,
  question_text text not null,
  options jsonb not null,
  correct_answer text not null,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  created_at timestamptz default now()
);
alter table questions enable row level security;

create policy "Approved tutors can contribute questions" on questions
  for insert with check (
    exists (select 1 from tutors where id = auth.uid() and status = 'approved')
  );
create policy "Questions visible to authenticated users" on questions
  for select using (auth.role() = 'authenticated');
create policy "Admins manage all questions" on questions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── BOOKINGS ────────────────────────────────────────────────
create table bookings (
  id uuid default gen_random_uuid() primary key,
  parent_id uuid references profiles(id),
  tutor_id uuid references profiles(id),
  student_id uuid references students(id),
  subject text,
  status text check (status in ('pending','confirmed','rejected','cancelled','completed')) default 'pending',
  session_mode text check (session_mode in ('online','face-to-face')),
  payment_method text check (payment_method in ('cash','gcash','bank_transfer')),
  total_amount numeric(10,2),
  commission_amount numeric(10,2),
  notes text,
  created_at timestamptz default now()
);
alter table bookings enable row level security;

create policy "Parents manage own bookings" on bookings
  for all using (auth.uid() = parent_id);
create policy "Tutors see their bookings" on bookings
  for select using (auth.uid() = tutor_id);
create policy "Tutors update booking status" on bookings
  for update using (auth.uid() = tutor_id);

-- ── SESSIONS ────────────────────────────────────────────────
create table sessions (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references bookings(id) on delete cascade,
  session_number int check (session_number between 1 and 8),
  scheduled_date date,
  scheduled_time time,
  status text check (status in ('scheduled','completed','missed')) default 'scheduled',
  topic_covered text,
  performance_indicator text check (performance_indicator in ('good','improving','needs_improvement')),
  tutor_comments text,
  created_at timestamptz default now()
);
alter table sessions enable row level security;

create policy "Session parties can view" on sessions
  for select using (
    exists (
      select 1 from bookings b
      where b.id = booking_id
      and (b.parent_id = auth.uid() or b.tutor_id = auth.uid())
    )
  );
create policy "Tutors submit feedback" on sessions
  for update using (
    exists (select 1 from bookings where id = booking_id and tutor_id = auth.uid())
  );

-- ── WALLET TRANSACTIONS ─────────────────────────────────────
create table wallet_transactions (
  id uuid default gen_random_uuid() primary key,
  tutor_id uuid references profiles(id),
  type text check (type in ('topup','commission_deduction')),
  amount numeric(10,2),
  description text,
  created_at timestamptz default now()
);
alter table wallet_transactions enable row level security;

create policy "Tutors see own transactions" on wallet_transactions
  for select using (auth.uid() = tutor_id);
create policy "Tutors insert own transactions" on wallet_transactions
  for insert with check (auth.uid() = tutor_id);
create policy "Admins see all transactions" on wallet_transactions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── MESSAGES (in-app chat) ──────────────────────────────────
create table messages (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references bookings(id),
  sender_id uuid references profiles(id),
  content text not null,
  created_at timestamptz default now()
);
alter table messages enable row level security;

create policy "Chat participants can access" on messages
  for all using (
    exists (
      select 1 from bookings b
      where b.id = booking_id
      and (b.parent_id = auth.uid() or b.tutor_id = auth.uid())
    )
  );

-- ============================================================
-- DONE. After running, go to Authentication > Providers
-- and make sure Email provider is enabled.
-- ============================================================
