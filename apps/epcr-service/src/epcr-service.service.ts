import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, LessThan } from 'typeorm';
import { StorageService, Epcr, EpcrSignature, EpcrAcknowledgement, PrintJob, EpcrDeliveryLog, EpcrMlcRecord, EpcrExportJob, ExportJobStatus, SignerRole } from '../../../libs/common/src';
import { GenerateEpcrDto } from './dto/generate-epcr.dto';
import { SubmitSignatureDto } from './dto/submit-signature.dto';
import { AcknowledgeEpcrDto } from './dto/acknowledge-epcr.dto';
import { LinkMrnDto } from './dto/link-mrn.dto';
import { PrintEpcrDto } from './dto/print-epcr.dto';
import { SendEpcrDto } from './dto/send-epcr.dto';
import { CreateMlcRecordDto } from './dto/create-mlc.dto';
import { SetSpecialFlagsDto } from './dto/set-flags.dto';
import { ExportEpcrDto } from './dto/export-epcr.dto';
import { jsPDF } from 'jspdf';

@Injectable()
export class EpcrServiceService {
  constructor(
    @InjectRepository(Epcr)
    private readonly epcrRepository: Repository<Epcr>,
    @InjectRepository(EpcrSignature)
    private readonly signatureRepository: Repository<EpcrSignature>,
    @InjectRepository(EpcrAcknowledgement)
    private readonly acknowledgementRepository: Repository<EpcrAcknowledgement>,
    @InjectRepository(PrintJob)
    private readonly printJobRepository: Repository<PrintJob>,
    @InjectRepository(EpcrDeliveryLog)
    private readonly deliveryLogRepository: Repository<EpcrDeliveryLog>,
    @InjectRepository(EpcrMlcRecord)
    private readonly mlcRepository: Repository<EpcrMlcRecord>,
    @InjectRepository(EpcrExportJob)
    private readonly exportJobRepository: Repository<EpcrExportJob>,
    private readonly storageService: StorageService
  ) {}

  async generateEpcr(tripId: string, dto: GenerateEpcrDto, requestUser: any, authToken?: string) {
    try {
      const previewOnly = dto.preview_only || false;
      
      // 1. Fetch Mission Bundle (Internal call to dispatch-service)
      const bundle = await this.fetchMissionBundle(tripId, authToken);

      // 2. Generate Thermal Print (Text Format)
      const thermal = this.generateThermalSummary(bundle);

      // 3. Generate REAL PDF content using pdfkit
      const pdfBuffer = await this.generatePdfBuffer(bundle, previewOnly);

      // 4. Upload to S3
      const fileName = `${previewOnly ? 'preview_' : ''}epcr_${tripId}_${Date.now()}.pdf`;
      const { dbUrl, readUrl } = await this.storageService.uploadBuffer(
        pdfBuffer,
        'epcrs/',
        fileName,
        'application/pdf',
      );

      // 5. Save to Database
      const bundleData = bundle?.data || bundle;
      const trip = bundleData?.operational?.trip || {};
      const incident = trip?.incident || bundleData?.operational?.incident || {};
      const pt = bundleData?.clinical?.patient || (incident?.patients?.length > 0 ? incident.patients[0] : {});

      if (!previewOnly) {
        const epcr = this.epcrRepository.create({
          trip_id: tripId,
          patient_id: pt.id || null,
          hospital_id: trip.actual_hospital_id || trip.destination_hospital_id || null,
          pdf_url: dbUrl,
          thermal_payload: thermal,
          bundle_data: bundleData,
          triage_code: pt.triage_code || null,
          status: 'FINAL',
        });
        await this.epcrRepository.save(epcr);
      }

      return {
        data: {
          trip_id: tripId,
          status: previewOnly ? 'PREVIEW' : 'FINAL',
          thermal_payload: thermal,
          bundle,
        },
        pdf_url: readUrl,
      };
    } catch (error) {
      throw new BadRequestException(`ePCR Generation failed: ${error.message}`);
    }
  }

