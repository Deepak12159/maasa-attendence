"use client";

import { useState } from "react";
import useSWR from "swr";
import { format, getDay } from "date-fns";
import { CalendarIcon, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fetchStudents, fetchAttendance, fetchHolidays, fetchSettings, toggleAttendance } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";

export default function AttendancePage() {
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = format(date, "yyyy-MM-dd");
  const { user } = useAuth();

  const { data: students, isLoading: loadingStudents } = useSWR('students', fetchStudents);
  const { data: attendance, mutate: mutateAttendance, isLoading: loadingAttendance } = useSWR(['attendance', dateStr], () => fetchAttendance(dateStr));
  const { data: holidays, isLoading: loadingHolidays } = useSWR('holidays', fetchHolidays);
  const { data: settings, isLoading: loadingSettings } = useSWR('settings', fetchSettings);

  const isLoading = loadingStudents || loadingAttendance || loadingHolidays || loadingSettings;

  const currentHoliday = holidays?.find(h => h.date === dateStr);
  const dayOfWeek = getDay(date) === 0 ? 7 : getDay(date); // Convert 0(Sun) to 7
  const isWorkingDay = settings?.working_days.includes(dayOfWeek) ?? true;
  
  const isOffDay = currentHoliday || !isWorkingDay;

  const handleToggle = async (studentId: string, currentStatus: string | null) => {
    try {
      const optimisticData = attendance ? [...attendance] : [];
      const existingIndex = optimisticData.findIndex(a => a.student_id === studentId);
      
      if (currentStatus === 'present') {
        if (existingIndex > -1) optimisticData.splice(existingIndex, 1);
      } else {
        if (existingIndex > -1) {
          optimisticData[existingIndex].status = 'present';
        } else {
          optimisticData.push({ id: 'temp', student_id: studentId, date: dateStr, status: 'present' });
        }
      }
      
      mutateAttendance(optimisticData, false);
      await toggleAttendance(studentId, dateStr, currentStatus);
      mutateAttendance();
      toast.success(currentStatus === 'present' ? "Marked Absent" : "Marked Present");
    } catch {
      toast.error("Failed to update attendance");
      mutateAttendance();
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Attendance Board</h1>
          <p className="text-slate-500 mt-1">
            {user 
              ? `Mark attendance for ${format(date, "EEEE, MMMM do, yyyy")}` 
              : `Attendance for ${format(date, "EEEE, MMMM do, yyyy")}`}
          </p>
        </div>
        
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal bg-white",
                  !date && "text-muted-foreground"
                )}
              />
            }
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
            />
          </PopoverContent>
        </Popover>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : isOffDay ? (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-12 text-center">
          <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <CheckCircle2 className="h-8 w-8 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800 mb-2">
            {currentHoliday ? currentHoliday.name : "Non-Working Day"}
          </h2>
          <p className="text-slate-600">No attendance required for today.</p>
        </div>
      ) : students?.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500">
            {user ? "No students found. Add students from the Students tab." : "No students found."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {students?.map((student) => {
            const record = attendance?.find(a => a.student_id === student.id);
            const isPresent = record?.status === 'present';

            const cardClasses = cn(
              "p-5 rounded-xl text-left transition-all duration-200 relative overflow-hidden group w-full",
              user ? "border hover:shadow-sm" : "border cursor-default",
              isPresent 
                ? "bg-emerald-50 border-emerald-200 shadow-sm" 
                : "bg-white border-slate-200 hover:border-slate-300"
            );

            const content = (
              <>
                <div className="flex justify-between items-start mb-3">
                  <div className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide",
                    isPresent ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {isPresent ? 'PRESENT' : 'ABSENT'}
                  </div>
                </div>
                <div className="font-semibold text-lg text-slate-800 mb-1">{student.name}</div>
                <div className="text-sm text-slate-500 font-mono">{student.roll_number}</div>
                
                {isPresent && (
                  <div className="absolute -bottom-4 -right-4 text-emerald-500/10 transform rotate-12">
                    <CheckCircle2 className="w-24 h-24" />
                  </div>
                )}
              </>
            );

            if (!user) {
              return (
                <div key={student.id} className={cardClasses}>
                  {content}
                </div>
              );
            }

            return (
              <button
                key={student.id}
                onClick={() => handleToggle(student.id, isPresent ? 'present' : null)}
                className={cardClasses}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
