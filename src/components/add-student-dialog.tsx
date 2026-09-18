"use client";

import { useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase, fetchSettings } from "@/lib/api";
import useSWR from "swr";
import { toast } from "sonner";

interface AddStudentDialogProps {
  onSuccess?: () => void;
  triggerButton?: React.ReactElement;
}

export function AddStudentDialog({ onSuccess, triggerButton }: AddStudentDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scholarNumber, setScholarNumber] = useState("");
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [program, setProgram] = useState("B.Tech Computer Science and Engineering");
  const [year, setYear] = useState("1st Year");
  const [section, setSection] = useState("Section A");
  const [mobile, setMobile] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: settings } = useSWR('settings', fetchSettings);
  const orgStructure = settings?.organization_structure || [];

  // Update dropdowns dynamically based on selection
  const selectedYearObj = orgStructure.find(y => y.name === year);
  const availableBranches = selectedYearObj ? selectedYearObj.branches : [];
  const selectedBranchObj = availableBranches.find(b => b.name === program);
  const availableSections = selectedBranchObj ? selectedBranchObj.sections : [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter student name");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('students').insert({
        name: name.trim(),
        scholar_number: scholarNumber.trim(),
        enrollment_number: enrollmentNumber.trim(),
        roll_number: scholarNumber.trim() || enrollmentNumber.trim(),
        program,
        year,
        section: section || 'Section A',
        mobile_number: mobile.trim(),
        club_name: 'SPORTS CLUB',
      });

      if (error) throw error;

      toast.success("Student added successfully!");
      setOpen(false);
      setName("");
      setScholarNumber("");
      setEnrollmentNumber("");
      setMobile("");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to add student");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          triggerButton || (
            <Button variant="outline" className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm">
              <UserPlus className="w-4 h-4 mr-2 text-indigo-600" />
              Add Student (Manual)
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            Add Student Manually
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleAdd} className="space-y-3.5 pt-2">
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
                      }
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

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Mobile Number</label>
            <Input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="+91-9876543210"
            />
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
                  Saving...
                </>
              ) : (
                "Save Student"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