  async listEpcrs(filters: {
    trip_id?: string;
    patient_id?: string;
    hospital_id?: string;
    date_from?: string;
    date_to?: string;
    triage_code?: string;
    limit?: number;
    cursor?: string;
  }) {
    const { trip_id, patient_id, hospital_id, date_from, date_to, triage_code, limit = 20, cursor } = filters;

    const query: any = {};
    if (trip_id) query.trip_id = trip_id;
    if (patient_id) query.patient_id = patient_id;
    if (hospital_id) query.hospital_id = hospital_id;
    if (triage_code) query.triage_code = triage_code;

    if (date_from && date_to) {
      query.created_at = Between(new Date(date_from), new Date(date_to));
    } else if (date_from) {
      query.created_at = MoreThanOrEqual(new Date(date_from));
    } else if (date_to) {
      query.created_at = LessThanOrEqual(new Date(date_to));
    }

    // Simple cursor-based pagination
    if (cursor) {
      const cursorItem = await this.epcrRepository.findOne({ where: { id: cursor } });
      if (cursorItem) {
        query.created_at = LessThan(cursorItem.created_at);
      }
    }

    const [items, total] = await this.epcrRepository.findAndCount({
      where: query,
      order: { created_at: 'DESC' },
      take: limit,
    });

    return {
      data: items,
      meta: {
        total_count: total,
        limit,
        next_cursor: items.length === limit ? items[items.length - 1].id : null,
      },
    };
  }

  async getEpcrById(id: string) {
    const epcr = await this.epcrRepository.findOne({ 
      where: { id },
      relations: ['signatures'],
    });

    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    // Sign PDF URL
    epcr.pdf_url = await this.storageService.generatePresignedGetUrl(epcr.pdf_url);

    // Sign all signature URLs
    if (epcr.signatures && epcr.signatures.length > 0) {
      for (const sig of epcr.signatures) {
        sig.signature_url = await this.storageService.generatePresignedGetUrl(sig.signature_url);
      }
    }

    return { data: epcr };
  }

  async getEpcrPdfUrl(id: string) {
    const epcr = await this.epcrRepository.findOne({ where: { id } });
    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    const expiresInMinutes = 15;
    const signedUrl = await this.storageService.generatePresignedGetUrl(
      epcr.pdf_url,
      expiresInMinutes,
    );

    return {
      pdf_url: signedUrl,
      expires_at: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
    };
  }

  async getEpcrSection(id: string, sectionName: string) {
    const epcr = await this.epcrRepository.findOne({ where: { id } });
    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    const bundle = epcr.bundle_data;
    if (!bundle) {
      throw new BadRequestException('ePCR record has no associated data bundle');
    }

    let sectionData: any = null;

    switch (sectionName.toLowerCase()) {
      case 'trip':
        sectionData = bundle.operational?.trip;
        break;
      case 'incident':
        sectionData = bundle.operational?.incident || bundle.operational?.trip?.incident;
        break;
      case 'patient':
        sectionData = bundle.clinical?.patient || (bundle.operational?.trip?.incident?.patients?.[0]);
        break;
      case 'vitals':
      case 'assessments':
        sectionData = bundle.clinical?.assessments;
        break;
      case 'medications':
      case 'interventions':
        sectionData = bundle.clinical?.interventions;
        break;
      case 'signatures':
        const signatures = await this.signatureRepository.find({ where: { epcr_id: id } });
        for (const sig of signatures) {
          sig.signature_url = await this.storageService.generatePresignedGetUrl(sig.signature_url);
        }
        return { data: signatures };
      case 'meta':
        sectionData = bundle.meta;
        break;
      default:
        throw new BadRequestException(`Unknown section: ${sectionName}`);
    }

    if (!sectionData) {
      throw new NotFoundException(`Section ${sectionName} not found in this ePCR`);
    }

    return { data: sectionData };
  }

