import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organisation, OrganisationStatus, SubscriptionPlan, AuditLogService } from '@app/common';
import { CreateOrganisationDto, UpdateOrganisationDto } from './dto/organisation.dto';

@Injectable()
export class AdminServiceService {
  constructor(
    @InjectRepository(Organisation)
    private readonly orgRepo: Repository<Organisation>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createOrganisation(dto: CreateOrganisationDto, adminId: string, ip: string) {
    const existing = await this.orgRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Organisation with name '${dto.name}' already exists`);

    const org = this.orgRepo.create(dto);
    await this.orgRepo.save(org);

    await this.auditLogService.log({
      userId: adminId,
      action: 'ORGANISATION_CREATED',
      ipAddress: ip,
      metadata: { orgId: org.id, name: org.name },
    });

    return org;
  }

  async findAllOrganisations() {
    return this.orgRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOneOrganisation(id: string) {
    const org = await this.orgRepo.findOneBy({ id });
    if (!org) throw new NotFoundException(`Organisation with ID ${id} not found`);
    return org;
  }

  async updateOrganisation(id: string, dto: UpdateOrganisationDto, adminId: string, ip: string) {
    const org = await this.findOneOrganisation(id);
    
    Object.assign(org, dto);
    await this.orgRepo.save(org);

    await this.auditLogService.log({
      userId: adminId,
      action: 'ORGANISATION_UPDATED',
      ipAddress: ip,
      metadata: { orgId: id, updates: dto },
    });

    return org;
  }

  async setOrganisationStatus(id: string, status: OrganisationStatus, adminId: string, ip: string) {
    const org = await this.findOneOrganisation(id);
    org.status = status;
    await this.orgRepo.save(org);

    await this.auditLogService.log({
      userId: adminId,
      action: 'ORGANISATION_STATUS_CHANGED',
      ipAddress: ip,
      metadata: { orgId: id, newStatus: status },
    });

    return org;
  }

  async getGlobalAuditLogs(limit: number, offset: number) {
    return this.auditLogService.getAllLogs(limit, offset);
  }

  async generateInvoice(orgId: string, adminId: string, ip: string) {
    const org = await this.findOneOrganisation(orgId);
    
    // Simulate billing logic based on plan
    const rates = {
      [SubscriptionPlan.BASIC]: 500,
      [SubscriptionPlan.PREMIUM]: 1500,
      [SubscriptionPlan.ENTERPRISE]: 5000,
    };

    const amount = rates[org.subscription_plan] || 0;
    const invoice = {
      invoiceId: `INV-${Date.now()}`,
      orgId,
      orgName: org.name,
      plan: org.subscription_plan,
      amount,
      currency: 'INR',
      status: 'DRAFT',
      generatedAt: new Date(),
    };

    await this.auditLogService.log({
      userId: adminId,
      action: 'INVOICE_GENERATED',
      ipAddress: ip,
      metadata: { orgId, invoiceId: invoice.invoiceId },
    });

    return invoice;
  }
}
