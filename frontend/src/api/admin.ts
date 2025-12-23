import { api } from './client'
import type { ApiResponse } from './client'
import type { Category, NewCategory } from './types'

export interface AuditLogItem {
  id: string
  adminId: string
  action: string
  entityType: string | null
  entityId: string | null
  details: string | null
  createdAt: string
  adminEmail?: string
}

export interface GetAuditLogParams {
  page?: number
  pageSize?: number
  adminId?: string
  action?: string
  startDate?: string
  endDate?: string
}

export interface AuditLogResponse {
  items: AuditLogItem[]
  total: number
}

export const adminApi = {
  getAuditLog: (
    params: GetAuditLogParams,
  ): Promise<ApiResponse<AuditLogResponse>> =>
    api.get<AuditLogResponse>('/admin/audit-log', { params }),

  listUsers: (
    params: { role?: 'user' | 'admin' | 'treasury'; page?: number; pageSize?: number; search?: string },
  ): Promise<ApiResponse<{ items: any[]; pagination: any }>> =>
    api.get<{ items: any[]; pagination: any }>('/admin/users', { params }),

  // Categories
  listCategories: (params?: { includeInactive?: boolean }): Promise<ApiResponse<Category[]>> =>
    api.get<Category[]>('/admin/categories', { params }),

  createCategory: (data: NewCategory): Promise<ApiResponse<Category>> =>
    api.post<Category>('/admin/categories', data),

  updateCategory: (id: string, data: Partial<NewCategory>): Promise<ApiResponse<Category>> =>
    api.patch<Category>(`/admin/categories/${id}`, data),

  deleteCategory: (id: string): Promise<ApiResponse<void>> =>
    api.delete<void>(`/admin/categories/${id}`),
}
