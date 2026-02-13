import { 
  employees, type Employee, type InsertEmployee,
  type CoachAssignment, type InsertCoachAssignment,
  type GuardianRelationship, type InsertGuardianRelationship
} from "@shared/schema";

export interface IStorage {
  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployeeByEmail(email: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;

  getCoachAssignments(coachId: string): Promise<CoachAssignment[]>;
  getCoachAssignmentsByScooper(scooperId: string): Promise<CoachAssignment[]>;
  getAllCoachAssignments(): Promise<CoachAssignment[]>;
  createCoachAssignment(assignment: InsertCoachAssignment): Promise<CoachAssignment>;
  deleteCoachAssignment(id: string): Promise<void>;

  getGuardianRelationships(guardianId: string): Promise<GuardianRelationship[]>;
  getGuardianRelationshipsByScooper(scooperId: string): Promise<GuardianRelationship[]>;
  getAllGuardianRelationships(): Promise<GuardianRelationship[]>;
  createGuardianRelationship(relationship: InsertGuardianRelationship): Promise<GuardianRelationship>;
  deleteGuardianRelationship(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private employees: Map<string, Employee>;
  private coachAssignments: Map<string, CoachAssignment>;
  private guardianRelationships: Map<string, GuardianRelationship>;

  constructor() {
    this.employees = new Map();
    this.coachAssignments = new Map();
    this.guardianRelationships = new Map();
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async getEmployeeByEmail(email: string): Promise<Employee | undefined> {
    return Array.from(this.employees.values()).find(
      (employee) => employee.email === email,
    );
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = crypto.randomUUID();
    const employee: Employee = { 
      ...insertEmployee, 
      id,
      created_at: new Date(),
      updated_at: new Date(),
      last_login: null
    };
    this.employees.set(id, employee);
    return employee;
  }

  async getCoachAssignments(coachId: string): Promise<CoachAssignment[]> {
    return Array.from(this.coachAssignments.values()).filter(
      (a) => a.coach_id === coachId,
    );
  }

  async getCoachAssignmentsByScooper(scooperId: string): Promise<CoachAssignment[]> {
    return Array.from(this.coachAssignments.values()).filter(
      (a) => a.scooper_id === scooperId,
    );
  }

  async getAllCoachAssignments(): Promise<CoachAssignment[]> {
    return Array.from(this.coachAssignments.values());
  }

  async createCoachAssignment(assignment: InsertCoachAssignment): Promise<CoachAssignment> {
    const id = crypto.randomUUID();
    const coachAssignment: CoachAssignment = {
      ...assignment,
      id,
      assigned_by: assignment.assigned_by ?? null,
      created_at: new Date(),
    };
    this.coachAssignments.set(id, coachAssignment);
    return coachAssignment;
  }

  async deleteCoachAssignment(id: string): Promise<void> {
    this.coachAssignments.delete(id);
  }

  async getGuardianRelationships(guardianId: string): Promise<GuardianRelationship[]> {
    return Array.from(this.guardianRelationships.values()).filter(
      (r) => r.guardian_id === guardianId,
    );
  }

  async getGuardianRelationshipsByScooper(scooperId: string): Promise<GuardianRelationship[]> {
    return Array.from(this.guardianRelationships.values()).filter(
      (r) => r.scooper_id === scooperId,
    );
  }

  async getAllGuardianRelationships(): Promise<GuardianRelationship[]> {
    return Array.from(this.guardianRelationships.values());
  }

  async createGuardianRelationship(relationship: InsertGuardianRelationship): Promise<GuardianRelationship> {
    const id = crypto.randomUUID();
    const guardianRelationship: GuardianRelationship = {
      ...relationship,
      id,
      relationship_type: relationship.relationship_type ?? "guardian",
      assigned_by: relationship.assigned_by ?? null,
      created_at: new Date(),
    };
    this.guardianRelationships.set(id, guardianRelationship);
    return guardianRelationship;
  }

  async deleteGuardianRelationship(id: string): Promise<void> {
    this.guardianRelationships.delete(id);
  }
}

export const storage = new MemStorage();
