-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Students Table
create table if not exists public.students (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    roll_number text not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Attendance Table
create table if not exists public.attendance (
    id uuid default uuid_generate_v4() primary key,
    student_id uuid references public.students(id) on delete cascade not null,
    date date not null,
    status text not null check (status in ('present', 'absent', 'holiday')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(student_id, date)
);

-- 3. Settings Table (for working days)
create table if not exists public.settings (
    id integer primary key default 1,
    working_days integer[] not null default '{1,2,3,4,5}'::integer[], -- 1=Mon, 7=Sun
    organization_structure jsonb default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert default settings row if not exists
insert into public.settings (id, working_days)
values (1, '{1,2,3,4,5,6}')
on conflict (id) do nothing;

-- 4. Holidays Table
create table if not exists public.holidays (
    id uuid default uuid_generate_v4() primary key,
    date date not null unique,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.settings enable row level security;
alter table public.holidays enable row level security;

-- Create Policies (Allow anonymous read/write for now to make it easy for "sir" without full auth, 
-- or we can require auth if sir needs to login. For this demo, let's allow all for anon to keep it simple, 
-- or you can add a simple PIN/password). 
-- To keep it secure but simple, let's allow public access for this specific app (assuming it's a private URL), 
-- OR better: enforce RLS but give full access for now so the app works out-of-the-box.
create policy "Allow all operations for anon on students" on public.students for all using (true);
create policy "Allow all operations for anon on attendance" on public.attendance for all using (true);
create policy "Allow all operations for anon on settings" on public.settings for all using (true);
create policy "Allow all operations for anon on holidays" on public.holidays for all using (true);
