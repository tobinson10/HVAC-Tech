import { Type } from "@google/genai";

export interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  photoRequiredOnIssue: boolean;
  isCritical: boolean;
  category: 'electrical' | 'mechanical' | 'refrigeration' | 'safety';
}

export interface JobStepStatus {
  stepId: string;
  status: 'pending' | 'pass' | 'fail';
  photoUrl?: string;
  notes?: string;
}

export interface Job {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  systemType: string;
  status: 'scheduled' | 'in-progress' | 'completed';
  startTime?: string;
  endTime?: string;
  steps: JobStepStatus[];
  notes: string[];
  completedAt?: string;
  scheduledAt?: string;
  technicianId?: string;
  technicianName?: string;
  technicianPhotoUrl?: string;
  technicianBio?: string;
  techLocation?: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
}

export interface Availability {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

export const CHECKLIST_STEPS: ChecklistStep[] = [
  { id: 'thermostat', label: 'Verify thermostat calibration', description: 'Ensure setpoint matches ambient temp.', photoRequiredOnIssue: true, isCritical: false, category: 'electrical' },
  { id: 'drain', label: 'Check/clean condensate drain', description: 'Clear any blockages and verify flow.', photoRequiredOnIssue: true, isCritical: true, category: 'mechanical' },
  { id: 'capacitor', label: 'Test capacitor', description: 'Measure MFD and compare to rating.', photoRequiredOnIssue: true, isCritical: true, category: 'electrical' },
  { id: 'refrigerant', label: 'Measure superheat/subcooling', description: 'Verify charge levels are within spec.', photoRequiredOnIssue: true, isCritical: true, category: 'refrigeration' },
  { id: 'coils', label: 'Inspect coils for dirt', description: 'Check evaporator and condenser coils.', photoRequiredOnIssue: true, isCritical: false, category: 'mechanical' },
  { id: 'filter', label: 'Check/replace air filter', description: 'Ensure proper airflow.', photoRequiredOnIssue: false, isCritical: false, category: 'mechanical' },
  { id: 'wiring', label: 'Inspect electrical connections', description: 'Tighten loose terminals.', photoRequiredOnIssue: true, isCritical: true, category: 'electrical' },
  { id: 'amps', label: 'Measure compressor amp draw', description: 'Compare to RLA/LRA.', photoRequiredOnIssue: true, isCritical: false, category: 'electrical' },
  { id: 'safety', label: 'Test safety switches', description: 'Float switch, high pressure cutout, etc.', photoRequiredOnIssue: true, isCritical: true, category: 'safety' },
];
