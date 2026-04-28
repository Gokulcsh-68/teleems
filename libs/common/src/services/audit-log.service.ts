import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { PaginatedResponse } from '../pagination/paginated-response';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async log(params: {
    userId: string;
    action: string;
    ipAddress: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<AuditLog> {
    const data: DeepPartial<AuditLog> = {
      userId: params.userId,
      action: params.action,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent || undefined,
      metadata: params.metadata || undefined,
    };
    const entry = this.auditRepo.create(data);
    return this.auditRepo.save(entry);
  }

  async getLogsForUser(userId: string, limit = 50, offset = 0) {
    const [data, total] = await this.auditRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async getAllLogs(
    limit = 50,
    offset = 0,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await this.auditRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { logs, total };
  }

  async getLogsByEntity(
    entityType: string,
    entityId: string,
    limit = 50,
    cursor?: string,
  ) {
    const query = this.auditRepo
      .createQueryBuilder('log')
      .where("log.metadata->>'entityType' = :entityType", { entityType })
      .andWhere("log.metadata->>'entityId' = :entityId", { entityId });

    if (cursor) {
      query.andWhere('log.createdAt < :cursor', { cursor: new Date(cursor) });
    }

    const logs = await query
      .orderBy('log.createdAt', 'DESC')
      .take(limit)
      .getMany();

    return { data: logs, limit, cursor };
  }
}
