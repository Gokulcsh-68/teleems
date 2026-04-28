import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { RtvsRecord } from './entities/rtvs-record.entity';
import {
  SubmitVitalsDto,
  BulkSubmitVitalsDto,
  GetVitalsQueryDto,
  GetVitalsTrendQueryDto,
} from './dto/submit-vitals.dto';
import { RedisService } from '../../../libs/common/src';

@Injectable()
export class RtvsServiceService {
  constructor(
    @InjectRepository(RtvsRecord)
    private readonly rtvsRecordRepository: Repository<RtvsRecord>,
    private readonly redisService: RedisService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async submitVitals(
    dto: SubmitVitalsDto,
    user: any,
  ) {
    const { incident_id, patient_id } = dto;
    const organisationId = user.org_id || user.organisationId;

    const record = this.rtvsRecordRepository.create({
      timestamp: new Date(dto.timestamp),
      organisationId,
      incidentId: incident_id,
      patientId: patient_id,
      vitals: {
        spo2: dto.spo2,
        hr: dto.hr,
        bp_sys: dto.bp_sys,
        bp_dia: dto.bp_dia,
        bp_map: dto.bp_map,
        temp_celsius: dto.temp_celsius,
        rbs_mg_dl: dto.rbs_mg_dl,
        hct: dto.hct,
        hgb: dto.hgb,
        etco2: dto.etco2,
        ecg_lead: dto.ecg_lead,
        source: dto.source,
      },
    });

    const savedRecord = await this.rtvsRecordRepository.save(record);

    // Stream the update via Redis for real-time dashboarding
    await this.redisService.publish(`vitals:stream:${patient_id}`, dto);

    return {
      data: savedRecord,
      alerts: [], // Future: Implementation of clinical alert logic
    };
  }

  async submitBulkVitals(dto: BulkSubmitVitalsDto, user: any) {
    const { incident_id, patient_id, readings } = dto;
    const organisationId = user.org_id || user.organisationId;

    let accepted = 0;
    let rejected = 0;
    const errors: string[] = [];
    const records: RtvsRecord[] = [];

    for (const reading of readings) {
      try {
        const record = this.rtvsRecordRepository.create({
          timestamp: new Date(reading.timestamp),
          organisationId,
          incidentId: incident_id,
          patientId: patient_id,
          vitals: {
            spo2: reading.spo2,
            hr: reading.hr,
            bp_sys: reading.bp_sys,
            bp_dia: reading.bp_dia,
            bp_map: reading.bp_map,
            temp_celsius: reading.temp_celsius,
            rbs_mg_dl: reading.rbs_mg_dl,
            hct: reading.hct,
            hgb: reading.hgb,
            etco2: reading.etco2,
            ecg_lead: reading.ecg_lead,
            source: reading.source,
          },
        });
        records.push(record);
        accepted++;
      } catch (err) {
        rejected++;
        errors.push(err.message);
      }
    }

    if (records.length > 0) {
      await this.rtvsRecordRepository.save(records);

      // Stream the updates via Redis
      for (const reading of readings) {
        await this.redisService.publish(`vitals:stream:${patient_id}`, {
          patient_id,
          incident_id,
          ...reading,
        });
      }
    }

    return {
      data: {
        accepted,
        rejected,
        errors,
      },
    };
  }

  async getHistoricalVitals(
    incidentId: string,
    patientId: string,
    query: GetVitalsQueryDto,
    user?: any,
  ) {
    const where: any = { incidentId, patientId };

    if (query.from && query.to) {
      where.timestamp = Between(new Date(query.from), new Date(query.to));
    } else if (query.from) {
      where.timestamp = MoreThanOrEqual(new Date(query.from));
    } else if (query.to) {
      where.timestamp = LessThanOrEqual(new Date(query.to));
    }

    const records = await this.rtvsRecordRepository.find({
      where,
      order: { timestamp: 'ASC' },
    });

    if (user) {
      const roles = user.roles || [];
      const isPlatformAdmin = roles.some((r: string) =>
        ['CureSelect Admin', 'CURESELECT_ADMIN', 'CCE'].includes(r),
      );

      if (!isPlatformAdmin) {
        const userOrgId = user.organisationId || user.org_id;
        if (records.length > 0 && records[0].organisationId !== userOrgId) {
          throw new ForbiddenException('Access to these vitals is denied');
        }
      }
    }

    if (!query.interval || records.length === 0) {
      return { data: records };
    }

    // Basic downsampling logic
    const intervalMs = this.parseInterval(query.interval);
    if (intervalMs <= 0) return { data: records };

    const downsampled: RtvsRecord[] = [];
    let lastBucketTime = -1;

    for (const record of records) {
      const bucketTime =
        Math.floor(record.timestamp.getTime() / intervalMs) * intervalMs;
      if (bucketTime !== lastBucketTime) {
        downsampled.push(record);
        lastBucketTime = bucketTime;
      }
    }

    return { data: downsampled };
  }

  async getLatestVitals(incidentId: string, patientId: string, user: any) {
    const record = await this.rtvsRecordRepository.findOne({
      where: { incidentId, patientId },
      order: { timestamp: 'DESC' },
    });

    if (!record) {
      throw new NotFoundException('No vitals records found for this patient');
    }

    const roles = user.roles || [];
    const isPlatformAdmin = roles.some((r: string) =>
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'CCE'].includes(r),
    );

    if (!isPlatformAdmin) {
      const userOrgId = user.organisationId || user.org_id;
      if (record.organisationId !== userOrgId) {
        throw new ForbiddenException('Access to these vitals is denied');
      }
    }

    return { data: record };
  }

