"use client";

import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import {
  format,
  addDays,
  subDays,
  isToday,
  getDay,
} from "date-fns";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  XCircle,
  Download,
  Users,
  Calendar as CalendarViewIcon,
  Sparkles,
  Trophy,
  Loader2,
  FolderOpen,
  Folder,
  Layers,
  LogIn,
  ShieldCheck,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  fetchStudents,
  fetchAttendance,
  fetchHolidays,
  fetchSettings,
  toggleAttendance,
  batchMarkAttendance,
  Student,
} from "@/lib/api";
import { exportAttendanceToExcel, deriveYearFromEnrollment } from "@/lib/excel";
import { ExcelImportDialog } from "@/components/excel-import-dialog";
import { AddStudentDialog } from "@/components/add-student-dialog";
import { ExcelAttendanceDialog } from "@/components/excel-attendance-dialog";
import { toast } from "sonner";

export default function AttendancePage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = format(date, "yyyy-MM-dd");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Accordion state
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({
    "1st Year": true,
  });
  const [expandedPrograms, setExpandedPrograms] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Fetch data
  const { data: students = [], mutate: mutateStudents, isLoading: loadingStudents } = useSWR('students', fetchStudents);
  const { data: attendance = [], mutate: mutateAttendance, isLoading: loadingAttendance } = useSWR(
    ['attendance', dateStr],
    () => fetchAttendance(dateStr)
  );
  const { data: holidays = [] } = useSWR('holidays', fetchHolidays);
  const { data: settings } = useSWR('settings', fetchSettings);

  const isLoading = loadingStudents || loadingAttendance;

  // Working day / Holiday check
  const currentHoliday = holidays.find((h) => h.date === dateStr);
  const dayOfWeek = getDay(date) === 0 ? 7 : getDay(date);
  const isWorkingDay = settings?.working_days.includes(dayOfWeek) ?? true;
  const isOffDay = Boolean(currentHoliday || !isWorkingDay);

  // Fast lookup map for attendance: { student_id -> status }
  const attendanceMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const record of attendance) {
      map[record.student_id] = record.status;
    }
    return map;
  }, [attendance]);

  // Overall statistics
  const totalStudentsCount = students.length;
  const presentStudentsCount = useMemo(() => {
    return students.filter((st) => attendanceMap[st.id] === 'present').length;
  }, [students, attendanceMap]);
  const absentStudentsCount = totalStudentsCount - presentStudentsCount;
  const attendancePercent = totalStudentsCount > 0 ? Math.round((presentStudentsCount / totalStudentsCount) * 100) : 0;

  // Toggle single student attendance
  const handleToggle = async (studentId: string, currentStatus: string | null) => {
    if (!user) {
      toast.error("Please login as Sir to mark attendance");
      return;
    }

    const isPresent = currentStatus === 'present';
    const optimisticData = [...attendance];
    const existingIndex = optimisticData.findIndex((a) => a.student_id === studentId);

    if (isPresent) {
      if (existingIndex > -1) optimisticData.splice(existingIndex, 1);
    } else {
      if (existingIndex > -1) {
        optimisticData[existingIndex].status = 'present';
      } else {
        optimisticData.push({ id: 'temp-' + Date.now(), student_id: studentId, date: dateStr, status: 'present' });
      }
    }

    mutateAttendance(optimisticData, false);

    try {
      await toggleAttendance(studentId, dateStr, currentStatus);
      mutateAttendance();
      toast.success(isPresent ? "Marked Absent" : "Marked Present");
    } catch {
      toast.error("Failed to update attendance");
      mutateAttendance();
    }
  };

  // Batch mark section attendance
  const handleBatchMark = async (studentIds: string[], status: 'present' | 'absent', sectionName: string) => {
    if (!user) {
      toast.error("Please login as Sir to take attendance");
      return;
    }
    if (studentIds.length === 0) return;

    // Optimistic update
    const optimisticData = attendance.filter((a) => !studentIds.includes(a.student_id));
    if (status === 'present') {
      for (const id of studentIds) {
        optimisticData.push({ id: 'temp-' + id, student_id: id, date: dateStr, status: 'present' });
      }
    }
    mutateAttendance(optimisticData, false);

    try {
      await batchMarkAttendance(studentIds, dateStr, status);
      mutateAttendance();
      toast.success(
        status === 'present'
          ? `All students in ${sectionName} marked PRESENT!`
          : `All students in ${sectionName} marked ABSENT!`
      );
    } catch {
      toast.error("Batch update failed");
      mutateAttendance();
    }
  };

  // Toggle Year accordion
  const toggleYear = (year: string) => {
    setExpandedYears((prev) => ({ ...prev, [year]: !prev[year] }));
  };

  // Toggle Program accordion
  const toggleProgram = (progKey: string) => {
    setExpandedPrograms((prev) => ({ ...prev, [progKey]: !prev[progKey] }));
  };

  // Toggle Section accordion
  const toggleSection = (secKey: string) => {
    setExpandedSections((prev) => ({ ...prev, [secKey]: !prev[secKey] }));
  };

  // Expand All / Collapse All
  const expandAll = () => {
    const allYears: Record<string, boolean> = {};
    const allProgs: Record<string, boolean> = {};
    const allSecs: Record<string, boolean> = {};

    groupedData.forEach((yearGroup) => {
      allYears[yearGroup.year] = true;
      yearGroup.programs.forEach((progGroup) => {
        const progKey = `${yearGroup.year}__${progGroup.program}`;
        allProgs[progKey] = true;
        progGroup.sections.forEach((secGroup) => {
          const secKey = `${progKey}__${secGroup.section}`;
          allSecs[secKey] = true;
        });
      });
    });

    setExpandedYears(allYears);
    setExpandedPrograms(allProgs);
    setExpandedSections(allSecs);
  };

  const collapseAll = () => {
    setExpandedYears({});
    setExpandedPrograms({});
    setExpandedSections({});
  };

  // Structure 2 grouping: Year -> Program/Branch -> Section -> Students
  const groupedData = useMemo(() => {
    const yearOrder = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

    // Normalized student structure
    const processed = students.map((st) => {
      const year = st.year || deriveYearFromEnrollment(st.enrollment_number || st.roll_number || '');
      const program = st.program || 'B.Tech Computer Science and Engineering';
      const section = st.section || 'Section A';
      return { ...st, calculatedYear: year, calculatedProgram: program, calculatedSection: section };
    });

    // Group by Year
    const yearMap: Record<string, Record<string, Record<string, typeof processed>>> = {};

    for (const st of processed) {
      const yr = st.calculatedYear;
      const prog = st.calculatedProgram;
      const sec = st.calculatedSection;

      if (!yearMap[yr]) yearMap[yr] = {};
      if (!yearMap[yr][prog]) yearMap[yr][prog] = {};
      if (!yearMap[yr][prog][sec]) yearMap[yr][prog][sec] = [];

      yearMap[yr][prog][sec].push(st);
    }

    // Convert map to ordered nested arrays
    const sortedYears = Object.keys(yearMap).sort((a, b) => {
      const idxA = yearOrder.indexOf(a);
      const idxB = yearOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return sortedYears.map((yr) => {
      const progKeys = Object.keys(yearMap[yr]).sort();
      const programs = progKeys.map((prog) => {
        const secKeys = Object.keys(yearMap[yr][prog]).sort();
        const sections = secKeys.map((sec) => {
          const list = yearMap[yr][prog][sec];
          // sort students by scholar number or roll number or name
          list.sort((a, b) => {
            const numA = parseInt(a.scholar_number || a.roll_number || '0', 10);
            const numB = parseInt(b.scholar_number || b.roll_number || '0', 10);
            if (!isNaN(numA) && !isNaN(numB) && numA > 0 && numB > 0) {
              return numA - numB;
            }
            return (a.name || '').localeCompare(b.name || '');
          });

          return {
            section: sec,
            students: list,
          };
        });

        return {
          program: prog,
          sections,
        };
      });

      return {
        year: yr,
        programs,
      };
    });
  }, [students]);

  // Global search filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((st) => {
      const nameMatch = st.name?.toLowerCase().includes(q);
      const enrollMatch = st.enrollment_number?.toLowerCase().includes(q);
      const scholarMatch = st.scholar_number?.toLowerCase().includes(q);
      const rollMatch = st.roll_number?.toLowerCase().includes(q);
      return nameMatch || enrollMatch || scholarMatch || rollMatch;
    });
  }, [students, searchQuery]);

  // Export to Excel handler
  const handleExport = () => {
    if (students.length === 0) {
      toast.error("No students to export");
      return;
    }
    exportAttendanceToExcel(students, attendanceMap, dateStr);
    toast.success("Excel report downloaded!");
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Trophy className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                      Sports Club Attendance
                    </h1>
                    <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      MASA
                    </span>
                    {mounted && user && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Faculty Mode
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm mt-0.5">
                    Excel-Style Expand & Collapse Register for Sports Faculty
                  </p>
                </div>
              </div>
            </div>

            {/* Date Controls */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDate((d) => subDays(d, 1))}
                className="h-9 w-9 text-slate-600 hover:text-indigo-600 hover:bg-white"
                title="Previous Day"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className="bg-white text-slate-800 font-semibold px-4 h-9 shadow-sm border-slate-200 hover:border-indigo-300"
                      suppressHydrationWarning
                    />
                  }
                >
                  <CalendarIcon className="w-4 h-4 mr-2 text-indigo-600" />
                  <span suppressHydrationWarning>{format(date, "EEE, dd MMM yyyy")}</span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    fromDate={new Date(2026, 7, 15)}
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDate((d) => addDays(d, 1))}
                className="h-9 w-9 text-slate-600 hover:text-indigo-600 hover:bg-white"
                title="Next Day"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>

              {mounted && !isToday(date) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDate(new Date())}
                  className="h-9 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                >
                  Jump to Today
                </Button>
              )}
            </div>

            {/* Action Buttons: Only shown when logged in, plus Report Export */}
            <div className="flex flex-wrap items-center gap-2">
              {mounted && user && (
                <>
                  <ExcelAttendanceDialog
                    students={students}
                    attendanceMap={attendanceMap}
                    dateStr={dateStr}
                    onSuccess={() => mutateAttendance()}
                  />

                  <AddStudentDialog onSuccess={() => mutateStudents()} />

                  <ExcelImportDialog onSuccess={() => mutateStudents()} />
                </>
              )}

              <Button
                variant="outline"
                onClick={handleExport}
                className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm text-xs font-semibold"
                title="Download Attendance Report (.xlsx)"
              >
                <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
                Report (.xlsx)
              </Button>
            </div>
          </div>

          {/* Quick Statistics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
              <div className="text-xs font-medium text-slate-500">Total Registered</div>
              <div className="text-2xl font-bold text-slate-800 mt-0.5">{totalStudentsCount}</div>
            </div>

            <div className="bg-emerald-50/70 rounded-xl p-3.5 border border-emerald-100">
              <div className="text-xs font-medium text-emerald-700">Present Today</div>
              <div className="text-2xl font-bold text-emerald-700 mt-0.5">{presentStudentsCount}</div>
            </div>

            <div className="bg-rose-50/70 rounded-xl p-3.5 border border-rose-100">
              <div className="text-xs font-medium text-rose-700">Absent Today</div>
              <div className="text-2xl font-bold text-rose-700 mt-0.5">{absentStudentsCount}</div>
            </div>

            <div className="bg-indigo-50/70 rounded-xl p-3.5 border border-indigo-100">
              <div className="text-xs font-medium text-indigo-700">Attendance Rate</div>
              <div className="text-2xl font-bold text-indigo-700 mt-0.5">{attendancePercent}%</div>
            </div>
          </div>
        </div>

        {/* Global Live Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student by Name, Scholar No (e.g. 2401936), or Enrollment No (e.g. EN26CS...)..."
            className="w-full pl-11 pr-4 py-3.5 bg-white rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Expand / Collapse All Controls */}
        {!searchQuery && (
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-indigo-600" />
              Hierarchy: Year ➔ Branch ➔ Section ➔ Students
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={expandAll}
                className="text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-white"
              >
                <ChevronDown className="w-3.5 h-3.5 mr-1" />
                Expand All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={collapseAll}
                className="text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-white"
              >
                <ChevronUp className="w-3.5 h-3.5 mr-1" />
                Collapse All
              </Button>
            </div>
          </div>
        )}

        {/* Main Body */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-3" />
            <p className="text-slate-500 font-medium">Loading students register...</p>
          </div>
        ) : isOffDay && !searchQuery ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center mx-auto mb-3 shadow-sm">
              <CalendarViewIcon className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-amber-900">
              {currentHoliday ? currentHoliday.name : "Non-Working Day"}
            </h2>
            <p className="text-amber-700 text-sm mt-1">
              No regular sports activities scheduled for this date.
            </p>
          </div>
        ) : searchResults !== null ? (
          /* Instant Search Results View */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between">
              <div className="font-semibold text-indigo-950 text-sm">
                Found {searchResults.length} matching students for &quot;{searchQuery}&quot;
              </div>
            </div>

            {searchResults.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No students found matching your search. Try searching by scholar number or last name.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">#</th>
                      <th className="px-4 py-3">Scholar No</th>
                      <th className="px-4 py-3">Enrollment No</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Year & Program</th>
                      <th className="px-4 py-3">Section</th>
                      <th className="px-4 py-3 text-right">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {searchResults.map((st, idx) => {
                      const isPresent = attendanceMap[st.id] === 'present';
                      return (
                        <tr
                          key={st.id}
                          className={cn(
                            "hover:bg-slate-50/80 transition-colors",
                            isPresent && "bg-emerald-50/40"
                          )}
                        >
                          <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 font-mono">
                            {st.scholar_number || '-'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                            {st.enrollment_number || st.roll_number || '-'}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {st.name}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            <span className="font-semibold text-indigo-600">{st.year || '1st Year'}</span> - {st.program || 'B.Tech CSE'}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                            {st.section || 'Section A'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {user ? (
                              <button
                                onClick={() => handleToggle(st.id, isPresent ? 'present' : null)}
                                className={cn(
                                  "inline-flex items-center justify-center px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm",
                                  isPresent
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                                )}
                              >
                                {isPresent ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    PRESENT
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                    ABSENT
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-bold",
                                  isPresent
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                )}
                              >
                                {isPresent ? 'PRESENT' : 'ABSENT'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : students.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto space-y-4">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">No Students in Register</h2>
            <p className="text-slate-500 text-sm">
              {user
                ? "Click 'Import Excel' to upload your Club Registration Excel file."
                : "No attendance records available."}
            </p>
            {user && (
              <div className="pt-2">
                <ExcelImportDialog onSuccess={() => mutateStudents()} />
              </div>
            )}
          </div>
        ) : (
          /* Structure 2 Accordion View: Year ➔ Program ➔ Section ➔ Students */
          <div className="space-y-4">
            {groupedData.map((yearGroup) => {
              const isYearOpen = Boolean(expandedYears[yearGroup.year]);

              // Calculate year total and present
              let yearTotal = 0;
              let yearPresent = 0;
              yearGroup.programs.forEach((pg) => {
                pg.sections.forEach((sec) => {
                  yearTotal += sec.students.length;
                  sec.students.forEach((st) => {
                    if (attendanceMap[st.id] === 'present') yearPresent++;
                  });
                });
              });
              const yearPercent = yearTotal > 0 ? Math.round((yearPresent / yearTotal) * 100) : 0;

              return (
                <div
                  key={yearGroup.year}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all"
                >
                  {/* LEVEL 1: Year Header Card */}
                  <button
                    onClick={() => toggleYear(yearGroup.year)}
                    className="w-full flex items-center justify-between p-5 text-left bg-gradient-to-r from-slate-50 to-white hover:from-indigo-50/40 hover:to-white transition-colors border-b border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-indigo-600 text-white">
                        {isYearOpen ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                      </div>
                      <div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900">
                          {yearGroup.year}
                        </h2>
                        <span className="text-xs font-medium text-slate-500">
                          {yearGroup.programs.length} Branches • {yearTotal} Students Registered
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-xs font-semibold text-slate-700">
                          {yearPresent} / {yearTotal} Present
                        </span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${yearPercent}%` }}
                          />
                        </div>
                      </div>

                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">
                        {yearPercent}%
                      </span>

                      {isYearOpen ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* LEVEL 2: Programs inside Year */}
                  {isYearOpen && (
                    <div className="p-4 sm:p-6 space-y-4 bg-slate-50/50">
                      {yearGroup.programs.map((progGroup) => {
                        const progKey = `${yearGroup.year}__${progGroup.program}`;
                        const isProgOpen = Boolean(expandedPrograms[progKey]);

                        // Calculate program total and present
                        let progTotal = 0;
                        let progPresent = 0;
                        progGroup.sections.forEach((sec) => {
                          progTotal += sec.students.length;
                          sec.students.forEach((st) => {
                            if (attendanceMap[st.id] === 'present') progPresent++;
                          });
                        });
                        const progPercent = progTotal > 0 ? Math.round((progPresent / progTotal) * 100) : 0;

                        return (
                          <div
                            key={progKey}
                            className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs"
                          >
                            {/* Program Header */}
                            <button
                              onClick={() => toggleProgram(progKey)}
                              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                                <div>
                                  <h3 className="text-base font-bold text-slate-800">
                                    {progGroup.program}
                                  </h3>
                                  <span className="text-xs text-slate-500">
                                    {progGroup.sections.length} Section{progGroup.sections.length > 1 ? 's' : ''} • {progTotal} Students
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-slate-600">
                                  {progPresent} / {progTotal} Present
                                </span>
                                {isProgOpen ? (
                                  <ChevronUp className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                            </button>

                            {/* LEVEL 3: Sections inside Program */}
                            {isProgOpen && (
                              <div className="p-4 border-t border-slate-100 space-y-4 bg-slate-50/30">
                                {progGroup.sections.map((secGroup) => {
                                  const secKey = `${progKey}__${secGroup.section}`;
                                  const isSecOpen = expandedSections[secKey] !== false; // default open inside opened program

                                  const secTotal = secGroup.students.length;
                                  const secPresent = secGroup.students.filter(
                                    (st) => attendanceMap[st.id] === 'present'
                                  ).length;
                                  const secPercent = secTotal > 0 ? Math.round((secPresent / secTotal) * 100) : 0;
                                  const studentIds = secGroup.students.map((st) => st.id);

                                  return (
                                    <div
                                      key={secKey}
                                      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs"
                                    >
                                      {/* Section Header with Quick Batch Actions */}
                                      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <button
                                          onClick={() => toggleSection(secKey)}
                                          className="flex items-center gap-2 text-left"
                                        >
                                          <span className="font-bold text-slate-900 text-sm">
                                            {secGroup.section}
                                          </span>
                                          <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md">
                                            {secPresent}/{secTotal} Present ({secPercent}%)
                                          </span>
                                          {isSecOpen ? (
                                            <ChevronUp className="w-4 h-4 text-slate-400" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                          )}
                                        </button>

                                        {/* 1-Click Fast Batch Buttons for Sir */}
                                        {user && (
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              onClick={() =>
                                                handleBatchMark(
                                                  studentIds,
                                                  'present',
                                                  `${progGroup.program} - ${secGroup.section}`
                                                )
                                              }
                                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs h-7 px-2.5"
                                            >
                                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                              Mark All Present
                                            </Button>

                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                handleBatchMark(
                                                  studentIds,
                                                  'absent',
                                                  `${progGroup.program} - ${secGroup.section}`
                                                )
                                              }
                                              className="text-slate-600 hover:text-rose-600 hover:bg-rose-50 border-slate-200 text-xs font-medium h-7 px-2.5"
                                            >
                                              <XCircle className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                              Mark All Absent
                                            </Button>
                                          </div>
                                        )}
                                      </div>

                                      {/* LEVEL 4: Excel Spreadsheet Student Table */}
                                      {isSecOpen && (
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                                              <tr>
                                                <th className="px-3 py-2.5 w-10 text-center">#</th>
                                                <th className="px-3 py-2.5">Scholar No</th>
                                                <th className="px-3 py-2.5">Enrollment No</th>
                                                <th className="px-3 py-2.5">Student Name</th>
                                                <th className="px-3 py-2.5">Mobile</th>
                                                <th className="px-3 py-2.5 text-right w-36">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                              {secGroup.students.map((st, sIdx) => {
                                                const isPresent = attendanceMap[st.id] === 'present';
                                                return (
                                                  <tr
                                                    key={st.id}
                                                    onClick={() => {
                                                      if (user) {
                                                        handleToggle(st.id, isPresent ? 'present' : null);
                                                      }
                                                    }}
                                                    className={cn(
                                                      user ? "cursor-pointer hover:bg-slate-50/80" : "cursor-default",
                                                      "transition-colors select-none",
                                                      isPresent && "bg-emerald-50/40"
                                                    )}
                                                  >
                                                    <td className="px-3 py-2.5 text-center text-slate-400 font-mono text-xs">
                                                      {sIdx + 1}
                                                    </td>
                                                    <td className="px-3 py-2.5 font-bold text-slate-900 font-mono text-xs">
                                                      {st.scholar_number || '-'}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-slate-600 font-mono text-xs">
                                                      {st.enrollment_number || st.roll_number || '-'}
                                                    </td>
                                                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                                                      {st.name}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs text-slate-500 font-mono">
                                                      {st.mobile_number || '-'}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                      <span
                                                        className={cn(
                                                          "inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-bold transition-all shadow-2xs",
                                                          isPresent
                                                            ? "bg-emerald-600 text-white"
                                                            : "bg-slate-100 text-slate-500 border border-slate-200"
                                                        )}
                                                      >
                                                        {isPresent ? (
                                                          <>
                                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                                            PRESENT
                                                          </>
                                                        ) : (
                                                          <>
                                                            <XCircle className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                                            ABSENT
                                                          </>
                                                        )}
                                                      </span>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
