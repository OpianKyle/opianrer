import { apiRequest } from "./queryClient";
import { TeamMember, InsertTeamMember } from "@shared/schema";

export const teamMembersApi = {
  getAll: async (): Promise<TeamMember[]> => {
    const res = await apiRequest("GET", "/api/team-members");
    return await res.json();
  },

  create: (teamMember: InsertTeamMember): Promise<TeamMember> =>
    apiRequest("POST", "/api/team-members", teamMember).then(res => res.json()),

  update: (id: number, teamMember: Partial<InsertTeamMember>): Promise<TeamMember> =>
    apiRequest("PUT", `/api/team-members/${id}`, teamMember).then(res => res.json()),

  delete: (id: number): Promise<void> =>
    apiRequest("DELETE", `/api/team-members/${id}`).then(() => {}),
};