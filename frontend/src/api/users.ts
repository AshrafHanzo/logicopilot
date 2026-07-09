import { apiClient } from "./client";
import type { Role, User } from "../types/auth";

export async function listUsers(tenantId?: string): Promise<User[]> {
  const response = await apiClient.get<User[]>("/users", { params: tenantId ? { tenant_id: tenantId } : undefined });
  return response.data;
}

export async function createUser(payload: {
  email: string;
  password: string;
  full_name: string;
  role: Role;
  tenant_id?: string;
}): Promise<User> {
  const response = await apiClient.post<User>("/users", payload);
  return response.data;
}

export async function setUserActive(userId: string, isActive: boolean): Promise<User> {
  const response = await apiClient.patch<User>(`/users/${userId}`, { is_active: isActive });
  return response.data;
}
