-- Drop the insecure "allow all" policies
drop policy if exists "Allow all operations for anon on students" on public.students;
drop policy if exists "Allow all operations for anon on attendance" on public.attendance;
drop policy if exists "Allow all operations for anon on settings" on public.settings;
drop policy if exists "Allow all operations for anon on holidays" on public.holidays;

-- 1. Students Table Policies
-- Anyone can view students
create policy "Allow public read access on students" on public.students for select using (true);
-- Only authenticated users (Sir) can modify students
create policy "Allow auth insert on students" on public.students for insert with check (auth.role() = 'authenticated');
create policy "Allow auth update on students" on public.students for update using (auth.role() = 'authenticated');
create policy "Allow auth delete on students" on public.students for delete using (auth.role() = 'authenticated');

-- 2. Attendance Table Policies
-- Anyone can view attendance
create policy "Allow public read access on attendance" on public.attendance for select using (true);
-- Only authenticated users (Sir) can modify attendance
create policy "Allow auth insert on attendance" on public.attendance for insert with check (auth.role() = 'authenticated');
create policy "Allow auth update on attendance" on public.attendance for update using (auth.role() = 'authenticated');
create policy "Allow auth delete on attendance" on public.attendance for delete using (auth.role() = 'authenticated');

-- 3. Settings Table Policies
create policy "Allow public read access on settings" on public.settings for select using (true);
create policy "Allow auth modify on settings" on public.settings for all using (auth.role() = 'authenticated');

-- 4. Holidays Table Policies
create policy "Allow public read access on holidays" on public.holidays for select using (true);
create policy "Allow auth modify on holidays" on public.holidays for all using (auth.role() = 'authenticated');
