import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial } from 'typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { PaginatedResponse, encodeCursor, decodeCursor } from '@app/common';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * Records an admin action to the audit log.
   * Every admin action must be recorded with timestamp, IP, and user ID per Spec 5.1.
   */
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

  /**
   * Retrieves audit logs for a specific user with cursor-based pagination.
   */
  async getLogsForUser(userId: string, limit = 50, cursor?: string) {
    const qb = this.auditRepo.createQueryBuilder('log')
      .where('log.userId = :userId', { userId })
      .orderBy('log.createdAt', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        const [createdAtStr, id] = decoded.split('|');
        qb.andWhere('(log.createdAt < :createdAt OR (log.createdAt = :createdAt AND log.id < :id))', {
          createdAt: new Date(createdAtStr),
          id,
        });
      }
    }

    const data = await qb.getMany();
    const hasNextPage = data.length > limit;
    if (hasNextPage) {
      data.pop();
    }

    let next_cursor: string | null = null;
    if (data.length > 0 && hasNextPage) {
      const last = data[data.length - 1];
      next_cursor = encodeCursor(`${last.createdAt.toISOString()}|${last.id}`);
    }

    const total_count = await this.auditRepo.count({ where: { userId } });
    return new PaginatedResponse(data, next_cursor, total_count, limit, data.length);
  }

  /**
   * Retrieves all audit logs (admin-level view) with offset pagination.
   * Keeping this as offset for now since it's an internal admin tool, 
   * but can be upgraded to cursor if needed.
   */
  async getAllLogs(limit = 50, offset = 0): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await this.auditRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['user'],
    });
    return { logs, total };
  }

  /**
   * Retrieves audit logs for a specific entity (e.g. incident) with cursor-based pagination.
   */
  async getLogsByEntity(entityType: string, entityId: string, limit = 50, cursor?: string) {
    const qb = this.auditRepo.createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where("log.metadata->>'entityType' = :entityType", { entityType })
      .andWhere("log.metadata->>'entityId' = :entityId", { entityId })
      .orderBy('log.createdAt', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        const [createdAtStr, id] = decoded.split('|');
        qb.andWhere('(log.createdAt < :createdAt OR (log.createdAt = :createdAt AND log.id < :id))', {
          createdAt: new Date(createdAtStr),
          id,
        });
      }
    }

    const data = await qb.getMany();
    const hasNextPage = data.length > limit;
    if (hasNextPage) {
      data.pop();
    }

    let next_cursor: string | null = null;
    if (data.length > 0 && hasNextPage) {
      const last = data[data.length - 1];
      next_cursor = encodeCursor(`${last.createdAt.toISOString()}|${last.id}`);
    }

    const total_count = await qb.getCount();
    return new PaginatedResponse(data, next_cursor, total_count, limit, data.length);
  }
}
