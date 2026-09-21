"use client";

import { useState, useEffect } from "react";
import { Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase, fetchSettings, updateStudent, Student } from "@/lib/api";
import useSWR from "swr";
import { toast } from "sonner";

interface EditStudentDialogProps {
  student: Student;
  onSuccess?: () => void;
}

export function EditStudentDialog({ student, onSuccess }: EditStudentDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(student.name || "");
  const [scholarNumber, setScholarNumber] = useState(student.scholar_number || "");
  const [enrollmentNumber, setEnrollmentNumber] = useState(student.enrollment_number || "");
  const [program, setProgram] = useState(student.program || "");
  const [year, setYear] = useState(student.year || "");
  const [section, setSection] = useState(student.section || "");
  const [mobile, setMobile] = useState(student.mobile_number || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: settings } = useSWR('settings', fetchSettings);
  const orgStructure = settings?.organization_structure || [];

  // Reset states when dialog opens
  useEffect(() => {
    if (open) {
      setYear(student.year || "");
      setProgram(student.program || "");
      setSection(student.section || "");
      setName(student.name || "");
      setScholarNumber(student.scholar_number || "");
      setEnrollmentNumber(student.enrollment_number || "");
      setMobile(student.mobile_number || "");
    }
  }, [open, student]);

  // Update dropdowns dynamically based on selection
  const selectedYearObj = orgStructure.find(y => y.name === year);
  const availableBranches = selectedYearObj ? selectedYearObj.branches : [];
  const selectedBranchObj = availableBranches.find(b => b.name === program);
  const availableSections = selectedBranchObj ? selectedBranchObj.sections : [];

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter student name");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateStudent(student.id, {
        name: name.trim(),
        scholar_number: scholarNumber.trim(),
        enrollment_number: enrollmentNumber.trim(),
        roll_number: scholarNumber.trim() || enrollmentNumber.trim(),
        program,
        year,
        section,
        mobile_number: mobile.trim(),
      });

      toast.success("Student updated successfully!");
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to update student");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 h-8 w-8"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Edit2 className="w-5 h-5 text-indigo-600" />
            Edit Student Details
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleUpdate} className="space-y-3.5 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Student Full Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Scholar Number</label>
              <Input
                value={scholarNumber}
                onChange={(e) => setScholarNumber(e.target.value)}
                placeholder="e.g. 2401936"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Enrollment Number</label>
              <Input
                value={enrollmentNumber}
                onChange={(e) => setEnrollmentNumber(e.target.value)}
                placeholder="e.g. EN26CS3010..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Year</label>
              {orgStructure.length > 0 ? (
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    const y = orgStructure.find(y => y.name === e.target.value);
                    if (y && y.branches.length > 0) {
                      setProgram(y.branches[0].name);
                      if (y.branches[0].sections.length > 0) {
                        setSection(y.branches[0].sections[0].name);
                      } else {
                        setSection("");
                      }
                    } else {
                      setProgram("");
                      setSection("");
                    }
                  }}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
                >
                  <option value="" disabled>Select Year</option>
                  {orgStructure.map(y => (
                    <option key={y.name} value={y.name}>{y.name}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Program / Branch</label>
              {orgStructure.length > 0 ? (
                <select
                  value={program}
                  onChange={(e) => {
                    setProgram(e.target.value);
                    const b = availableBranches.find(b => b.name === e.target.value);
                    if (b && b.sections.length > 0) {
                      setSection(b.sections[0].name);
                    } else {
                      setSection("");
                    }
                  }}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
                >
                  <option value="" disabled>Select Program</option>
                  {availableBranches.map(b => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>
              ) : (
                <Input
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  placeholder="B.Tech Computer Science and Engineering"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Section</label>
              {orgStructure.length > 0 ? (
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
                >
                  <option value="" disabled>Select Section</option>
                  {availableSections.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <Input
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="Section A"
                />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Mobile Number</label>
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91-9876543210"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Student"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
