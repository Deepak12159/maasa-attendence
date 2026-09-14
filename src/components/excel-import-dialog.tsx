"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { parseExcelFile } from "@/lib/excel";
import { batchUpsertStudents, Student } from "@/lib/api";
import { toast } from "sonner";

interface ExcelImportDialogProps {
  onSuccess?: () => void;
}

export function ExcelImportDialog({ onSuccess }: ExcelImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedStudents, setParsedStudents] = useState<Partial<Student>[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const students = parseExcelFile(buffer);
      setParsedStudents(students);
      toast.success(`Found ${students.length} students in file!`);
    } catch (err: any) {
      toast.error("Failed to read Excel file: " + (err.message || "Invalid format"));
      setFile(null);
      setParsedStudents([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (parsedStudents.length === 0) return;

    setIsProcessing(true);
    setProgress(10);
    try {
      await batchUpsertStudents(parsedStudents);
      setProgress(100);
      toast.success(`Successfully saved ${parsedStudents.length} students!`);
      setOpen(false);
      setFile(null);
      setParsedStudents([]);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message || "Database error. Make sure SQL migration is run."));
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  // Group counts for summary preview
  const yearCounts: Record<string, number> = {};
  for (const st of parsedStudents) {
    const yr = st.year || "Unknown";
    yearCounts[yr] = (yearCounts[yr] || 0) + 1;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm">
            <Upload className="w-4 h-4 mr-2 text-indigo-600" />
            Import Excel
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            Upload Students Excel (.xlsx)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-500">
            Select or drag your <strong>Club Registration Excel</strong>. Sir don&apos;t worry — Year and Sections will be organized automatically!
          </p>

          <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/30 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors">
            <Upload className="w-10 h-10 text-slate-400 mb-2" />
            <span className="text-sm font-semibold text-slate-700">
              {file ? file.name : "Click here to choose Excel file"}
            </span>
            <span className="text-xs text-slate-400 mt-1">Accepts .xlsx, .xls</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />
          </label>

          {parsedStudents.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-emerald-900 font-semibold">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Ready to Import: {parsedStudents.length} Students
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-emerald-800 pt-1">
                {Object.entries(yearCounts).map(([yr, count]) => (
                  <div key={yr} className="bg-white/80 px-2.5 py-1.5 rounded-md border border-emerald-100 flex justify-between font-medium">
                    <span>{yr}:</span>
                    <span className="font-bold">{count}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-emerald-700 font-medium">
                ✓ Auto-divided into Sections of 60 students for easy attendance.
              </p>
            </div>
          )}

          {isProcessing && progress > 0 && (
            <div className="space-y-2">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 text-center font-medium">Saving students to database...</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setFile(null);
                setParsedStudents([]);
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleUpload}
              disabled={parsedStudents.length === 0 || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                `Save ${parsedStudents.length > 0 ? parsedStudents.length : ''} Students`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
