"use client";

import { useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { Trash2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase, fetchHolidays, fetchSettings, updateOrganizationStructure, OrgYear, OrgBranch, OrgSection } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const DAYS = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
  { id: 7, name: "Sunday" },
];

export default function SettingsPage() {
  const { data: holidays, mutate: mutateHolidays, isLoading: loadingHolidays } = useSWR('holidays', fetchHolidays);
  const { data: settings, mutate: mutateSettings, isLoading: loadingSettings } = useSWR('settings', fetchSettings);
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false);
  const [isSavingDays, setIsSavingDays] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Local state for working days and organization
  const [workingDays, setWorkingDays] = useState<number[]>([]);
  const [orgStructure, setOrgStructure] = useState<OrgYear[]>([]);
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // Sync settings when loaded
  if (settings && workingDays.length === 0 && !isSavingDays) {
    setWorkingDays(settings.working_days);
  }
  if (settings && orgStructure.length === 0 && !isSavingOrg && settings.organization_structure) {
    setOrgStructure(settings.organization_structure);
  }

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date) return;
    
    setIsSubmittingHoliday(true);
    try {
      const { error } = await supabase.from('holidays').insert({ name, date });
      if (error) throw error;
      
      toast.success("Holiday added");
      setName("");
      setDate("");
      mutateHolidays();
    } catch (error: Error | unknown) {
      toast.error((error as Error).message || "Failed to add holiday");
    } finally {
      setIsSubmittingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;
      toast.success("Holiday deleted");
      mutateHolidays();
    } catch {
      toast.error("Failed to delete holiday");
    }
  };

  const toggleDay = (dayId: number) => {
    setWorkingDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const saveWorkingDays = async () => {
    setIsSavingDays(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ id: 1, working_days: workingDays });
      if (error) throw error;
      toast.success("Working days updated");
      mutateSettings();
    } catch {
      toast.error("Failed to update working days");
    } finally {
      setIsSavingDays(false);
    }
  };

  const saveOrgStructure = async () => {
    setIsSavingOrg(true);
    try {
      await updateOrganizationStructure(orgStructure);
      toast.success("Organization structure saved");
      mutateSettings();
    } catch {
      toast.error("Failed to save organization structure");
    } finally {
      setIsSavingOrg(false);
    }
  };

  const addYear = () => {
    const yearName = prompt("Enter Year Name (e.g., 1st Year):");
    if (!yearName) return;
    setOrgStructure([...orgStructure, { name: yearName, branches: [] }]);
  };

  const addBranch = (yearIndex: number) => {
    const branchName = prompt("Enter Branch/Program Name (e.g., CSE):");
    if (!branchName) return;
    const newOrg = [...orgStructure];
    newOrg[yearIndex].branches.push({ name: branchName, sections: [] });
    setOrgStructure(newOrg);
  };

  const addSection = (yearIndex: number, branchIndex: number) => {
    const sectionName = prompt("Enter Section Name (e.g., A):");
    if (!sectionName) return;
    const newOrg = [...orgStructure];
    newOrg[yearIndex].branches[branchIndex].sections.push({ name: sectionName, startTime: "09:00", endTime: "10:00" });
    setOrgStructure(newOrg);
  };

  const removeYear = (yearIndex: number) => {
    if (!confirm("Are you sure you want to delete this year and all its branches/sections?")) return;
    const newOrg = [...orgStructure];
    newOrg.splice(yearIndex, 1);
    setOrgStructure(newOrg);
  };

  const removeBranch = (yearIndex: number, branchIndex: number) => {
    if (!confirm("Are you sure you want to delete this branch?")) return;
    const newOrg = [...orgStructure];
    newOrg[yearIndex].branches.splice(branchIndex, 1);
    setOrgStructure(newOrg);
  };

  const removeSection = (yearIndex: number, branchIndex: number, sectionIndex: number) => {
    if (!confirm("Are you sure you want to delete this section?")) return;
    const newOrg = [...orgStructure];
    newOrg[yearIndex].branches[branchIndex].sections.splice(sectionIndex, 1);
    setOrgStructure(newOrg);
  };

  const updateSectionTime = (yearIndex: number, branchIndex: number, sectionIndex: number, field: 'startTime' | 'endTime', value: string) => {
    const newOrg = [...orgStructure];
    newOrg[yearIndex].branches[branchIndex].sections[sectionIndex][field] = value;
    setOrgStructure(newOrg);
  };

  if (authLoading || !user) return null;

  if (loadingHolidays || loadingSettings) {
    return (
      <div className="flex justify-center items-center h-full pt-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Configure holidays and working days</p>
      </div>

      <Tabs defaultValue="holidays" className="w-full">
        <TabsList className="mb-6 bg-slate-100/50">
          <TabsTrigger value="holidays" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Holidays</TabsTrigger>
          <TabsTrigger value="working-days" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Working Days</TabsTrigger>
          <TabsTrigger value="organization" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Organization</TabsTrigger>
        </TabsList>
        
        <TabsContent value="holidays">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-lg mb-4">Add Holiday</h3>
                <form onSubmit={handleAddHoliday} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Holiday Name</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Diwali" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date</label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={isSubmittingHoliday}>
                    {isSubmittingHoliday ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Add Holiday"}
                  </Button>
                </form>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-semibold">Upcoming Holidays</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {holidays?.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">No holidays set.</div>
                  ) : (
                    holidays?.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(holiday => (
                      <div key={holiday.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <div>
                          <div className="font-medium text-slate-900">{holiday.name}</div>
                          <div className="text-sm text-slate-500">{format(new Date(holiday.date), "PPP")}</div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteHoliday(holiday.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="working-days">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-lg mb-6">Select Working Days</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
              {DAYS.map(day => {
                const isActive = workingDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    className={`p-4 rounded-xl border text-center transition-all ${
                      isActive 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {day.name}
                  </button>
                )
              })}
            </div>
            
            <Button onClick={saveWorkingDays} disabled={isSavingDays} className="bg-indigo-600 hover:bg-indigo-700">
              {isSavingDays ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Working Days
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="organization">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-lg">Organization Structure</h3>
              <Button onClick={addYear} variant="outline" size="sm">
                + Add Year
              </Button>
            </div>
            
            {orgStructure.length === 0 ? (
              <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
                No organization structure defined. Click "Add Year" to start.
              </div>
            ) : (
              <div className="space-y-6">
                {orgStructure.map((year, yIdx) => (
                  <div key={yIdx} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-lg text-slate-800">{year.name}</h4>
                      <div className="space-x-2">
                        <Button onClick={() => addBranch(yIdx)} size="sm" variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
                          + Add Branch
                        </Button>
                        <Button onClick={() => removeYear(yIdx)} size="sm" variant="ghost" className="text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4 pl-4 border-l-2 border-indigo-100 ml-2">
                      {year.branches.map((branch, bIdx) => (
                        <div key={bIdx} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                          <div className="flex justify-between items-center mb-3">
                            <h5 className="font-semibold text-slate-700">{branch.name}</h5>
                            <div className="space-x-2">
                              <Button onClick={() => addSection(yIdx, bIdx)} size="sm" variant="outline" className="h-8">
                                + Add Section
                              </Button>
                              <Button onClick={() => removeBranch(yIdx, bIdx)} size="sm" variant="ghost" className="h-8 text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
                            {branch.sections.map((section, sIdx) => (
                              <div key={sIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                                <span className="font-medium text-sm min-w-[80px]">{section.name}</span>
                                <Input 
                                  type="time" 
                                  value={section.startTime || ''} 
                                  onChange={(e) => updateSectionTime(yIdx, bIdx, sIdx, 'startTime', e.target.value)}
                                  className="h-8 text-xs w-28"
                                />
                                <span className="text-xs text-slate-500">to</span>
                                <Input 
                                  type="time" 
                                  value={section.endTime || ''} 
                                  onChange={(e) => updateSectionTime(yIdx, bIdx, sIdx, 'endTime', e.target.value)}
                                  className="h-8 text-xs w-28"
                                />
                                <Button onClick={() => removeSection(yIdx, bIdx, sIdx)} size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                            {branch.sections.length === 0 && (
                              <div className="text-xs text-slate-400 italic">No sections added yet.</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {year.branches.length === 0 && (
                        <div className="text-sm text-slate-400 italic py-2">No branches added yet.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 pt-4 border-t border-slate-100">
              <Button onClick={saveOrgStructure} disabled={isSavingOrg} className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
                {isSavingOrg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Organization Structure
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
