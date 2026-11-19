export interface AssessmentScore {
  name: string;
  obtained: number;
  maximum: number;
  weight: number;
}

export class AcademicInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicInputError";
  }
}

function validateAssessment(a: AssessmentScore) {
  if (!a.name.trim()) throw new AcademicInputError("Assessment name is required.");
  if (![a.obtained, a.maximum, a.weight].every(Number.isFinite) || a.maximum <= 0 || a.weight < 0 || a.weight > 100 || a.obtained < 0 || a.obtained > a.maximum) {
    throw new AcademicInputError("Marks must be between zero and the maximum; maximum must be positive and assessment weight must be from 0 to 100.");
  }
}

/** Weighted assessment percentage using only weights supplied by the student. */
export function weightedAssessmentPercent(items: AssessmentScore[]): number | null {
  if (!items.length) return null;
  items.forEach(validateAssessment);
  const weight = items.reduce((sum, i) => sum + i.weight, 0);
  if (weight <= 0) throw new AcademicInputError("At least one assessment must have a positive weight.");
  return items.reduce((sum, i) => sum + (i.obtained / i.maximum) * i.weight, 0) / weight * 100;
}

/** Percentage needed on remaining assessment weight to reach a chosen overall percent. */
export function requiredAssessmentPercent(currentWeightedPercent: number, completedWeight: number, remainingWeight: number, targetPercent: number): number | null {
  if (![currentWeightedPercent, completedWeight, remainingWeight, targetPercent].every(Number.isFinite) || currentWeightedPercent < 0 || currentWeightedPercent > 100 || completedWeight < 0 || remainingWeight < 0 || completedWeight + remainingWeight <= 0 || targetPercent < 0 || targetPercent > 100) {
    throw new AcademicInputError("Use percentages from 0 to 100 and non-negative assessment weights.");
  }
  if (remainingWeight === 0) return null;
  return (targetPercent * (completedWeight + remainingWeight) - currentWeightedPercent * completedWeight) / remainingWeight;
}

export interface CreditGrade { course: string; credits: number; gradePoints: number }

/** Credit-weighted GPA. Grade-point scale must be supplied by the user or a verified policy. */
export function gpa(items: CreditGrade[]): number | null {
  if (!items.length) return null;
  for (const i of items) {
    if (!i.course.trim() || !Number.isFinite(i.credits) || i.credits <= 0 || !Number.isFinite(i.gradePoints) || i.gradePoints < 0) {
      throw new AcademicInputError("Each course needs a name, positive credits, and a non-negative grade point.");
    }
  }
  const credits = items.reduce((sum, i) => sum + i.credits, 0);
  return items.reduce((sum, i) => sum + i.credits * i.gradePoints, 0) / credits;
}

/** Project cumulative GPA from completed and planned credits/points. */
export function projectCgpa(completed: { credits: number; points: number }, planned: { credits: number; points: number }): number | null {
  const values = [completed.credits, completed.points, planned.credits, planned.points];
  if (!values.every(Number.isFinite) || completed.credits < 0 || planned.credits < 0 || completed.points < 0 || planned.points < 0) {
    throw new AcademicInputError("Credits and quality points must be non-negative numbers.");
  }
  const credits = completed.credits + planned.credits;
  return credits === 0 ? null : (completed.points + planned.points) / credits;
}

export interface PlacementRuleInput { minCgpa?: number | null; maxActiveBacklogs?: number | null; minPercent?: number | null; verified: boolean }
export type PlacementCheck = "eligible" | "not_eligible" | "unknown";

/** Only verified thresholds may produce an eligibility result. */
export function checkPlacement(rule: PlacementRuleInput, student: { cgpa?: number | null; activeBacklogs?: number | null; percent?: number | null }): PlacementCheck {
  if (!rule.verified) return "unknown";
  const ruleValues = [rule.minCgpa, rule.maxActiveBacklogs, rule.minPercent].filter((value): value is number => value != null);
  const studentValues = [student.cgpa, student.activeBacklogs, student.percent].filter((value): value is number => value != null);
  if (ruleValues.some((value) => !Number.isFinite(value) || value < 0) || studentValues.some((value) => !Number.isFinite(value) || value < 0)) return "unknown";
  if ((rule.minPercent != null && rule.minPercent > 100) || (student.percent != null && student.percent > 100)) return "unknown";
  if ((rule.maxActiveBacklogs != null && !Number.isInteger(rule.maxActiveBacklogs)) || (student.activeBacklogs != null && !Number.isInteger(student.activeBacklogs))) return "unknown";
  const checks: boolean[] = [];
  if (rule.minCgpa != null) {
    if (student.cgpa == null) return "unknown";
    checks.push(student.cgpa >= rule.minCgpa);
  }
  if (rule.maxActiveBacklogs != null) {
    if (student.activeBacklogs == null) return "unknown";
    checks.push(student.activeBacklogs <= rule.maxActiveBacklogs);
  }
  if (rule.minPercent != null) {
    if (student.percent == null) return "unknown";
    checks.push(student.percent >= rule.minPercent);
  }
  if (!checks.length) return "unknown";
  return checks.every(Boolean) ? "eligible" : "not_eligible";
}
