"use client";

import { useState } from "react";
import { FileSpreadsheet, Download, Upload, CheckCircle2, Loader2, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Student, batchMarkAttendance } from "@/lib/api";
import { downloadAttendanceTemplate, parseAttendanceImportExcel } from "@/lib/excel";
import { toast } from "sonner";

interface ExcelAttendanceDialogProps {
  students: Student[];
  dateStr: string;
  onSuccess?: () => void;
}

export function ExcelAttendanceDialog({ students, dateStr, onSuccess }: ExcelAttendanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    presentIds: string[];
    absentIds: string[];
    totalProcessed: number;
  } | null>(null);

  const handleDownloadTemplate = () => {
    if (students.length === 0) {
      toast.error("No students found in register to download");
      return;
    }
    downloadAttendanceTemplate(students, dateStr);
    toast.success("Attendance template downloaded!");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const result = parseAttendanceImportExcel(buffer, students);
      setPreviewResult(result);
      toast.success(`Parsed ${result.totalProcessed} student attendance records!`);
    } catch (err: any) {
      toast.error("Failed to parse Excel file: " + (err.message || "Invalid format"));
      setFile(null);
      setPreviewResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyAttendance = async () => {
    if (!previewResult) return;

    setIsProcessing(true);
    try {
      // Mark present students
      if (previewResult.presentIds.length > 0) {
        await batchMarkAttendance(previewResult.presentIds, dateStr, 'present');
      }
      // Mark absent students
      if (previewResult.absentIds.length > 0) {
        await batchMarkAttendance(previewResult.absentIds, dateStr, 'absent');
      }

      toast.success(
        `Applied Attendance: ${previewResult.presentIds.length} Present, ${previewResult.absentIds.length} Absent!`
      );
      setOpen(false);
      setFile(null);
      setPreviewResult(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error("Failed to save attendance: " + (err.message || "Database error"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-semibold shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
            Mark via Excel
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            Attendance via Excel ({dateStr})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Step 1: Download Template */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Step 1: Download Sheet
              </span>
              <span className="text-xs text-slate-400 font-medium">({students.length} students)</span>
            </div>
            <p className="text-xs text-slate-600">
              Download today&apos;s attendance register in Excel to mark P or A offline:
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="w-full bg-white border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold"
            >
              <ArrowDownToLine className="w-4 h-4 mr-2 text-emerald-600" />
              Download Today&apos;s Template (.xlsx)
            </Button>
          </div>

          {/* Step 2: Upload Filled Excel */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Step 2: Upload Marked Sheet
            </span>
            <p className="text-xs text-slate-600">
              Upload the Excel file with your attendance (P = Present, A = Absent):
            </p>

            <label className="border-2 border-dashed border-emerald-300 bg-white hover:bg-emerald-50/40 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
              <Upload className="w-6 h-6 text-emerald-600 mb-1" />
              <span className="text-xs font-semibold text-slate-700">
                {file ? file.name : "Select or drag marked Excel file"}
              </span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
                disabled={isProcessing}
              />
            </label>
          </div>

          {/* Preview Details */}
          {previewResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Ready to Apply: {previewResult.totalProcessed} Records
              </div>
              <div className="flex gap-2 text-xs font-semibold">
                <span className="bg-white px-2.5 py-1 rounded border border-emerald-200 text-emerald-700">
                  ✅ Present: {previewResult.presentIds.length}
                </span>
                <span className="bg-white px-2.5 py-1 rounded border border-rose-200 text-rose-700">
                  ❌ Absent: {previewResult.absentIds.length}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setFile(null);
                setPreviewResult(null);
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleApplyAttendance}
              disabled={!previewResult || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                "Save Attendance"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
