import * as crypto from 'crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TeleLinkSession,
  TeleLinkSessionStatus,
  Dispatch,
  Incident,
  PatientProfile,
  User,
  CureselectApiService,
} from '@app/common';
import {
  CreateTeleLinkSessionDto,
  CreateDoctorConsultDto,
  UpdateTeleLinkStatusDto,
  AddClinicalNotesDto,
  RescheduleTeleLinkSessionDto,
  CancelTeleLinkSessionDto,
  EscalateSessionDto,
  ToggleRecordingDto,
} from './dto';
import { TelelinkGateway } from './telelink.gateway';

@Injectable()
export class TelelinkService {
  private readonly logger = new Logger(TelelinkService.name);

  constructor(
    @InjectRepository(TeleLinkSession)
    private readonly sessionRepo: Repository<TeleLinkSession>,
    @InjectRepository(Dispatch)
    private readonly dispatchRepo: Repository<Dispatch>,
    @InjectRepository(Incident)
    private readonly incidentRepo: Repository<Incident>,
    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cureselectApi: CureselectApiService,
    private readonly config: ConfigService,
    private readonly gateway: TelelinkGateway,
  ) {}

  private formatDate(date: Date): string {
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    return (
      date.getFullYear() +
      '-' +
      pad(date.getMonth() + 1) +
      '-' +
      pad(date.getDate()) +
      ' ' +
      pad(date.getHours()) +
      ':' +
      pad(date.getMinutes()) +
      ':' +
      pad(date.getSeconds())
    );
  }


  private transformToConsult(session: TeleLinkSession) {
    const statusMap = {
      [TeleLinkSessionStatus.ACTIVE]: { id: 3, name: 'Waiting', slug: 'waiting' },
      [TeleLinkSessionStatus.COMPLETED]: { id: 6, name: 'Completed', slug: 'completed' },
      [TeleLinkSessionStatus.CANCELLED]: { id: 11, name: 'Cancelled', slug: 'cancelled' },
    };

    const status =
      statusMap[session.status] || statusMap[TeleLinkSessionStatus.ACTIVE];

    // Reconstruct basic participants from available local info
    const participants: any[] = [];
    if (session.initiator_id) {
      participants.push({
        id: Math.floor(Math.random() * 10000),
        role: 'subscriber',
        ref_number: String(session.initiator_id),
        participant_info: {
          name: 'Staff / Initiator',
          additional_info: { x_name: 'teleems' },
        },
        token: session.room_token,
        participant_status: { id: 8, name: 'In Call', slug: 'in_call' },
      });
    }

    return {
      id: parseInt(session.room_id) || session.id,
      consult_current_status: status,
      consult_status: status,
      consult_entity_id: { id: 10, name: 'Ended', slug: 'ended' },
      scheduled_at: this.formatDate(session.scheduled_at || session.started_at),
      consult_code: session.room_id,
      consult_type: 'virtual',
      consult_data: {
        tokbox: {
          meeting_id: session.room_id,
        },
      },
      additional_info: {
        ...session.additional_info,
        organization_id: parseInt(session.organisationId) || session.organisationId,
        trip_id: session.trip_id,
        incident_id: session.incident_id,
      },
      started_at: this.formatDate(session.started_at),
      ended_at: session.ended_at ? this.formatDate(session.ended_at) : null,
      reason: session.reason,
      virtual_service_provider: {
        id: 12,
        name: 'Tokbox',
        slug: 'tokbox',
      },
      active: session.status === TeleLinkSessionStatus.ACTIVE,
      created_at: this.formatDate(session.started_at),
      participants: participants,
      payment: [],
      editConsult: true,
    };
  }

  async getHospitalDoctors(hospitalId: string) {
    this.logger.log(`Fetching available doctors for hospital: ${hospitalId}`);
    const doctors = await this.userRepo.find({
      where: { 
        hospitalId,
        status: 'ACTIVE' 
      },
      select: ['id', 'name', 'roles', 'designation', 'isAvailable', 'profileImage'],
    });

    this.logger.log(`Found ${doctors.length} active users at hospital. Filtering for clinical roles...`);

    // Filter by role manually to handle simple-array with partial matches
    const clinicalDoctors = doctors.filter(
      (u) =>
        u.roles.some(r => 
          r.includes('Doctor') || 
          r.includes('ERCP') || 
          r.includes('Specialist') || 
          r.includes('Physician')
        )
    );

    this.logger.log(`Returning ${clinicalDoctors.length} clinical doctors.`);
    return clinicalDoctors;
  }

