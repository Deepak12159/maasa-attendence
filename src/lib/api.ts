import { supabase } from './supabase';
import { startOfDay, format } from 'date-fns';

export interface Student {
  id: string;
  name: string;
  roll_number?: string;
  enrollment_number?: string;
  scholar_number?: string;
  program?: string;
  club_name?: string;
  mobile_number?: string;
  year?: string;
  section?: string;
  receipt_number?: string;
  registration_date?: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'holiday';
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface OrgSection {
  name: string;
  startTime?: string;
  endTime?: string;
  attendanceDays?: number[];
}

export interface OrgBranch {
  name: string;
  sections: OrgSection[];
}

export interface OrgYear {
  name: string;
  branches: OrgBranch[];
}

export interface Settings {
  id: number;
  working_days: number[];
  organization_structure: OrgYear[];
}

export async function fetchStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .limit(3000)
    .order('name', { ascending: true });
  if (error) throw error;
  return data as Student[];
}

export async function fetchAttendance(dateStr: string) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('date', dateStr)
    .limit(3000);
  if (error) throw error;
  return data as Attendance[];
}

export async function fetchAllAttendance() {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .limit(10000);
  if (error) throw error;
  return data as Attendance[];
}

export async function fetchHolidays() {
  const { data, error } = await supabase.from('holidays').select('*');
  if (error) throw error;
  return data as Holiday[];
}

export async function fetchSettings() {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
  if (error) {
    if (error.code === 'PGRST116') {
      return { id: 1, working_days: [1, 2, 3, 4, 5, 6], organization_structure: [] } as Settings;
    }
    throw error;
  }
  return data as Settings;
}

export async function updateOrganizationStructure(structure: OrgYear[]) {
  const { error } = await supabase
    .from('settings')
    .update({ organization_structure: structure })
    .eq('id', 1);
  if (error) throw error;
}

export async function toggleAttendance(studentId: string, dateStr: string, currentStatus: string | null) {
  if (currentStatus === 'present') {
    const { error } = await supabase.from('attendance').delete().match({ student_id: studentId, date: dateStr });
    if (error) throw error;
    return null;
  } else {
    const { data, error } = await supabase
      .from('attendance')
      .upsert({ student_id: studentId, date: dateStr, status: 'present' }, { onConflict: 'student_id,date' })
      .select()
      .single();
    if (error) throw error;
    return data as Attendance;
  }
}

export async function batchMarkAttendance(studentIds: string[], dateStr: string, status: 'present' | 'absent') {
  if (studentIds.length === 0) return;

  if (status === 'absent') {
    // Delete attendance records for these students on this date
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('date', dateStr)
      .in('student_id', studentIds);
    if (error) throw error;
  } else {
    // Upsert present records in chunks of 100
    const records = studentIds.map(id => ({
      student_id: id,
      date: dateStr,
      status: 'present'
    }));

    const chunkSize = 100;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('attendance')
        .upsert(chunk, { onConflict: 'student_id,date' });
      if (error) throw error;
    }
  }
}

export async function batchUpsertStudents(studentsList: Partial<Student>[]) {
  // Deduplicate by enrollment_number — PostgreSQL upsert cannot handle
  // two rows with the same conflict key within the same batch.
  // Keep the last occurrence of each enrollment_number.
  const seen = new Map<string, Partial<Student>>();
  for (const s of studentsList) {
    const key = s.enrollment_number?.trim() || '';
    if (key) {
      seen.set(key, s);
    }
    // Students with no enrollment_number are skipped (shouldn't happen with Excel import)
  }
  const deduped = Array.from(seen.values());

  const chunkSize = 100;
  let inserted = 0;
  for (let i = 0; i < deduped.length; i += chunkSize) {
    const chunk = deduped.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('students')
      .upsert(chunk, { onConflict: 'enrollment_number' });
    if (error) throw error;
    inserted += chunk.length;
  }
  return inserted;
}

export async function deleteStudent(id: string) {
  await supabase.from('attendance').delete().eq('student_id', id);
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllStudents() {
  await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

export { supabase };
