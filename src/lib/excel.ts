import * as XLSX from 'xlsx';
import { Student } from './api';

export function deriveYearFromEnrollment(enrollment: string): string {
  if (!enrollment) return '1st Year';
  const clean = enrollment.trim().toUpperCase();
  const match = clean.match(/^[A-Z]{2}(\d{2})/);
  if (match) {
    const code = match[1];
    switch (code) {
      case '26':
        return '1st Year';
      case '25':
        return '2nd Year';
      case '24':
        return '3rd Year';
      case '23':
        return '4th Year';
      default:
        return `Batch 20${code}`;
    }
  }
  return '1st Year';
}

export function parseExcelFile(fileData: ArrayBuffer): Partial<Student>[] {
  const workbook = XLSX.read(fileData, { type: 'array' });
  
  // Choose sheet: prefer 'SPORTS CLUB', otherwise sheet with most rows or active sheet
  let sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes('SPORTS'));
  if (!sheetName) {
    sheetName = workbook.SheetNames.find(s => !s.toLowerCase().includes('summary')) || workbook.SheetNames[0];
  }
  
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  // Map each row to Student
  const parsedList: Partial<Student>[] = [];

  for (const row of jsonData) {
    // Find column keys flexibly (case-insensitive & partial match)
    const findVal = (keys: string[]) => {
      for (const k of Object.keys(row)) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const target of keys) {
          if (cleanK.includes(target)) {
            return String(row[k]).trim();
          }
        }
      }
      return '';
    };

    const name = findVal(['studentname', 'name']);
    const enrollment = findVal(['enrollmentnumber', 'enrollmentno', 'enrollment']);
    const scholar = findVal(['scholarnumber', 'scholarno', 'scholar']);
    const program = findVal(['program', 'branch', 'course']) || 'B.Tech CSE';
    const mobile = findVal(['mobilenumber', 'mobile', 'phone']);
    const club = findVal(['clubname', 'club']) || 'SPORTS CLUB';
    const receipt = findVal(['receiptnumber', 'receiptno']);
    const regDate = findVal(['registrationdate', 'regdate', 'date']);
    const explicitSection = findVal(['section', 'sec']);

    if (!name && !enrollment && !scholar) continue;

    const year = deriveYearFromEnrollment(enrollment);

    parsedList.push({
      name: name || 'Student',
      enrollment_number: enrollment || scholar || '',
      roll_number: scholar || enrollment || '',
      scholar_number: scholar || '',
      program: program,
      club_name: club,
      mobile_number: mobile,
      year: year,
      section: explicitSection || '', // will auto-assign if empty
      receipt_number: receipt,
      registration_date: regDate,
    });
  }

  // Auto-assign sections (batches of 60) per Year & Program if section is not explicitly given
  const groups: Record<string, Partial<Student>[]> = {};
  for (const st of parsedList) {
    const key = `${st.year}__${st.program}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(st);
  }

  for (const key in groups) {
    const studentsInGroup = groups[key];
    studentsInGroup.forEach((st, idx) => {
      if (!st.section) {
        // Assign A, B, C, D... for every 60 students
        const sectionIndex = Math.floor(idx / 60);
        const sectionLetter = String.fromCharCode(65 + sectionIndex); // 0 -> 'A', 1 -> 'B', etc.
        st.section = `Section ${sectionLetter}`;
      }
    });
  }

  return parsedList;
}

export function exportAttendanceToExcel(
  students: Student[],
  attendanceMap: Record<string, string>,
  dateStr: string
) {
  const rows = students.map((st, index) => {
    const isPresent = attendanceMap[st.id] === 'present';
    return {
      'S.No': index + 1,
      'Date': dateStr,
      'Scholar No': st.scholar_number || '',
      'Enrollment No': st.enrollment_number || st.roll_number || '',
      'Student Name': st.name,
      'Year': st.year || '',
      'Program': st.program || '',
      'Section': st.section || 'Section A',
      'Status': isPresent ? 'PRESENT' : 'ABSENT',
      'Mobile': st.mobile_number || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
  
  // Download file
  XLSX.writeFile(wb, `Sports_Club_Attendance_${dateStr}.xlsx`);
}

export function downloadAttendanceTemplate(students: Student[], dateStr: string) {
  const rows = students.map((st, index) => ({
    'S.No': index + 1,
    'Scholar No': st.scholar_number || '',
    'Enrollment No': st.enrollment_number || st.roll_number || '',
    'Student Name': st.name,
    'Year': st.year || '',
    'Program': st.program || '',
    'Section': st.section || 'Section A',
    'Attendance (P/A)': 'P', // Defaults to 'P' for convenience, Sir can change to 'A'
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mark Attendance');
  XLSX.writeFile(wb, `Attendance_Template_${dateStr}.xlsx`);
}

export function parseAttendanceImportExcel(
  fileData: ArrayBuffer,
  students: Student[]
): { presentIds: string[]; absentIds: string[]; totalProcessed: number } {
  const workbook = XLSX.read(fileData, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  const presentIds: string[] = [];
  const absentIds: string[] = [];

  // Build lookup index for existing students
  const scholarMap = new Map<string, string>();
  const enrollMap = new Map<string, string>();
  const nameMap = new Map<string, string>();

  students.forEach((s) => {
    if (s.scholar_number) scholarMap.set(s.scholar_number.trim().toLowerCase(), s.id);
    if (s.enrollment_number) enrollMap.set(s.enrollment_number.trim().toLowerCase(), s.id);
    if (s.roll_number) enrollMap.set(s.roll_number.trim().toLowerCase(), s.id);
    if (s.name) nameMap.set(s.name.trim().toLowerCase(), s.id);
  });

  for (const row of rows) {
    let scholar = '';
    let enroll = '';
    let name = '';
    let statusVal = '';

    for (const [k, v] of Object.entries(row)) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      const strVal = String(v).trim();
      if (cleanK.includes('scholar')) scholar = strVal;
      else if (cleanK.includes('enroll')) enroll = strVal;
      else if (cleanK.includes('name')) name = strVal;
      else if (
        cleanK.includes('attendance') ||
        cleanK.includes('status') ||
        cleanK.includes('present') ||
        cleanK === 'pa'
      ) {
        statusVal = strVal;
      }
    }

    // Match student ID
    let studentId =
      (scholar && scholarMap.get(scholar.toLowerCase())) ||
      (enroll && enrollMap.get(enroll.toLowerCase())) ||
      (name && nameMap.get(name.toLowerCase()));

    if (studentId) {
      const cleanStatus = statusVal.toUpperCase();
      if (
        cleanStatus.startsWith('P') ||
        cleanStatus === '1' ||
        cleanStatus === 'YES' ||
        cleanStatus === 'TRUE' ||
        cleanStatus === '' // default to present if blank
      ) {
        presentIds.push(studentId);
      } else {
        absentIds.push(studentId);
      }
    }
  }

  return {
    presentIds,
    absentIds,
    totalProcessed: presentIds.length + absentIds.length,
  };
}