  async getSignaturesByEpcrId(id: string) {
    const signatures = await this.signatureRepository.find({ where: { epcr_id: id } });
    for (const sig of signatures) {
      sig.signature_url = await this.storageService.generatePresignedGetUrl(sig.signature_url);
    }
    return { data: signatures };
  }

  async addSignature(id: string, role: SignerRole, dto: any) {
    const epcr = await this.epcrRepository.findOne({ where: { id } });
    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    // 1. Upload signature image to S3
    const fileName = `sig_${role.toLowerCase()}_${id}_${Date.now()}.png`;
    const { dbUrl, readUrl } = await this.storageService.uploadBuffer(
      Buffer.from(dto.signature_image_base64.split(',')[1], 'base64'),
      'signatures/',
      fileName,
      'image/png',
    );

    // 2. Create signature record
    const signature = this.signatureRepository.create({
      epcr_id: id,
      signer_role: role,
      signer_id: dto.signer_id,
      signature_url: dbUrl,
      designation: dto.designation || null,
      gps_lat: dto.gps_lat,
      gps_lon: dto.gps_lon,
      timestamp: new Date(dto.timestamp),
    });

    await this.signatureRepository.save(signature);

    return {
      data: {
        ...signature,
        signature_url: readUrl, // Return signed URL for immediate use
      },
      epcr_status: epcr.status,
    };
  }

  // Wrappers for specific roles if needed, or just use addSignature directly
  async addEmtSignature(id: string, dto: SubmitSignatureDto) {
    return this.addSignature(id, SignerRole.EMT, dto);
  }

  async addDoctorSignature(id: string, dto: SubmitSignatureDto) {
    return this.addSignature(id, SignerRole.DOCTOR, dto);
  }

  async addPatientSignature(id: string, dto: SubmitSignatureDto) {
    return this.addSignature(id, SignerRole.PATIENT, dto);
  }

  async addClinicianSignature(id: string, dto: any) {
    const result = await this.addSignature(id, SignerRole.CLINICIAN, {
      ...dto,
      signer_id: dto.clinician_name,
    });

    // Update Epcr status to COMPLETE
    await this.epcrRepository.update(id, { status: 'COMPLETE' });

    return {
      ...result,
      epcr_status: 'COMPLETE',
    };
  }

  async acknowledgeEpcr(id: string, dto: AcknowledgeEpcrDto) {
    const epcr = await this.epcrRepository.findOne({ where: { id } });
    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    const acknowledgement = this.acknowledgementRepository.create({
      epcr_id: id,
      acknowledged_by: dto.acknowledged_by,
      department: dto.department,
      timestamp: new Date(dto.timestamp),
    });

    await this.acknowledgementRepository.save(acknowledgement);

    return {
      data: acknowledgement,
    };
  }

  async getAcknowledgementByEpcrId(id: string) {
    const acknowledgement = await this.acknowledgementRepository.findOne({ where: { epcr_id: id } });
    if (!acknowledgement) {
      throw new NotFoundException(`Acknowledgement for ePCR with ID ${id} not found`);
    }
    return { data: acknowledgement };
  }

  async linkMrn(id: string, dto: LinkMrnDto) {
    const epcr = await this.epcrRepository.findOne({ where: { id } });
    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    await this.epcrRepository.update(id, {
      mrn: dto.mrn,
      hmis_record_id: dto.hmis_record_id || undefined,
    });

    const updated = await this.epcrRepository.findOne({ where: { id } });
    return { data: updated };
  }

  async triggerPrintJob(id: string, dto: PrintEpcrDto) {
    const epcr = await this.epcrRepository.findOne({ where: { id } });
    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    const printJob = this.printJobRepository.create({
      epcr_id: id,
      printer_device_id: dto.printer_device_id,
      status: 'PENDING',
    });

    await this.printJobRepository.save(printJob);

    return {
      data: printJob,
    };
  }

