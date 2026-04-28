import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { StorageService, Epcr, EpcrSignature, SignerRole } from '../../../libs/common/src';
import { GenerateEpcrDto } from './dto/generate-epcr.dto';
import { SubmitSignatureDto } from './dto/submit-signature.dto';
import { jsPDF } from 'jspdf';

@Injectable()
export class EpcrServiceService {
  constructor(
    @InjectRepository(Epcr)
    private readonly epcrRepository: Repository<Epcr>,
    @InjectRepository(EpcrSignature)
    private readonly signatureRepository: Repository<EpcrSignature>,
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
      // In a real app, this would be > or < depending on order
      // query.id = cursor; 
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

  async addSignature(id: string, role: SignerRole, dto: SubmitSignatureDto) {
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
      const response = await fetch(
        `http://127.0.0.1:3001/v1/trips/${tripId}/bundle`,
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
