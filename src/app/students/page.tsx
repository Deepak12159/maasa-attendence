"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Plus, Trash2, Loader2, Search, FileSpreadsheet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableBody
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchStudents, deleteStudent, deleteAllStudents, Student } from "@/lib/api";
import { ExcelImportDialog } from "@/components/excel-import-dialog";
import { AddStudentDialog } from "@/components/add-student-dialog";
import { EditStudentDialog } from "@/components/edit-student-dialog";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function StudentsPage() {
  const { data: students = [], mutate, isLoading } = useSWR('students', fetchStudents);
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");

  // Pagination for fast rendering across 900+ rows
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) return null;

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this student?")) return;

    try {
      await deleteStudent(id);
      toast.success("Student deleted");
      mutate();
    } catch {
      toast.error("Failed to delete student");
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("⚠️ WARNING: Are you absolutely sure you want to delete ALL students and their attendance records? This action cannot be undone.")) return;
    
    // Double confirmation for safety
    if (!confirm("Are you REALLY sure? Type 'yes' to proceed? (Well, just clicking OK is enough but please be sure!)")) return;

    try {
      await deleteAllStudents();
      toast.success("All student records deleted successfully");
      mutate();
      setPage(1);
    } catch (err: any) {
      toast.error("Failed to delete all students: " + err.message);
    }
  };

  // Filtering
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      if (selectedYear !== "all" && st.year !== selectedYear) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = st.name?.toLowerCase().includes(q);
        const enrollMatch = st.enrollment_number?.toLowerCase().includes(q);
        const scholarMatch = st.scholar_number?.toLowerCase().includes(q);
        const rollMatch = st.roll_number?.toLowerCase().includes(q);
        return nameMatch || enrollMatch || scholarMatch || rollMatch;
      }
      return true;
    });
  }, [students, selectedYear, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, page, pageSize]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Students Roster</h1>
          <p className="text-slate-500 mt-1">Manage student profiles, years, programs, and sections</p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleDeleteAll} variant="outline" className="text-red-600 hover:text-white hover:bg-red-600 border-red-200">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All
          </Button>
          <AddStudentDialog onSuccess={() => mutate()} />
          <ExcelImportDialog onSuccess={() => mutate()} />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, scholar no, enrollment no..."
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700"
          >
            <option value="all">All Years ({students.length})</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center p-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70">
                <th className="px-4 py-3 text-left font-semibold text-slate-700 text-xs w-12">#</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 text-xs">Scholar No</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 text-xs">Enrollment No</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 text-xs">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 text-xs">Year & Program</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 text-xs">Section</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 text-xs">Actions</th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    No students found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedStudents.map((student, idx) => (
                  <TableRow key={student.id} className="hover:bg-slate-50/70">
                    <TableCell className="font-mono text-xs text-slate-400">
                      {(page - 1) * pageSize + idx + 1}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-slate-800 text-xs">
                      {student.scholar_number || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {student.enrollment_number || student.roll_number || '-'}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      {student.name}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <span className="font-semibold text-indigo-600">{student.year || '1st Year'}</span> - {student.program || 'B.Tech CSE'}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-700">
                      {student.section || 'Section A'}
                    </TableCell>
                    <TableCell className="text-right flex items-center justify-end gap-1">
                      <EditStudentDialog student={student} onSuccess={() => mutate()} />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(student.id)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredStudents.length)} of {filteredStudents.length} students
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 px-2.5 text-xs"
                >
                  Previous
                </Button>
                <span className="font-semibold text-slate-700">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 px-2.5 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