  async getPrintJobStatus(id: string, printJobId: string) {
    const printJob = await this.printJobRepository.findOne({
      where: { id: printJobId, epcr_id: id },
    });

    if (!printJob) {
      throw new NotFoundException(`Print job with ID ${printJobId} not found for ePCR ${id}`);
    }

    return { data: printJob };
  }

  async sendEpcr(id: string, dto: SendEpcrDto) {
    const epcr = await this.epcrRepository.findOne({ where: { id } });
    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    const signedPdfUrl = await this.storageService.generatePresignedGetUrl(epcr.pdf_url, 1440); // 24 hours

    const deliveryStatuses: any[] = [];

    for (const recipient of dto.recipients) {
      for (const channel of dto.channels) {
        // Simulation of sending via notification-service or direct provider
        // In a real scenario, we would call notificationService.send(...)
        
        const log = this.deliveryLogRepository.create({
          epcr_id: id,
          channel,
          recipient: recipient.contact,
          recipient_type: recipient.type,
          status: 'SENT',
        });
        await this.deliveryLogRepository.save(log);

        deliveryStatuses.push(log);
      }
    }

    return deliveryStatuses;
  }

  async getDeliveryLogs(id: string) {
    const logs = await this.deliveryLogRepository.find({
      where: { epcr_id: id },
      order: { timestamp: 'DESC' },
    });
    return { data: logs };
  }

  async createMlcRecord(id: string, dto: CreateMlcRecordDto) {
    const epcr = await this.epcrRepository.findOne({ where: { id } });
    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    const mlc = this.mlcRepository.create({
      ...dto,
      epcr_id: id,
      intimation_time: new Date(dto.intimation_time),
    });

    await this.mlcRepository.save(mlc);

    // Automatically add MLC flag to ePCR if not already present
    if (!epcr.special_flags.includes('MLC')) {
      epcr.special_flags.push('MLC');
      await this.epcrRepository.save(epcr);
    }

    return { data: mlc };
  }

  async getMlcRecord(id: string) {
    const mlc = await this.mlcRepository.findOne({ where: { epcr_id: id } });
    if (!mlc) {
      throw new NotFoundException(`MLC record for ePCR ID ${id} not found`);
    }
    return { data: mlc };
  }

  async setSpecialFlags(id: string, dto: SetSpecialFlagsDto) {
    const epcr = await this.epcrRepository.findOne({ where: { id } });
    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    if (!epcr.special_flags.includes(dto.flag)) {
      epcr.special_flags.push(dto.flag);
      // Update bundle_data as well if needed for reporting
      if (!epcr.bundle_data) epcr.bundle_data = {};
      if (!epcr.bundle_data.meta) epcr.bundle_data.meta = {};
      if (!epcr.bundle_data.meta.flags) epcr.bundle_data.meta.flags = [];
      epcr.bundle_data.meta.flags.push({
        flag: dto.flag,
        timestamp: dto.timestamp,
        notes: dto.notes,
      });

      await this.epcrRepository.save(epcr);
    }

    return { data: epcr };
  }

  async getEpcrHash(id: string) {
    const epcr = await this.epcrRepository.findOne({ where: { id } });
    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    try {
      const pdfBuffer = await this.storageService.downloadBuffer(epcr.pdf_url);
      const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      return {
        hash_sha256: hash,
        generated_at: new Date().toISOString(),
        pdf_url: await this.storageService.generatePresignedGetUrl(epcr.pdf_url),
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to generate hash: ${error.message}`);
    }
  }

  async triggerExportJob(id: string, dto: ExportEpcrDto) {
    const epcr = await this.epcrRepository.findOne({ where: { id } });
    if (!epcr) {
      throw new NotFoundException(`ePCR record with ID ${id} not found`);
    }

    const job = this.exportJobRepository.create({
      epcr_id: id,
      status: ExportJobStatus.PENDING,
      metadata: dto,
    });

    await this.exportJobRepository.save(job);

    // In a real production system, this would be offloaded to a background worker (e.g., BullMQ)
    // For this implementation, we'll start it asynchronously
    this.processExportJob(job.id, id, dto);

    return { data: job };
  }

  async getExportJobStatus(jobId: string) {
    const job = await this.exportJobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Export job with ID ${jobId} not found`);
    }

    if (job.download_url) {
      job.download_url = await this.storageService.generatePresignedGetUrl(job.download_url);
    }

    return { data: job };
  }

