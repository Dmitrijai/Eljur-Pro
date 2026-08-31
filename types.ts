
export type Role = 'director' | 'teacher' | 'student' | 'creator' | 'employee';

export interface School {
  id: string;
  name: string;
  directorId: string; // The ID of the director who owns this school
  classes?: { class: string; letter: string; headmasterId?: string }[];
  subjects?: string[];
  gradingSystem?: GradingSystemSettings;
  gradeTypes?: GradeType[];
  scheduleSettings?: ScheduleSettings;
  subjectRequirements?: Record<string, Record<string, SubjectRequirement>>;
}

export interface EmployeePermissions {
  allowedTabs: string[]; // 'messages', 'rating', 'schedule', 'announcements', 'users'
  messagingScope: string[]; // List of class keys "10_A" or "ALL"
  canSendAsDirector?: boolean; // Restored permission
  isAdministration?: boolean; // If true, accessible by everyone (except Creator), otherwise restricted to messagingScope
}

export interface User {
  id: string;
  schoolId: string; // Links user to a specific school
  fio: string;
  login: string;
  password?: string;
  role: Role;
  customRole?: string; // For "Other" roles (e.g. Laborant) or title for Employee
  blockedUntil?: string; // ISO Date string if blocked, undefined otherwise
  class?: string; // For students (e.g. "10")
  letter?: string; // For students (e.g. "A")
  classes?: string[]; // For teachers (e.g. ["10_A", "11_B"])
  subjects?: string[]; // For teachers
  
  // New permissions for employees
  employeePermissions?: EmployeePermissions;
}

export interface SubgroupLesson {
    groupId: string;
    subject: string;
    teacherId: string;
    room: string;
    teacherLabel?: string; // New: Custom label (e.g., Substitution)
    canGrade?: boolean; // New: Permission to grade
}

export interface Lesson {
  id: string;
  timeRange: string;
  lesson: string; // Subject name (Main)
  teacherId: string; // (Main)
  room: string; // (Main)
  teacherLabel?: string; // New: Custom label (e.g., Substitution)
  canGrade?: boolean; // New: Permission to grade
  subgroups?: SubgroupLesson[]; // Optional split
}

export interface ScheduleDay {
  id: string;
  title: string; // "Monday"
  date: string; // "2023-10-25"
  lessons: Lesson[];
  showGroups?: boolean; // Controls visibility of the Group column
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
}

export interface Homework {
  id: string;
  schoolId?: string;
  class: string;
  letter: string;
  date: string;
  subject: string;
  text: string;
  attachments?: Attachment[]; // Multiple files
  fromId: string;
  lessonIndex?: number; // 0 for first lesson, 1 for second...
  
  // Legacy support for migration
  attachmentId?: string;
  attachmentName?: string;
  attachmentType?: string;
}

export interface Grade {
  id: string;
  studentId: string;
  date: string;
  value: string | number;
  type: string; // "dz", "kr", etc.
  weight: number;
  comment?: string; // New field for teacher comments
  lessonIndex?: number; // 0 for first lesson, 1 for second...
  deadline?: string; // Date when "Н/У" turns into a 2
}

// Structure to store Confirmed Final Grades
export interface FinalGradeEntry {
    studentId: string;
    q1?: string; // Confirmed Quarter 1 Grade
    q2?: string;
    q3?: string;
    q4?: string;
    exam?: string; // Exam Grade
    year?: string; // Confirmed Year Grade
    
    // Confirmation Flags
    isQ1Confirmed?: boolean;
    isQ2Confirmed?: boolean;
    isQ3Confirmed?: boolean;
    isQ4Confirmed?: boolean;
    isExamConfirmed?: boolean;
    isYearConfirmed?: boolean;
}

export interface Message {
  id: string;
  fromId: string;
  realAuthorId?: string; // The actual user ID if sent on behalf of someone else (Director)
  toIds: string[];
  toRoles?: Role[];
  title: string;
  body: string;
  attachments?: Attachment[]; // Multiple files
  date: string;
  read?: boolean;
  readBy?: string[]; // List of user IDs who have read/viewed this message in viewport

  // Legacy
  attachmentId?: string;
  attachmentName?: string;
  attachmentType?: string;
}