  async getVitalsTrend(
    incidentId: string,
    patientId: string,
    query: GetVitalsTrendQueryDto,
    user: any,
  ) {
    const where: any = { incidentId, patientId };
    if (query.from && query.to) {
      where.timestamp = Between(new Date(query.from), new Date(query.to));
    }

    const records = await this.rtvsRecordRepository.find({
      where,
      order: { timestamp: 'ASC' },
    });

    if (records.length === 0) return { data: [] };

    // Isolation check
    const roles = user.roles || [];
    const isPlatformAdmin = roles.some((r: string) =>
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'CCE'].includes(r),
    );

    if (!isPlatformAdmin) {
      const userOrgId = user.organisationId || user.org_id;
      if (records[0].organisationId !== userOrgId) {
        throw new ForbiddenException('Access to these vitals is denied');
      }
    }

    const intervalMs = this.parseInterval(query.granularity);
    if (intervalMs <= 0) return { data: records };

    const buckets: Map<number, RtvsRecord[]> = new Map();
    for (const record of records) {
      const bucketTime =
        Math.floor(record.timestamp.getTime() / intervalMs) * intervalMs;
      if (!buckets.has(bucketTime)) buckets.set(bucketTime, []);
      buckets.get(bucketTime)!.push(record);
    }

    const trend = Array.from(buckets.entries()).map(
      ([timestamp, bucketRecords]) => {
        const avg: any = { timestamp: new Date(timestamp) };
        const fields = [
          'spo2',
          'hr',
          'bp_sys',
          'bp_dia',
          'bp_map',
          'temp_celsius',
          'rbs_mg_dl',
          'hct',
          'hgb',
          'etco2',
        ];

        fields.forEach((field) => {
          const values = bucketRecords
            .map((r) => r.vitals[field])
            .filter((v) => v !== undefined && v !== null);
          if (values.length > 0) {
            avg[field] = values.reduce((a, b) => a + b, 0) / values.length;
          }
        });

        return avg;
      },
    );

    return { data: trend };
  }

  private parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)(s|m|min|h)$/);
    if (!match) return 0;
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
      case 'min':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      default:
        return 0;
    }
  }
}