  private async processExportJob(jobId: string, epcrId: string, dto: ExportEpcrDto) {
    try {
      await this.exportJobRepository.update(jobId, { status: ExportJobStatus.PROCESSING });

      const epcr = await this.epcrRepository.findOne({ 
        where: { id: epcrId },
        relations: ['signatures']
      });

      if (!epcr) throw new Error('ePCR not found during export');

      // 1. Gather all files
      const pdfBuffer = await this.storageService.downloadBuffer(epcr.pdf_url);
      const metadataJson = JSON.stringify({
        epcr: epcr,
        bundle: epcr.bundle_data,
        exported_at: new Date().toISOString(),
      }, null, 2);

      // 2. ZIP Creation (Simulation)
      // Since we don't have a ZIP library installed, we'll simulate the upload of a "bundle"
      // In a real app: const zipBuffer = await createZip(pdfBuffer, metadataJson, signatures...)
      
      const zipFileName = `export_${epcrId}_${Date.now()}.zip`;
      
      // MOCK: We'll just upload the PDF as the "export" for now to demonstrate the flow
      // until a zipping library like 'archiver' or 'jszip' is added to package.json
      const { dbUrl } = await this.storageService.uploadBuffer(
        pdfBuffer, 
        'exports/', 
        zipFileName, 
        'application/zip'
      );

      await this.exportJobRepository.update(jobId, {
        status: ExportJobStatus.COMPLETED,
        download_url: dbUrl,
      });

    } catch (error) {
      console.error('Export Job Failed:', error);
      await this.exportJobRepository.update(jobId, {
        status: ExportJobStatus.FAILED,
        error_message: error.message,
      });
    }
  }

  private async generatePdfBuffer(bundle: any, isPreview: boolean): Promise<Buffer> {
    const bundleData = bundle?.data || bundle;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // --- COLOR PALETTE ---
    const primaryColor = [25, 118, 210]; // Blue
    const secondaryColor = [245, 245, 245]; // Light Grey
    const accentColor = [211, 47, 47]; // Red (for preview)

    // --- HEADER SECTION ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('TELE-EMS', 20, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Electronic Patient Care Report (ePCR)', 20, 28);
    
    // Preview Watermark
    if (isPreview) {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(30);
      doc.setFont('helvetica', 'bold');
      doc.text('PREVIEW', pageWidth - 70, 25, { angle: 0 });
    }
    
    y = 50;

    // --- 1. MISSION INFORMATION ---
    const trip = bundleData?.operational?.trip || {};
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageWidth - 20, y);
    y += 8;

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. MISSION INFORMATION', 20, y);
    y += 10;

    // Grid Layout for Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Trip ID:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(trip.id || 'N/A'), 50, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', 110, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(trip.status || 'N/A'), 140, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Date/Time:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(trip.dispatched_at ? new Date(trip.dispatched_at).toLocaleString() : 'N/A', 50, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Vehicle:', 110, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(trip.vehicle_id || 'N/A'), 140, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Org ID:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(bundleData?.meta?.organisation_id || 'N/A'), 50, y);
    y += 15;

    // --- 2. PATIENT INFORMATION ---
    const incident = trip?.incident || bundleData?.operational?.incident || {};
    const pt = bundleData?.clinical?.patient || (incident?.patients?.length > 0 ? incident.patients[0] : {});
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.line(20, y, pageWidth - 20, y);
    y += 8;

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. PATIENT INFORMATION', 20, y);
    y += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Full Name:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(pt.name || 'UNKNOWN', 50, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Age:', 110, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(pt.age || 'N/A'), 140, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Gender:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(pt.gender || 'N/A'), 50, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Triage:', 110, y);
    doc.setFontSize(12);
    doc.setTextColor(pt.triage_code === 'RED' ? 200 : 0, 0, 0); // Stylize RED triage
    doc.text(String(pt.triage_code || 'N/A'), 140, y);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    y += 15;

