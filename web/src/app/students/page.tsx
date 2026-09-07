"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  Body,
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
import { fetchStudents, supabase } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function StudentsPage() {
  const { data: students, mutate, isLoading } = useSWR('students', fetchStudents);
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [roll, setRoll] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !roll) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('students').insert({ name, roll_number: roll });
      if (error) throw error;
      
      toast.success("Student added successfully");
      setIsOpen(false);
      setName("");
      setRoll("");
      mutate();
    } catch (error: any) {
      toast.error(error.message || "Failed to add student");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this student?")) return;
    
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      toast.success("Student deleted");
      mutate();
    } catch (error: any) {
      toast.error("Failed to delete student");
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Students</h1>
          <p className="text-slate-500 mt-1">Manage your class roster</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger
            render={
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Roll Number</label>
                <Input value={roll} onChange={e => setRoll(e.target.value)} placeholder="CS101" required />
              </div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save Student"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="font-semibold text-slate-900">Roll Number</TableHead>
                <TableHead className="font-semibold text-slate-900">Name</TableHead>
                <TableHead className="text-right font-semibold text-slate-900">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-slate-500">
                    No students added yet.
                  </TableCell>
                </TableRow>
              ) : (
                students?.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-mono text-slate-600">{student.roll_number}</TableCell>
                    <TableCell className="font-medium text-slate-900">{student.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(student.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
