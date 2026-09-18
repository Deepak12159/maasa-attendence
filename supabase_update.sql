-- Run this in your Supabase SQL Editor:

-- 1. Add new columns to students table
alter table public.students 
  add column if not exists enrollment_number text,
  add column if not exists scholar_number text,
  add column if not exists program text,
  add column if not exists club_name text default 'SPORTS CLUB',
  add column if not exists mobile_number text,
  add column if not exists year text,
  add column if not exists section text default 'A',
  add column if not exists receipt_number text,
  add column if not exists registration_date text;

-- 2. Make roll_number optional and drop its unique constraint (not needed, enrollment_number is unique key now)
alter table public.students alter column roll_number drop not null;
alter table public.students drop constraint if exists students_roll_number_key;

-- 3a. Add unique constraint on enrollment_number for upsert conflict resolution
alter table public.students drop constraint if exists students_enrollment_number_key;
alter table public.students add constraint students_enrollment_number_key unique (enrollment_number);

-- 3. Add indexes for high performance across 900+ students
create index if not exists idx_students_year on public.students(year);
create index if not exists idx_students_program on public.students(program);
create index if not exists idx_students_section on public.students(section);
create index if not exists idx_students_scholar on public.students(scholar_number);
create index if not exists idx_students_enrollment on public.students(enrollment_number);
create index if not exists idx_attendance_date on public.attendance(date);

-- 4. Set convenient policies so Sports Sir can mark attendance without getting blocked
-- Allow both anon and authenticated users to take attendance and view students
drop policy if exists "Allow all operations for anon on students" on public.students;
drop policy if exists "Allow all operations for anon on attendance" on public.attendance;
drop policy if exists "Allow public read access on students" on public.students;
drop policy if exists "Allow auth insert on students" on public.students;
drop policy if exists "Allow auth update on students" on public.students;
drop policy if exists "Allow auth delete on students" on public.students;
drop policy if exists "Allow public read access on attendance" on public.attendance;
drop policy if exists "Allow auth insert on attendance" on public.attendance;
drop policy if exists "Allow auth update on attendance" on public.attendance;
drop policy if exists "Allow auth delete on attendance" on public.attendance;
-- Drop the exact policy names we're about to create (in case this script is re-run)
drop policy if exists "Allow all on students" on public.students;
drop policy if exists "Allow all on attendance" on public.attendance;
drop policy if exists "Allow all on settings" on public.settings;
drop policy if exists "Allow all on holidays" on public.holidays;

-- Universal smooth access (both for Sir when logged in or quick direct access)
create policy "Allow all on students" on public.students for all using (true) with check (true);
create policy "Allow all on attendance" on public.attendance for all using (true) with check (true);
create policy "Allow all on settings" on public.settings for all using (true) with check (true);
create policy "Allow all on holidays" on public.holidays for all using (true) with check (true);

-- 5. Add organization structure to settings
alter table public.settings
  add column if not exists organization_structure jsonb default '[]'::jsonb;

