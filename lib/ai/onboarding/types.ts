export type OnboardingPriority = "high" | "medium" | "low";

export interface OnboardingNextAction {
  title: string;
  description: string;
  priority: OnboardingPriority;
}

export interface OnboardingPlan {
  summary: string;
  goals: string[];
  requirements: string[];
  nextActions: OnboardingNextAction[];
  risks: string[];
  timeline: string;
}

export interface CustomerHandoff {
  handoffId: string;
  customerName: string;
  customerEmail: string;
  company: string;
  dealSummary: string;
  salesNotes: string;
  plan: string;
  owner: string;
  status: string;
  createdAt?: string;
}
