import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { StorageService } from '../../../libs/common/src';

@Injectable()
export class EpcrServiceService {
  constructor(
    private readonly storageService: StorageService,
  ) {}

  async generateEpcr(tripId: string, requestUser: any) {
    // 1. Fetch Mission Bundle (Internal call to dispatch-service)
    // Note: In a real microservice setup, we'd use HttpService. 
    // For this monorepo implementation, we'll simulate the data aggregation or assume the call succeeds.
    
    // TODO: Implement real HTTP call to localhost:3002/v1/trips/:id/bundle
    const bundle = await this.fetchMissionBundle(tripId);

    // 2. Generate Thermal Print (Text Format)
    const thermal = this.generateThermalSummary(bundle);

    // 3. Generate PDF (Simulated/Placeholder for now as PDF libs need installation)
    // In production, we'd use pdfkit or puppeteer.
    const pdfContent = `--- TeleEMS ePCR ---\nTrip: ${tripId}\nPatient: ${bundle.clinical.patient?.name || 'Unknown'}\n...`;
    
    // 4. Upload to S3
    const fileName = `epcr_${tripId}_${Date.now()}.pdf`;
    const s3Url = await this.storageService.uploadBase64(
      Buffer.from(pdfContent).toString('base64'),
      'epcrs/',
      fileName
    );

    return {
      data: {
        trip_id: tripId,
        s3_url: s3Url,
        thermal_payload: thermal
      }
    };
  }

  private async fetchMissionBundle(tripId: string) {
    // This is a placeholder for the cross-service call.
    // In this local environment, we assume the caller provides valid data or we'd use axios/got.
    try {
        const response = await fetch(`http://localhost:3002/v1/trips/${tripId}/bundle`, {
            headers: { 'Authorization': 'Internal-Secret-123' } // Simulated internal auth
        });
        if (!response.ok) throw new Error('Failed to fetch mission bundle');
        const json = await response.json();
        return json.data;
    } catch (error) {
        throw new InternalServerErrorException(`Data aggregation failed: ${error.message}`);
    }
  }

  private generateThermalSummary(bundle: any): string {
    const trip = bundle.operational.trip;
    const pt = bundle.clinical.patient;
    
    return `
TELEEMS REPORT
--------------
TRIP: ${trip.id.slice(0,8)}
DATE: ${new Date(trip.dispatched_at).toLocaleDateString()}
UNIT: ${trip.vehicle_id}

PATIENT: ${pt?.name || 'UNKNOWN'}
TRIAGE: ${pt?.triage_code || '-'}

LAST VITALS:
BP: ${bundle.clinical.assessments[0]?.bp_systolic || '-'}/${bundle.clinical.assessments[0]?.bp_diastolic || '-'}
HR: ${bundle.clinical.assessments[0]?.heart_rate || '-'}
SPO2: ${bundle.clinical.assessments[0]?.spo2 || '-'}%

HANDOFF COMPLETE
----------------
    `.trim();
  }
}