export interface Announcement extends Message {}

// --- NEW SCHEDULE SETTINGS ---
export interface ScheduleSettings {
  daysToAddBatch: number; // How many days to add at once (default 1 or 7)
  skippedWeekDays: number[]; // 0=Sunday, 1=Monday... Days to skip during auto-generation
  holidays: { date: string; title: string }[]; // Specific dates YYYY-MM-DD with Name
  vacations: { id: string; start: string; end: string; title: string }[]; // Ranges
  // New: Quarter Definitions
  quarterDefinitions?: {
      [key: string]: { start: string; end: string }; // 'Q1', 'Q2', 'Q3', 'Q4'
  };
}

// --- NEW ASSIGNMENTS & GROUPS ---
export interface TeacherAssignment {
    id: string;
    schoolId?: string;
    teacherId: string;
    classId: string; // "10_A"
    subject: string;
}

export interface StudentGroup {
    id: string;
    schoolId?: string;
    classId: string; // "10_A"
    name: string; // "Группа 1"
    studentIds: string[];
}

// --- GRADING CONFIGURATION ---
export interface GradingSystemSettings {
  minGrade: number;
  maxGrade: number;
  useWeights: boolean;
  minWeight: number;
  maxWeight: number;
}

export interface GradeType {
  id: string;
  key: string;
  name: string;
  weight: number;
  isDynamicWeight?: boolean; // Teacher sets weight (e.g. N/U)
  isNoWeight?: boolean; // No numeric value (e.g. N, OP)
}

export interface SubjectRequirement {
  type: 'auto' | 'manual';
  minGrades: number;
}

export interface AppState {
  schools: School[]; // List of schools
  users: User[];
  userOrder: string[]; // IDs for sorting
  classes: { class: string; letter: string; headmasterId?: string }[];
  subjects: string[];
  // Key is class_letter e.g. "10_A". Value is object of days.
  schedules: Record<string, Record<string, ScheduleDay>>; 
  homework: Homework[];
  messages: Message[];
  announcements: Announcement[];
  // Key: "10_A", Subkey: "Math", Value: Grade[]
  grades: Record<string, Record<string, Grade[]>>;
  
  // Confirmed Final Grades: [classKey][subject] = FinalGradeEntry[]
  finalGrades?: Record<string, Record<string, FinalGradeEntry[]>>;

  // New Data Structures
  teacherAssignments: TeacherAssignment[];
  studentGroups: StudentGroup[];

  // Grading Settings
  gradingSystem?: GradingSystemSettings;
  gradeTypes?: GradeType[]; // Dynamic Grade Types
  subjectRequirements?: Record<string, Record<string, SubjectRequirement>>; // classKey -> subject -> requirement

  quarters: {
    Q1: string[];
    Q2: string[];
    Q3: string[];
    Q4: string[];
  };
  settings: {
    theme: 'light' | 'dark';
    language: 'ru' | 'en'; // Added language
    timezone?: string; // Added timezone setting
    showSeasonalAnimations?: boolean; // New setting for animations
    systemTimeOffset?: number; // Time travel offset in ms
    
    // Font Settings
    bodyFontId?: string;
    headingFontId?: string;

    // Creator Settings
    adminPassword?: string; // Default 'admin'
    secretKey?: string; // Default 'Space'
    secretCount?: number; // Default 4
    eljurInfo?: string; // Rich text info about Eljur
  };
  // Global Schedule Config
  scheduleSettings: ScheduleSettings;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  blob: Blob;
}

// Legacy constant for initialization/fallback
export const COEFFICIENT_TYPES = [
  { key: 'dz', name: 'ДЗ', weight: 2 },
  { key: 'lr', name: 'ЛР', weight: 5 },
  { key: 'pr', name: 'ПР', weight: 5 },
  { key: 'otv', name: 'Ответ', weight: 3 },
  { key: 'kr', name: 'КР', weight: 10 },
  { key: 'ess', name: 'Эссе', weight: 8 },
  { key: 'nu', name: 'Н/У', weight: 1 },
  { key: 'n', name: 'Н', weight: 0 },
  { key: 'op', name: 'ОП', weight: 0 }
];
