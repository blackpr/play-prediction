import { api } from './client'
import type { ApiResponse } from './client'

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
}