    // --- 3. CLINICAL ASSESSMENT ---
    const assessments = bundleData?.clinical?.assessments || [];
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.line(20, y, pageWidth - 20, y);
    y += 8;

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. CLINICAL ASSESSMENT SUMMARY', 20, y);
    y += 10;

    if (assessments.length > 0) {
      // Table Header
      doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.rect(20, y, pageWidth - 40, 8, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('TIME', 25, y + 5);
      doc.text('BP (mmHg)', 60, y + 5);
      doc.text('HR (bpm)', 100, y + 5);
      doc.text('SpO2 (%)', 140, y + 5);
      doc.text('RR', 170, y + 5);
      y += 10;

      doc.setFont('helvetica', 'normal');
      assessments.forEach((record: any, index: number) => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.text(record.taken_at ? new Date(record.taken_at).toLocaleTimeString() : 'N/A', 25, y);
        doc.text(`${record.bp_systolic || '-'}/${record.bp_diastolic || '-'}`, 60, y);
        doc.text(String(record.heart_rate || '-'), 100, y);
        doc.text(String(record.spo2 || '-'), 140, y);
        doc.text(String(record.respiratory_rate || '-'), 170, y);
        y += 7;
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.text('No clinical assessments recorded for this mission.', 20, y);
      y += 10;
    }

    // --- FOOTER SECTION ---
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 275, pageWidth - 20, 275);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(`System Generated Report | TeleEMS Platform | Request ID: ${bundleData?.meta?.request_id || 'N/A'}`, pageWidth / 2, 282, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleString()} | Page 1 of 1`, pageWidth / 2, 287, { align: 'center' });

    return Buffer.from(doc.output('arraybuffer'));
  }

  private async fetchMissionBundle(tripId: string, authToken?: string) {
    try {
      const dispatchBaseUrl = process.env.DISPATCH_SERVICE_URL || 'http://localhost:3002';
      const response = await fetch(
        `${dispatchBaseUrl}/v1/trips/${tripId}/bundle`,
        {
          headers: { 
            Authorization: authToken || 'Internal-Secret-123' 
          },
        },
      );
      if (!response.ok) throw new Error(`Failed to fetch mission bundle: ${response.status} ${response.statusText}`);
      const json = await response.json();
      return json.data;
    } catch (error) {
      throw new BadRequestException(
        `Data aggregation failed: ${error.message}`,
      );
    }
  }

  private generateThermalSummary(bundle: any): string {
    const bundleData = bundle?.data || bundle;
    const trip = bundleData?.operational?.trip || {};
    const incident = trip?.incident || bundleData?.operational?.incident || {};
    const pt = bundleData?.clinical?.patient || (incident?.patients?.length > 0 ? incident.patients[0] : {});
    const assessments = bundleData?.clinical?.assessments || [];

    return `
TELEEMS REPORT
--------------
TRIP: ${String(trip.id || 'UNKNOWN').slice(0, 8)}
DATE: ${trip.dispatched_at ? new Date(trip.dispatched_at).toLocaleDateString() : 'N/A'}
UNIT: ${trip.vehicle_id || 'N/A'}

PATIENT: ${pt.name || 'UNKNOWN'}
TRIAGE: ${pt.triage_code || '-'}

LAST VITALS:
BP: ${assessments[0]?.bp_systolic || '-'}/${assessments[0]?.bp_diastolic || '-'}
HR: ${assessments[0]?.heart_rate || '-'}
SPO2: ${assessments[0]?.spo2 || '-'}%

HANDOFF COMPLETE
----------------
    `.trim();
  }
}
