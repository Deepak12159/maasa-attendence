import { supabase } from './supabase';
import { startOfDay, format } from 'date-fns';

export interface Student {
  id: string;
  name: string;
  roll_number: string;
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

export interface Settings {
  id: number;
  working_days: number[];
}

export async function fetchStudents() {
  const { data, error } = await supabase.from('students').select('*').order('roll_number', { ascending: true });
  if (error) throw error;
  return data as Student[];
}

export async function fetchAttendance(dateStr: string) {
  const { data, error } = await supabase.from('attendance').select('*').eq('date', dateStr);
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
      return { id: 1, working_days: [1, 2, 3, 4, 5, 6] } as Settings;
    }
    throw error;
  }
  return data as Settings;
}

export async function toggleAttendance(studentId: string, dateStr: string, currentStatus: string | null) {
  if (currentStatus === 'present') {
    // Delete the record to make it implicitly absent
    const { error } = await supabase.from('attendance').delete().match({ student_id: studentId, date: dateStr });
    if (error) throw error;
    return null;
  } else {
    // Upsert record to present
    const { data, error } = await supabase
      .from('attendance')
      .upsert({ student_id: studentId, date: dateStr, status: 'present' }, { onConflict: 'student_id,date' })
      .select()
      .single();
    if (error) throw error;
    return data as Attendance;
  }
}
export { supabase };