  async createSession(dto: CreateTeleLinkSessionDto, user: any) {
    try {
      this.logger.log(`Initiating TeleLink session for Trip: ${dto.trip_id}`);

      // 1. Validation & Data Fetching
      console.time(`[PERF] Data Lookups (Trip: ${dto.trip_id})`);
      const [trip, initiator, incident] = await Promise.all([
        this.dispatchRepo.findOneBy({ id: dto.trip_id }),
        this.userRepo.findOneBy({ id: user.userId }),
        this.incidentRepo.findOneBy({ id: dto.incident_id }),
      ]);
      console.timeEnd(`[PERF] Data Lookups (Trip: ${dto.trip_id})`);

      if (!trip) throw new NotFoundException('Trip not found');
      if (!initiator)
        throw new UnauthorizedException('Initiator user not found');
      if (!incident) throw new NotFoundException('Incident not found');

      // 1.1 Handle Hospital Targeting
      const targetHospitalId = dto.target_hospital_id || trip.destination_hospital_id;
      if (targetHospitalId) {
        this.logger.log(`Targeting TeleLink to Hospital: ${targetHospitalId}`);
      }

      // Automatically pick the first patient from the incident for the consult
      const primaryPatientData =
        incident.patients && incident.patients.length > 0
          ? incident.patients[0]
          : null;

      // Verify if the patient has a persistent profile in our DB to avoid FK violation
      const patientProfile = primaryPatientData?.id
        ? await this.patientRepo.findOneBy({ id: primaryPatientData.id })
        : null;

      // 1.2 Fetch Professional (Doctor) if targeted
      const professional = dto.professional_id 
        ? await this.userRepo.findOneBy({ id: dto.professional_id })
        : null;

      // 2. Prepare Payload
      const now = new Date();
      const formattedDate = this.formatDate(now);

      const remotePayload = {
        consult_date_time: formattedDate,
        scheduled_at: formattedDate,
        consult_reason: dto.sos_flag
          ? 'EMERGENCY - SOS'
          : 'Paramedic Consultation',
        consult_type: 'virtual',
        service_provider: 'tokbox',
        virtual_service_provider: 'tokbox',
        category_id: this.config.get<string>('CURESELECT_CATEGORY_ID') || '2',
        provider: professional ? {
          id: professional.id,
          name: professional.name,
          email: professional.email,
          phone: professional.phone,
          profile_pic: professional.profileImageUrl,
          additional_info: { role: 'doctor', x_name: 'teleems' },
        } : {
          // Fallback if no specific doctor targeted yet (e.g. broadcast)
          id: 'DOCTOR_WAITING',
          name: 'Hospital Specialist',
          email: 'doctor@teleems.in',
          phone: '0000000000',
          additional_info: { role: 'doctor', x_name: 'teleems' },
        },
        patient: {
          id: patientProfile?.id || primaryPatientData?.id || initiator.id,
          name: patientProfile?.name || primaryPatientData?.name || initiator.name,
          phone: patientProfile?.phone || initiator.phone || '',
          email: initiator.email,
          additional_info: { 
            x_name: 'teleems',
            emt_id: initiator.id,
            emt_name: initiator.name
          },
        },
        additional_info: {
          trip_id: dto.trip_id,
          incident_id: dto.incident_id,
          sos_flag: dto.sos_flag,
          x_name: 'teleems',
          organisation_id: user.organisationId,
          professional_id: dto.professional_id,
        },
      };

      // 3. Call Remote Cureselect API
      let remoteResponse:any;
      console.time(`[PERF] TeleConsult Remote API (Trip: ${dto.trip_id})`);
      try {
        console.log("remotePayload", remotePayload);
        remoteResponse = await this.cureselectApi.createConsult(remotePayload);
        console.log("remoteResponse", remoteResponse);
      } catch (err: any) {
        const msg = `External TeleConsult API Error: ${err.message}`;
        this.logger.error(msg);
        throw new BadGatewayException(msg);
      }
      console.timeEnd(`[PERF] TeleConsult Remote API (Trip: ${dto.trip_id})`);

      // 4. Extract consult data from Cureselect response
      const consultData = remoteResponse?.data?.consults || remoteResponse?.data || {};

      const roomId =
        remoteResponse?.consult_id ||
        consultData?.id ||
        remoteResponse?.data?.id ||
        `local_${Date.now()}`;

      const roomBaseUrl = this.config.get<string>('CURESELECT_ROOM_BASE_URL') || 'https://teleconsult.a2zhealth.in/room';
      
      // Role-Based Participant Discovery
      const info = remoteResponse?.data?.info;
      const participantsList = remoteResponse?.data?.participants || [];
      
      // Find the subscriber (The EMT)
      const subscriber = (info?.role === 'subscriber' || String(info?.ref_number) === String(initiator.id)) 
        ? info 
        : participantsList.find((p: any) => p.role === 'subscriber' || String(p.ref_number) === String(initiator.id));
        
      // Final ID Selection: Remote ID -> info.id -> initiator.id (as absolute fallback)
      const participantId = subscriber?.id || info?.id || initiator.id;
      
      // Construct URL
      const roomUrl =
        remoteResponse?.room_url || `${roomBaseUrl}/${roomId}/subscriber/${participantId}`;

      const roomToken =
        subscriber?.token ||
        remoteResponse?.data?.token ||
        remoteResponse?.data?.participants?.[0]?.token ||
        remoteResponse?.room_token ||
        'MOCK_TOKEN';

      const session = this.sessionRepo.create({
        trip_id: dto.trip_id,
        incident_id: dto.incident_id,
        patient_id: patientProfile?.id || undefined,
        target_hospital_id: targetHospitalId || undefined,
        sos_flag: dto.sos_flag || false,
        initiator_role: 'EMT',
        status: TeleLinkSessionStatus.ACTIVE,
        organisationId: incident.organisationId || initiator.organisationId,
        room_id: String(roomId),
        room_url: roomUrl,
        room_token: roomToken,
        started_at: new Date(),
        scheduled_at: dto.scheduled_at ? new Date(dto.scheduled_at) : new Date(),
        reason: dto.consult_reason,
        initiator_id: initiator.id,
        professional_id: dto.professional_id,
      });

      this.sessionRepo
        .save(session)
        .then((saved) => {
          this.logger.log(`Session ${saved.id} saved. Notifying doctors via socket...`);
          this.gateway.notifyNewConsult(saved);
        })
        .catch((e) => this.logger.error(`Local save failed: ${e.message}`));

      return {
        status: 201,
        message: 'Consultation initiated successfully',
        data: {
          id: session.id, // Local UUID
          consult_id: roomId, // Remote ID
          room_url: roomUrl,
          room_token: roomToken,
          consults: [consultData],
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      this.logger.error(`TELELINK_SESSION_ERROR: ${err.message}`, err.stack);
      if (err.getStatus && typeof err.getStatus === 'function') {
        throw err;
      }
      throw new InternalServerErrorException(
        {
          status: 500,
          message: `TeleLink Creation Failed: ${err.message}`,
          meta: {
            timestamp: new Date().toISOString(),
          },
        },
      );
    }
  }

  async findAll(user: any) {
    const roles = user.roles || [];
    const isStateAdmin =
      roles.includes('STATE_ADMIN') || roles.includes('state');
    const isZoneAdmin = roles.includes('ZONE_ADMIN') || roles.includes('zone');
    const isOrgStaff =
      roles.includes('nurse') ||
      roles.includes('vhn') ||
      roles.includes('ahn');

    const categoryId = this.config.get<string>('CURESELECT_CATEGORY_ID') || '2';
    const organisationId = user.organisationId;

    try {
      // 1. Prepare filtering parameters based on role (aligning with reference project)
      const params: any = {
        category_ids: categoryId,
      };

      if (isStateAdmin) {
        params.state_id = user.metadata?.state_id;
      } else if (isZoneAdmin) {
        params.zone_id = user.metadata?.zone_id;
      } else if (isOrgStaff) {
        params.organization_id = organisationId;
      } else {
        // EMT / Regular user sees their own or org-locked consults
        params.organization_id = organisationId;
        params.participant_ref_number = user.userId;
      }

      // Add x_name filter to stay within our ecosystem
      params.x_name = 'teleems';

      // 2. Fetch remote list with optimized filters
      const remoteResponse = await this.cureselectApi.fetchConsults(params);

      return {
        status: 200,
        message: remoteResponse.message || 'Consults fetched successfully',
        data: {
          consults: remoteResponse.data?.consults || [],
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      this.logger.error(`Remote List Fetch Failed: ${err.message}`);

      // Fallback query building for local DB
      const query: any = { organisationId };

      const sessions = await this.sessionRepo.find({
        where: query,
        order: { started_at: 'DESC' },
        relations: ['patient', 'trip', 'incident'],
      });

      return {
        status: 200,
        message: 'Fetched from local cache (Remote Offline)',
        data: {
          consults: sessions.map((s) => this.transformToConsult(s)),
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async getErcpQueue(user: any) {
    const organisationId = user.organisationId;
    const hospitalId = user.hospitalId || user.metadata?.hospital_id;

    this.logger.log(`Fetching ERCP Queue for Org: ${organisationId}, Hospital: ${hospitalId}`);

    const query = this.sessionRepo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.patient', 'patient')
      .leftJoinAndSelect('session.incident', 'incident')
      .leftJoinAndSelect('session.trip', 'trip')
      .where('session.organisationId = :organisationId', { organisationId })
      .andWhere('session.status IN (:...statuses)', {
        statuses: [TeleLinkSessionStatus.ACTIVE, TeleLinkSessionStatus.ACCEPTED],
      });

    // If doctor is assigned to a hospital, filter by that hospital or broad requests
    if (hospitalId) {
      query.andWhere(
        '(session.target_hospital_id = :hospitalId OR session.target_hospital_id IS NULL)',
        { hospitalId },
      );
    }

    const sessions = await query.getMany();

    // Prioritization Logic: SOS first, then Triage Level (Red > Orange > Yellow), then Time
    const triageOrder: Record<string, number> = {
      Red: 1,
      Orange: 2,
      Yellow: 3,
      Green: 4,
      Unknown: 5,
    };

    const sortedSessions = sessions.sort((a, b) => {
      // 1. SOS Priority
      if (a.sos_flag !== b.sos_flag) return a.sos_flag ? -1 : 1;

      // 2. Triage Priority (from Patient Profile)
      const triageA = a.patient?.triage_code || 'Unknown';
      const triageB = b.patient?.triage_code || 'Unknown';
      if (triageA !== triageB) {
        return (triageOrder[triageA] || 99) - (triageOrder[triageB] || 99);
      }

      // 3. Time Priority
      return a.started_at.getTime() - b.started_at.getTime();
    });

    return {
      status: 200,
      message: 'ERCP Queue fetched successfully',
      data: {
        queue: sortedSessions,
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID(),
      },
    };
  }

  async findOne(id: string, user: any) {
    const session = await this.sessionRepo.findOne({
      where: { id, organisationId: user.organisationId },
    });

    if (!session) throw new NotFoundException('TeleLink Session not found');

    try {
      this.logger.log(
        `Fetching rich session detail from remote: ${session.room_id}`,
      );
      const remoteResponse = await this.cureselectApi.fetchConsultById(
        session.room_id,
      );

      // Background Sync: Update local status if it changed remotely
      const remoteStatus =
        remoteResponse?.data?.status_id ||
        remoteResponse?.data?.consult_status?.id;
      if (remoteStatus == 6 || remoteStatus == 'completed') {
        if (session.status !== TeleLinkSessionStatus.COMPLETED) {
          session.status = TeleLinkSessionStatus.COMPLETED;
          session.ended_at = new Date();
          this.sessionRepo
            .save(session)
            .catch((e) => this.logger.error(`BG Sync fail: ${e.message}`));
        }
      }

      return {
        status: 200,
        message: 'Consultation retrieved successfully',
        ...remoteResponse,
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      this.logger.error(`Remote detail fetch failed for ${id}: ${err.message}`);
      // Fallback to local transformed data
      return {
        status: 200,
        message: 'Fetched from local record',
        data: {
          consults: [this.transformToConsult(session)],
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async updateStatus(id: string, dto: UpdateTeleLinkStatusDto, user: any) {
    const session = await this.sessionRepo.findOneBy({
      id,
      organisationId: user.organisationId,
    });

    if (!session) throw new NotFoundException('Session not found');

    // 1. Update Remote if room_id exists
    if (session.room_id) {
      try {
        const remoteStatusId = dto.status === TeleLinkSessionStatus.COMPLETED ? 6 : 7;
        await this.cureselectApi.patchConsult(session.room_id, {
          status_id: remoteStatusId,
        });
      } catch (err: any) {
        this.logger.error(`Remote Status Sync Failed: ${err.message}`);
        // We continue to update local if remote fails but log it
      }
    }

    // 2. Update Local
    const updated = await this.sessionRepo.save(session);
    
    // Notify all parties in the session (e.g., EMT, Patient App, Doctor)
    this.gateway.notifyStatusUpdate(id, dto.status, {
      updated_at: updated.ended_at || new Date(),
      user_name: user.name,
      user_role: user.roles?.[0] || 'User'
    });

    return updated;
  }

  async addClinicalNotes(id: string, dto: AddClinicalNotesDto, user: any) {
    const session = await this.sessionRepo.findOneBy({
      id,
      organisationId: user.organisationId,
    });

    if (!session) throw new NotFoundException('Session not found');

    // Merge logic: initialize if null
    const currentInfo = session.additional_info || {};
    
    session.clinical_record = dto.clinical_record;
    session.additional_info = {
      ...currentInfo,
      staff_notes: dto.notes,
      prescriptions: dto.prescriptions || currentInfo.prescriptions,
      care_instructions: dto.care_instructions || currentInfo.care_instructions,
      updated_at: new Date(),
      updated_by: user.userId,
    };

    return this.sessionRepo.save(session);
  }

  async toggleRecording(id: string, dto: ToggleRecordingDto, user: any) {
    const session = await this.sessionRepo.findOneBy({
      id,
      organisationId: user.organisationId,
    });
    if (!session) throw new NotFoundException('Session not found');

    session.is_recording = dto.is_recording;
    session.recording_consent = dto.recording_consent;
    
    return this.sessionRepo.save(session);
  }

  async escalateSession(id: string, dto: EscalateSessionDto, user: any) {
    const session = await this.sessionRepo.findOneBy({
      id,
      organisationId: user.organisationId,
    });
    if (!session) throw new NotFoundException('Session not found');

    session.escalated_to = dto.escalated_to;
    session.escalated_at = new Date();
    
    // Logic to notify the target (e.g., EDP) would go here
    this.logger.log(`Session ${id} escalated to ${dto.escalated_to}`);

    return this.sessionRepo.save(session);
  }

  async rescheduleSession(id: string, dto: RescheduleTeleLinkSessionDto, user: any) {
    const session = await this.sessionRepo.findOneBy({
      id,
      organisationId: user.organisationId,
    });

    if (!session) throw new NotFoundException('Session not found');

    if (session.room_id) {
      await this.cureselectApi.patchConsult(session.room_id, {
        scheduled_at: dto.scheduled_at,
        additional_info: {
          ...session.additional_info,
          reschedule_reason: dto.reason,
        },
      });
    }

    session.scheduled_at = new Date(dto.scheduled_at);
    session.reason = dto.reason;
    return this.sessionRepo.save(session);
  }

  async cancelSession(id: string, dto: CancelTeleLinkSessionDto, user: any) {
    const session = await this.sessionRepo.findOneBy({
      id,
      organisationId: user.organisationId,
    });

    if (!session) throw new NotFoundException('Session not found');

    if (session.room_id) {
      await this.cureselectApi.patchConsult(session.room_id, {
        status_id: 11, // Assuming 11 is CANCELLED based on common patterns
        additional_info: {
          ...session.additional_info,
          cancel_reason: dto.reason,
        },
      });
    }

    session.status = TeleLinkSessionStatus.CANCELLED;
    session.reason = dto.reason;
    session.ended_at = new Date();
    return this.sessionRepo.save(session);
  }

  async getConsultDetailsByToken(token: string) {
    try {
      this.logger.log(`Validating consultation token: ${token.substring(0, 8)}...`);
      const response = await this.cureselectApi.validateToken(token);
      return {
        status: 200,
        message: 'Token validated successfully',
        ...response,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: crypto.randomUUID(),
        },
      };
    } catch (err) {
      this.logger.error(`Token validation failed: ${err.message}`);
      throw new BadGatewayException(`Consultation access denied: ${err.message}`);
    }
  }

  async getConsultById(consultId: string) {
    try {
      this.logger.log(`Fetching consult by remote ID: ${consultId}`);
      const remoteResponse = await this.cureselectApi.fetchConsultById(consultId);
      return {
        status: 200,
        message: 'Consultation fetched successfully',
        data: remoteResponse?.data || remoteResponse,
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      this.logger.error(`Fetch consult ${consultId} failed: ${err.message}`);
      throw new BadGatewayException(`Failed to fetch consultation: ${err.message}`);
    }
  }

  async createDoctorConsult(dto: CreateDoctorConsultDto, user: any) {
    try {
      this.logger.log(`Doctor initiating consult for patient: ${dto.patient_id}`);

      // 1. Fetch doctor (logged-in user)
      const doctor = await this.userRepo.findOneBy({ id: user.userId });
      if (!doctor) throw new UnauthorizedException('Doctor user not found');

      // 2. Fetch patient profile
      const patient = await this.patientRepo.findOneBy({ id: dto.patient_id });

      // 3. Prepare payload (Doctor = publisher, Patient = subscriber)
      const now = new Date();
      const formattedDate = this.formatDate(now);

      const remotePayload = {
        consult_date_time: dto.scheduled_at || formattedDate,
        scheduled_at: dto.scheduled_at || formattedDate,
        consult_reason: dto.consult_reason,
        consult_type: dto.consult_type || 'virtual',
        service_provider: 'tokbox',
        virtual_service_provider: 'tokbox',
        category_id: this.config.get<string>('CURESELECT_CATEGORY_ID') || '2',
        provider: {
          id: doctor.id,
          name: doctor.name || 'Doctor',
          email: dto.doctor_email || doctor.email,
          phone: dto.doctor_mobile || doctor.phone,
          profile_pic: doctor.profileImageUrl,
          additional_info: { role: 'doctor', x_name: 'teleems' },
        },
        patient: {
          id: dto.patient_id,
          name: dto.patient_name || patient?.name || 'Unknown Patient',
          email: dto.patient_email || null,
          phone: dto.patient_phone || patient?.phone || '',
          additional_info: { x_name: 'teleems' },
        },
        additional_info: {
          trip_id: dto.trip_id || null,
          incident_id: dto.incident_id || null,
          x_name: 'teleems',
          organisation_id: user.organisationId,
          initiated_by: 'doctor',
        },
      };

      // 4. Call Remote Cureselect API
      let remoteResponse: any;
      try {
        remoteResponse = await this.cureselectApi.createConsult(remotePayload);
        this.logger.log(`Doctor Consult Response: ${JSON.stringify(remoteResponse)}`);
      } catch (err: any) {
        const msg = `External TeleConsult API Error: ${err.message}`;
        this.logger.error(msg);
        throw new BadGatewayException(msg);
      }

      // 5. Extract consult data
      const consultData = remoteResponse?.data?.consults || remoteResponse?.data || {};
      const participants = consultData?.participants || [];
      const roomId = consultData?.id || remoteResponse?.consult_id || `local_${Date.now()}`;
      const roomUrl = remoteResponse?.room_url || `https://telelink.teleems.in/room/${roomId}`;

      const doctorParticipant = participants.find(
        (p: any) => String(p.ref_number) === String(doctor.id),
      );
      const roomToken =
        doctorParticipant?.token ||
        participants?.[0]?.token ||
        remoteResponse?.room_token ||
        'MOCK_TOKEN';

      // 6. Save locally (background)
      const session = this.sessionRepo.create({
        trip_id: dto.trip_id || undefined,
        incident_id: dto.incident_id || undefined,
        patient_id: patient?.id || undefined,
        sos_flag: false,
        initiator_role: 'Doctor',
        status: TeleLinkSessionStatus.ACTIVE,
        organisationId: user.organisationId,
        room_id: String(roomId),
        room_url: roomUrl,
        room_token: roomToken,
        started_at: new Date(),
        scheduled_at: dto.scheduled_at ? new Date(dto.scheduled_at) : new Date(),
        reason: dto.consult_reason,
        initiator_id: doctor.id,
      });

      this.sessionRepo
        .save(session)
        .catch((e) => this.logger.error(`Local save failed: ${e.message}`));

      return {
        status: 201,
        message: 'Doctor consultation initiated successfully',
        data: {
          consults: [consultData],
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      this.logger.error(`DOCTOR_CONSULT_ERROR: ${err.message}`, err.stack);
      if (err.getStatus && typeof err.getStatus === 'function') throw err;
      throw new InternalServerErrorException({
        status: 500,
        message: `Doctor Consult Creation Failed: ${err.message}`,
        meta: { timestamp: new Date().toISOString() },
      });
    }
  }
}
