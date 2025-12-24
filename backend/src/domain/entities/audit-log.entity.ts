export class AuditLog {
  constructor(
    public readonly id: string,
    public readonly adminId: string,
    public readonly action: string,
    public readonly details: string | null,
    public readonly entityType: string | null,
    public readonly entityId: string | null,
    public readonly createdAt: Date,
    public readonly adminEmail?: string, // Optional joined field
  ) { }
}
