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
  UserPlus,
  Settings,
  FileSpreadsheet,
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
  fetchAllAttendance,
  fetchHolidays,
  fetchSettings,
  toggleAttendance,
  batchMarkAttendance,
  Student,
} from "@/lib/api";
import { exportAttendanceToExcel, deriveYearFromEnrollment, exportSingleSectionToExcel } from "@/lib/excel";
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

  // Export single section
  const handleExportSection = async (sectionStudents: Student[], sectionName: string) => {
    if (sectionStudents.length === 0) {
      toast.error("No students in this section");
      return;
    }
    const toastId = toast.loading(`Generating Excel for ${sectionName}...`);
    try {
      const allAttendance = await fetchAllAttendance();
      exportSingleSectionToExcel(sectionStudents, allAttendance, sectionName);
      toast.success(`${sectionName} report downloaded!`, { id: toastId });
    } catch (e) {
      toast.error(`Failed to export ${sectionName}`, { id: toastId });
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
  const handleExport = async () => {
    if (students.length === 0) {
      toast.error("No students to export");
      return;
    }
    const toastId = toast.loading("Generating Excel...");
    try {
      const allAttendance = await fetchAllAttendance();
      exportAttendanceToExcel(students, allAttendance, settings?.organization_structure || []);
      toast.success("Excel report downloaded!", { id: toastId });
    } catch (e) {
      toast.error("Failed to export attendance", { id: toastId });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 animate-fade-in-up">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Premium Header & Stats Dashboard */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-premium">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
            {/* Title Section */}
            <div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl shadow-md">
                  <Trophy className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                      Sports Club
                    </h1>
                    <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100">
                      MAASA
                    </span>
                    {mounted && user && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <ShieldCheck className="w-4 h-4" />
                        Faculty
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm mt-1.5 font-medium">
                    Attendance Dashboard & Register
                  </p>
                </div>
              </div>
            </div>

            {/* Premium Action Toolbar */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200/60 backdrop-blur-sm">
              {/* Date Controls */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDate((d) => subDays(d, 1))}
                  className="h-9 w-9 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="ghost"
                        className="text-slate-700 font-bold px-4 h-9 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                        suppressHydrationWarning
                      />
                    }
                  >
                    <CalendarIcon className="w-4 h-4 mr-2 text-indigo-600" />
                    <span suppressHydrationWarning>{format(date, "MMM dd, yyyy")}</span>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-premium" align="center">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      disabled={{ before: new Date(2026, 7, 15) }}
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDate((d) => addDays(d, 1))}
                  className="h-9 w-9 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                  title="Next Day"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {mounted && !isToday(date) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDate(new Date())}
                  className="h-11 px-4 text-xs font-bold bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors rounded-xl"
                >
                  Today
                </Button>
              )}

              <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block"></div>

              {/* Action Buttons */}
              {mounted && user && (
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="h-11 bg-white border-slate-200 hover:bg-slate-50 hover:border-indigo-300 text-slate-700 shadow-sm rounded-xl transition-all active:scale-95">
                        <Settings className="w-4 h-4 mr-2 text-indigo-600" />
                        Admin Actions
                        <ChevronDown className="w-4 h-4 ml-2 text-slate-400" />
                      </Button>
                    }
                  />
                  <PopoverContent className="w-56 p-2 rounded-2xl shadow-premium border-slate-100 flex flex-col gap-1" align="end">
                    <div className="px-3 py-2 mb-1 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Manage Register</span>
                    </div>
                    <ExcelAttendanceDialog
                      students={students}
                      attendanceMap={attendanceMap}
                      dateStr={dateStr}
                      onSuccess={() => mutateAttendance()}
                      triggerButton={
                        <Button variant="ghost" className="w-full justify-start h-10 px-3 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium rounded-xl transition-colors">
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Mark via Excel
                        </Button>
                      }
                    />

                    <AddStudentDialog 
                      onSuccess={() => mutateStudents()} 
                      triggerButton={
                        <Button variant="ghost" className="w-full justify-start h-10 px-3 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium rounded-xl transition-colors">
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add Student
                        </Button>
                      }
                    />

                    <ExcelImportDialog 
                      onSuccess={() => mutateStudents()} 
                      triggerButton={
                        <Button variant="ghost" className="w-full justify-start h-10 px-3 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium rounded-xl transition-colors">
                          <Download className="w-4 h-4 mr-2" />
                          Import Data
                        </Button>
                      }
                    />
                  </PopoverContent>
                </Popover>
              )}

              <Button
                onClick={handleExport}
                className="h-11 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md rounded-xl font-bold transition-all active:scale-95 border-0"
                title="Download Attendance Report (.xlsx)"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Premium Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-5 border border-slate-200/60 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-slate-200/40 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-sm font-semibold text-slate-600">Total Enrolled</span>
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-3xl font-black text-slate-800 relative z-10">{totalStudentsCount}</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-5 border border-emerald-200/60 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-200/40 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-sm font-semibold text-emerald-800">Present</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-3xl font-black text-emerald-700 relative z-10">{presentStudentsCount}</div>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-2xl p-5 border border-rose-200/60 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-200/40 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-sm font-semibold text-rose-800">Absent</span>
                <XCircle className="w-5 h-5 text-rose-500" />
              </div>
              <div className="text-3xl font-black text-rose-700 relative z-10">{absentStudentsCount}</div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-2xl p-5 border border-indigo-200/60 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-200/40 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-sm font-semibold text-indigo-800">Rate</span>
                <Sparkles className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-3xl font-black text-indigo-700 relative z-10">{attendancePercent}%</div>
            </div>
          </div>
        </div>

        {/* Search & Hierarchy Controls Container */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Premium Live Search Bar */}
          <div className="relative w-full md:w-1/2 lg:w-1/3 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name, Scholar No..."
              className="w-full pl-12 pr-12 py-3.5 bg-white rounded-2xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Expand / Collapse All Controls */}
          {!searchQuery && (
            <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto overflow-x-auto">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                <Layers className="w-4 h-4 text-indigo-500" />
                Year <span className="text-slate-300">➔</span> Branch <span className="text-slate-300">➔</span> Sec
              </div>
              <div className="w-px h-6 bg-slate-200"></div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={expandAll}
                  className="text-xs font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl"
                >
                  <ChevronDown className="w-4 h-4 mr-1.5" />
                  Expand
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={collapseAll}
                  className="text-xs font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl"
                >
                  <ChevronUp className="w-4 h-4 mr-1.5" />
                  Collapse
                </Button>
              </div>
            </div>
          )}
        </div>

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
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-premium overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-indigo-50/80 to-white border-b border-indigo-100/50 flex items-center justify-between">
              <div className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-500" />
                Found {searchResults.length} matching student{searchResults.length === 1 ? '' : 's'} for &quot;{searchQuery}&quot;
              </div>
            </div>

            {searchResults.length === 0 ? (
              <div className="p-16 text-center text-slate-500 flex flex-col items-center">
                <Search className="w-12 h-12 text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-700 mb-1">No matches found</h3>
                <p className="text-sm">Try searching by a different name, scholar number, or enrollment number.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-4 w-12 text-center">#</th>
                      <th className="px-5 py-4">Scholar No</th>
                      <th className="px-5 py-4">Enrollment No</th>
                      <th className="px-5 py-4">Student Name</th>
                      <th className="px-5 py-4">Year & Program</th>
                      <th className="px-5 py-4">Section</th>
                      <th className="px-5 py-4 text-right">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {searchResults.map((st, idx) => {
                      const isPresent = attendanceMap[st.id] === 'present';
                      return (
                        <tr
                          key={st.id}
                          className={cn(
                            "hover:bg-slate-50/80 transition-colors group",
                            isPresent && "bg-emerald-50/30 hover:bg-emerald-50/60"
                          )}
                        >
                          <td className="px-5 py-4 text-center text-slate-400 font-mono text-xs">
                            {idx + 1}
                          </td>
                          <td className="px-5 py-4 font-bold text-slate-900 font-mono text-sm">
                            {st.scholar_number || '-'}
                          </td>
                          <td className="px-5 py-4 text-slate-500 font-mono text-xs">
                            {st.enrollment_number || st.roll_number || '-'}
                          </td>
                          <td className="px-5 py-4 font-bold text-slate-800">
                            {st.name}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-600">
                            <span className="font-bold text-indigo-600">{st.year || '1st Year'}</span> <span className="text-slate-300 mx-1">•</span> {st.program || 'B.Tech CSE'}
                          </td>
                          <td className="px-5 py-4 text-xs font-bold text-slate-700">
                            {st.section || 'Section A'}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {user ? (
                              <button
                                onClick={() => handleToggle(st.id, isPresent ? 'present' : null)}
                                className={cn(
                                  "inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-black transition-all",
                                  isPresent
                                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600 active:scale-95"
                                    : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-sm active:scale-95"
                                )}
                              >
                                {isPresent ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                    PRESENT
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-4 h-4 mr-1.5 text-slate-400" />
                                    ABSENT
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-black transition-all",
                                  isPresent
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
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
                    className="w-full flex items-center justify-between p-5 text-left bg-gradient-to-r from-slate-50 to-white hover:from-indigo-50/40 hover:to-white transition-colors border-b border-slate-100 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md group-hover:scale-105 transition-transform">
                        {isYearOpen ? <FolderOpen className="w-6 h-6" /> : <Folder className="w-6 h-6" />}
                      </div>
                      <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                          {yearGroup.year}
                        </h2>
                        <span className="text-sm font-semibold text-slate-500">
                          {yearGroup.programs.length} Branches <span className="mx-1 text-slate-300">•</span> {yearTotal} Students
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Attendance
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-800">
                            {yearPresent} <span className="text-slate-400">/ {yearTotal}</span>
                          </span>
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                              style={{ width: `${yearPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <span className="bg-emerald-100/80 text-emerald-800 text-sm font-black px-3 py-1.5 rounded-xl border border-emerald-200">
                        {yearPercent}%
                      </span>

                      <div className="p-2 bg-slate-50 rounded-full group-hover:bg-indigo-50 transition-colors">
                        {isYearOpen ? (
                          <ChevronUp className="w-5 h-5 text-slate-500 group-hover:text-indigo-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500 group-hover:text-indigo-600" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* LEVEL 2: Programs inside Year */}
                  {isYearOpen && (
                    <div className="p-2 sm:p-4 space-y-3 bg-slate-50/30">
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
                              className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/80 transition-colors group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                <div>
                                  <h3 className="text-lg font-bold text-slate-800">
                                    {progGroup.program}
                                  </h3>
                                  <span className="text-xs font-semibold text-slate-500">
                                    {progGroup.sections.length} Section{progGroup.sections.length > 1 ? 's' : ''} <span className="mx-1 text-slate-300">•</span> {progTotal} Students
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg">
                                  {progPresent} / {progTotal} Present
                                </span>
                                <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                                  {isProgOpen ? (
                                    <ChevronUp className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" />
                                  )}
                                </div>
                              </div>
                            </button>

                            {/* LEVEL 3: Sections inside Program */}
                            {isProgOpen && (
                              <div className="p-2 sm:p-3 border-t border-slate-100 space-y-3 bg-white">
                                {progGroup.sections.map((secGroup) => {
                                  const secKey = `${progKey}__${secGroup.section}`;
                                  const isSecOpen = expandedSections[secKey] !== false; // default open inside opened program

                                  const secTotal = secGroup.students.length;
                                  const secPresent = secGroup.students.filter(
                                    (st) => attendanceMap[st.id] === 'present'
                                  ).length;
                                  const secPercent = secTotal > 0 ? Math.round((secPresent / secTotal) * 100) : 0;
                                  const studentIds = secGroup.students.map((st) => st.id);

                                  const orgYear = settings?.organization_structure?.find(y => y.name === yearGroup.year);
                                  const orgBranch = orgYear?.branches?.find(b => b.name === progGroup.program);
                                  const orgSection = orgBranch?.sections?.find(s => s.name === secGroup.section);

                                  const isScheduledToday = orgSection?.attendanceDays ? orgSection.attendanceDays.includes(dayOfWeek) : true;
                                  const scheduleText = orgSection?.startTime && orgSection?.endTime ? `${orgSection.startTime} - ${orgSection.endTime}` : '';

                                  return (
                                    <div
                                      key={secKey}
                                      className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden"
                                    >
                                      {/* Section Header with Quick Batch Actions */}
                                      <button
                                        onClick={() => toggleSection(secKey)}
                                        className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-white hover:bg-slate-50 transition-colors border-b border-slate-100 group text-left gap-3"
                                      >
                                        <div className="flex items-center gap-3 flex-wrap">
                                          <div className={`w-2 h-2 rounded-full ${isScheduledToday ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-300'}`} />
                                          <span className="font-bold text-slate-800 text-sm sm:text-base">
                                            Section {secGroup.section}
                                          </span>
                                          <span className="text-xs bg-slate-50 border border-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-md shadow-sm">
                                            {secPresent}/{secTotal} <span className="text-slate-300 mx-1">|</span> {secPercent}%
                                          </span>
                                          {scheduleText && (
                                            <span className="text-[10px] font-bold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">
                                              {scheduleText}
                                            </span>
                                          )}
                                          {!isScheduledToday && (
                                            <span className="text-[10px] font-bold tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded uppercase">
                                              Off Today
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                          {/* Section Export Button */}
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleExportSection(
                                                secGroup.students, 
                                                `${yearGroup.year.replace('Year', '').trim()}_${progGroup.program}_Sec${secGroup.section}`
                                              );
                                            }}
                                            className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            title="Download Section Report"
                                          >
                                            <Download className="w-4 h-4" />
                                          </Button>

                                          {/* 1-Click Fast Batch Buttons for Sir */}
                                          {user && (
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                              <Button
                                                size="sm"
                                                disabled={!isScheduledToday}
                                                onClick={() =>
                                                  handleBatchMark(
                                                    studentIds,
                                                    'present',
                                                    `${progGroup.program} - ${secGroup.section}`
                                                  )
                                                }
                                                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:opacity-50 text-white text-xs font-bold shadow-sm h-8 px-3 rounded-lg transition-all active:scale-95"
                                              >
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                                Present All
                                              </Button>

                                              <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!isScheduledToday}
                                                onClick={() =>
                                                  handleBatchMark(
                                                    studentIds,
                                                    'absent',
                                                    `${progGroup.program} - ${secGroup.section}`
                                                  )
                                                }
                                                className="text-rose-600 hover:text-white hover:bg-rose-500 disabled:text-slate-400 disabled:border-slate-200 disabled:bg-slate-50 border-rose-200 text-xs font-bold h-8 px-3 rounded-lg transition-all active:scale-95 bg-rose-50"
                                              >
                                                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                                                Absent All
                                              </Button>
                                            </div>
                                          )}

                                          <div className="p-1 bg-white rounded shadow-sm border border-slate-200 group-hover:border-indigo-300 transition-colors">
                                            {isSecOpen ? (
                                              <ChevronUp className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" />
                                            ) : (
                                              <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" />
                                            )}
                                          </div>
                                        </div>
                                      </button>

                                      {/* LEVEL 4: Excel Spreadsheet Student Table */}
                                      {isSecOpen && (
                                        <div className="overflow-x-auto w-full">
                                          <table className="w-full text-left text-sm min-w-[300px]">
                                            <thead className="bg-slate-100/50 border-b border-slate-100 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider">
                                              <tr>
                                                <th className="px-3 sm:px-4 py-2.5 w-10 sm:w-12 text-center">#</th>
                                                <th className="px-3 sm:px-4 py-2.5">Student Details</th>
                                                <th className="px-3 sm:px-4 py-2.5 text-right w-24 sm:w-32">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100/50">
                                              {secGroup.students.map((st, sIdx) => {
                                                const isPresent = attendanceMap[st.id] === 'present';
                                                return (
                                                  <tr
                                                    key={st.id}
                                                    onClick={() => {
                                                      if (user && isScheduledToday) {
                                                        handleToggle(st.id, isPresent ? 'present' : null);
                                                      }
                                                    }}
                                                    className={cn(
                                                      "group transition-colors",
                                                      !isScheduledToday 
                                                        ? "opacity-60 cursor-not-allowed bg-slate-50/30" 
                                                        : (user ? "cursor-pointer" : ""),
                                                      isScheduledToday && isPresent ? "bg-emerald-50/50 hover:bg-emerald-50" : "",
                                                      isScheduledToday && !isPresent ? "hover:bg-slate-50/80" : ""
                                                    )}
                                                  >
                                                    <td className="px-3 sm:px-4 py-3 sm:py-4 text-center text-slate-400 font-mono text-[10px] sm:text-xs font-medium">
                                                      {sIdx + 1}
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                                                      <div className="font-bold text-slate-900 text-sm sm:text-base mb-0.5">
                                                        {st.name}
                                                      </div>
                                                      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-500 font-mono">
                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-600 border border-slate-200">
                                                          {st.scholar_number || '-'}
                                                        </span>
                                                        <span className="text-slate-400">
                                                          {st.enrollment_number || st.roll_number || '-'}
                                                        </span>
                                                      </div>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 sm:py-4 text-right">
                                                      {user ? (
                                                        <button
                                                          disabled={!isScheduledToday}
                                                          className={cn(
                                                            "inline-flex items-center justify-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all",
                                                            !isScheduledToday 
                                                              ? "bg-slate-100 text-slate-400 border border-slate-200" 
                                                              : isPresent
                                                                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 group-hover:bg-emerald-600"
                                                                : "bg-white text-slate-500 border border-slate-200 group-hover:border-indigo-300 group-hover:text-indigo-600 shadow-sm"
                                                          )}
                                                        >
                                                          {isPresent ? (
                                                            <>
                                                              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1.5" />
                                                              <span className="hidden sm:inline">PRESENT</span>
                                                            </>
                                                          ) : (
                                                            <>
                                                              <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1.5 rounded-full border-2 border-current opacity-50" />
                                                              <span className="hidden sm:inline">MARK</span>
                                                            </>
                                                          )}
                                                        </button>
                                                      ) : (
                                                        <span
                                                          className={cn(
                                                            "inline-flex items-center justify-center px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black tracking-wide transition-all",
                                                            isPresent
                                                              ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                                                              : "bg-white text-slate-500 border border-slate-200"
                                                          )}
                                                        >
                                                          {isPresent ? (
                                                            <>
                                                              <CheckCircle2 className="w-3.5 h-3.5 sm:mr-1" />
                                                              <span className="hidden sm:inline">PRESENT</span>
                                                            </>
                                                          ) : (
                                                            <>
                                                              <XCircle className="w-3.5 h-3.5 sm:mr-1 text-slate-400" />
                                                              <span className="hidden sm:inline">ABSENT</span>
                                                            </>
                                                          )}
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
