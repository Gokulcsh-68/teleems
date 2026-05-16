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



  async getHospitalDoctors(hospitalId: string) {
    console.log(`[TelelinkService] getHospitalDoctors called for hospitalId: ${hospitalId}`);
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

    console.log(`[TelelinkService] getHospitalDoctors returning ${clinicalDoctors.length} clinical doctors`);
    this.logger.log(`Returning ${clinicalDoctors.length} clinical doctors.`);
    return clinicalDoctors;
  }

  async createSession(dto: CreateTeleLinkSessionDto, user: any) {
    console.log(`[TelelinkService] createSession called with DTO:`, JSON.stringify(dto, null, 2));
    console.log(`[TelelinkService] User initiating session:`, user.userId);
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
        console.log("[TelelinkService] Sending remotePayload to Cureselect:", JSON.stringify(remotePayload, null, 2));
        remoteResponse = await this.cureselectApi.createConsult(remotePayload);
        console.log("[TelelinkService] Received remoteResponse from Cureselect:", JSON.stringify(remoteResponse, null, 2));
      } catch (err: any) {
        const msg = `External TeleConsult API Error: ${err.message}`;
        this.logger.error(msg);
        console.error(`[TelelinkService] Remote API error: ${err.message}`);
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

      let fullRemoteData: any = null;
      if (roomId && !String(roomId).startsWith('local_')) {
        try {
          console.log(`[TelelinkService] Fetching full details for created consult ${roomId}...`);
          fullRemoteData = await this.cureselectApi.fetchConsultById(roomId);
        } catch (e) {
          console.error(`[TelelinkService] Failed to fetch full data: ${e.message}`);
        }
      }

      const roomBaseUrl = this.config.get<string>('CURESELECT_ROOM_BASE_URL') || 'https://teleconsult.a2zhealth.in/room';
      
      const consultDataFull = fullRemoteData?.data?.consults || fullRemoteData?.data || {};
      const participantsList = consultDataFull.participants || [];
      const info = fullRemoteData?.data?.info || {};
      
      // Find the subscriber (The EMT)
      const subscriber = (info?.role === 'subscriber' || String(info?.ref_number) === String(initiator.id) || String(info?.user_id) === String(initiator.id)) 
        ? info 
        : participantsList.find((p: any) => 
            p.role === 'subscriber' || 
            String(p.ref_number) === String(initiator.id) || 
            String(p.user_id) === String(initiator.id)
          );
        
      const consultDetails = consultDataFull || {};
      const tokboxData = consultDetails?.consult_data || {};
        
      const participantId = subscriber?.id || info?.id || initiator.id;
      const participantToken = subscriber?.token || info?.token || tokboxData?.signature;
      
      // Construct the URL (Subscriber uses /consult/)
      const roomUrl = participantToken
        ? `https://teleconsult.a2zhealth.in/consult/${participantToken}`
        : (remoteResponse?.room_url || `${roomBaseUrl}/${roomId}/subscriber/${participantId}`);

      const roomToken = participantToken || 'MOCK_TOKEN';

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


      const saved = await this.sessionRepo.save(session);
      this.gateway.notifyNewConsult(saved);

      // Inject fields for frontend compatibility
      if (remoteResponse.data) {
        remoteResponse.data.room_url = roomUrl;
        remoteResponse.data.room_token = roomToken;
        remoteResponse.data.consult_id = roomId;
        remoteResponse.data.id = saved.id; // Correct local UUID for status updates
      }

      console.log(`[TelelinkService] createSession successful returning direct remoteResponse:`, JSON.stringify(remoteResponse, null, 2));
      return remoteResponse;
    } catch (err: any) {
      this.logger.error(`TELELINK_SESSION_ERROR: ${err.message}`, err.stack);
      console.error(`[TelelinkService] createSession failed error: ${err.message}`);
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
    console.log(`[TelelinkService] findAll called for user: ${user.userId}`);
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
      console.log(`[TelelinkService] Fetching remote consults with params:`, JSON.stringify(params, null, 2));
      const remoteResponse = await this.cureselectApi.fetchConsults(params);
      console.log(`[TelelinkService] Remote fetch successful found ${remoteResponse.data?.consults?.length || 0} consults`);

      return remoteResponse;
    } catch (err) {
      this.logger.error(`Remote List Fetch Failed: ${err.message}`);
      console.error(`[TelelinkService] Remote List Fetch Failed: ${err.message}`);
      throw err;
    }
  }

  async getErcpQueue(user: any) {
    console.log(`[TelelinkService] getErcpQueue called for user: ${user.userId}`);
    const organisationId = user.organisationId;
    const hospitalId = user.hospitalId || user.metadata?.hospital_id;

    this.logger.log(`Fetching ERCP Queue for Org: ${organisationId}, Hospital: ${hospitalId}`);
    console.log(`[TelelinkService] Org: ${organisationId}, Hospital: ${hospitalId}`);

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
    console.log(`[TelelinkService] Queue query found ${sessions.length} sessions before sorting`);

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

    console.log(`[TelelinkService] Returning sorted queue with ${sortedSessions.length} items`);
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
    console.log(`[TelelinkService] findOne called for sessionId: ${id}`);
    const session = await this.sessionRepo.findOne({
      where: { id, organisationId: user.organisationId },
    });

    if (!session) throw new NotFoundException('TeleLink Session not found');

    try {
      console.log(`[TelelinkService] Found local session, fetching remote detail for room_id: ${session.room_id}`);
      this.logger.log(
        `Fetching rich session detail from remote: ${session.room_id}`,
      );
      const remoteResponse = await this.cureselectApi.fetchConsultById(
        session.room_id,
      );
      console.log(`[TelelinkService] Remote fetch successful for room_id: ${session.room_id}`);

      // Background Sync: Update local status if it changed remotely
      const remoteStatus =
        remoteResponse?.data?.status_id ||
        remoteResponse?.data?.consult_status?.id;
      console.log(`[TelelinkService] Remote status: ${remoteStatus}, Local status: ${session.status}`);
      
      if (remoteStatus == 6 || remoteStatus == 'completed') {
        if (session.status !== TeleLinkSessionStatus.COMPLETED) {
          console.log(`[TelelinkService] Syncing local status to COMPLETED`);
          session.status = TeleLinkSessionStatus.COMPLETED;
          session.ended_at = new Date();
          this.sessionRepo
            .save(session)
            .catch((e) => {
               this.logger.error(`BG Sync fail: ${e.message}`);
               console.error(`[TelelinkService] BG Sync fail: ${e.message}`);
            });
        }
      }

      // Inject fields for frontend compatibility
      if (remoteResponse.data) {
        remoteResponse.data.room_url = session.room_url;
        remoteResponse.data.room_token = session.room_token;
        remoteResponse.data.consult_id = session.room_id;
        remoteResponse.data.id = session.id;
      }

      return remoteResponse;
    } catch (err) {
      this.logger.error(`Remote detail fetch failed for ${id}: ${err.message}`);
      console.error(`[TelelinkService] Remote detail fetch failed for ${id}: ${err.message}`);
      throw err;
    }
  }

  async updateStatus(id: string, dto: UpdateTeleLinkStatusDto, user: any) {
    console.log(`[TelelinkService] updateStatus called for session: ${id}, status: ${dto.status}`);
    const session = await this.sessionRepo.findOneBy({
      id,
      organisationId: user.organisationId,
    });

    if (!session) throw new NotFoundException('Session not found');

    // 1. Update Remote if room_id exists
    let remoteResponse: any = null;
    if (session.room_id) {
      try {
        const remoteStatusId = dto.status === TeleLinkSessionStatus.COMPLETED ? 6 : 7;
        console.log(`[TelelinkService] Updating remote status for room: ${session.room_id} to statusId: ${remoteStatusId}`);
        remoteResponse = await this.cureselectApi.patchConsult(session.room_id, {
          status_id: remoteStatusId,
        });
      } catch (err: any) {
        this.logger.error(`Remote Status Sync Failed: ${err.message}`);
        console.error(`[TelelinkService] Remote Status Sync Failed: ${err.message}`);
        // We continue to update local if remote fails but log it
      }
    }

    // 2. Update Local
    session.status = dto.status;
    if (dto.status === TeleLinkSessionStatus.COMPLETED) {
      session.ended_at = new Date();
    }
    
    this.sessionRepo.save(session).then((updated) => {
      
      // Notify all parties in the session (e.g., EMT, Patient App, Doctor)
      this.gateway.notifyStatusUpdate(id, dto.status, {
        updated_at: updated.ended_at || new Date(),
        user_name: user.name,
        user_role: user.roles?.[0] || 'User'
      });
    }).catch(e => {
       console.error(`[TelelinkService] Local status save fail: ${e.message}`);
    });

    return remoteResponse || { status: 'success', local_id: session.id };
  }

  async addClinicalNotes(id: string, dto: AddClinicalNotesDto, user: any) {
    console.log(`[TelelinkService] addClinicalNotes called for session: ${id}`);
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

    console.log(`[TelelinkService] Saving clinical notes for session: ${id}`);
    return this.sessionRepo.save(session);
  }

  async toggleRecording(id: string, dto: ToggleRecordingDto, user: any) {
    console.log(`[TelelinkService] toggleRecording called for session: ${id}, is_recording: ${dto.is_recording}`);
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
    console.log(`[TelelinkService] escalateSession called for session: ${id}, to: ${dto.escalated_to}`);
    const session = await this.sessionRepo.findOneBy({
      id,
      organisationId: user.organisationId,
    });
    if (!session) throw new NotFoundException('Session not found');

    session.escalated_to = dto.escalated_to;
    session.escalated_at = new Date();
    
    // Logic to notify the target (e.g., EDP) would go here
    this.logger.log(`Session ${id} escalated to ${dto.escalated_to}`);
    console.log(`[TelelinkService] Session ${id} escalated to ${dto.escalated_to}`);

    return this.sessionRepo.save(session);
  }

  async rescheduleSession(id: string, dto: RescheduleTeleLinkSessionDto, user: any) {
    console.log(`[TelelinkService] rescheduleSession called for session: ${id}, to: ${dto.scheduled_at}`);
    const session = await this.sessionRepo.findOneBy({
      id,
      organisationId: user.organisationId,
    });

    if (!session) throw new NotFoundException('Session not found');

    // 1. Update Remote if room_id exists
    let remoteResponse: any = null;
    if (session.room_id) {
      try {
        console.log(`[TelelinkService] Updating remote schedule for room: ${session.room_id}`);
        remoteResponse = await this.cureselectApi.patchConsult(session.room_id, {
          scheduled_at: dto.scheduled_at,
          additional_info: {
            ...session.additional_info,
            reschedule_reason: dto.reason,
          },
        });
      } catch (err: any) {
        console.error(`[TelelinkService] Remote reschedule fail: ${err.message}`);
      }
    }

    // 2. Update Local
    session.scheduled_at = new Date(dto.scheduled_at);
    session.reason = dto.reason;
    this.sessionRepo.save(session).catch(e => {
       console.error(`[TelelinkService] Local reschedule save fail: ${e.message}`);
    });

    return remoteResponse || { status: 'success', local_id: session.id };
  }

  async cancelSession(id: string, dto: CancelTeleLinkSessionDto, user: any) {
    console.log(`[TelelinkService] cancelSession called for session: ${id}`);
    const session = await this.sessionRepo.findOneBy({
      id,
      organisationId: user.organisationId,
    });

    if (!session) throw new NotFoundException('Session not found');

    // 1. Update Remote if room_id exists
    let remoteResponse: any = null;
    if (session.room_id) {
      try {
        console.log(`[TelelinkService] Cancelling remote consult for room: ${session.room_id}`);
        remoteResponse = await this.cureselectApi.patchConsult(session.room_id, {
          status_id: 11, // Assuming 11 is CANCELLED based on common patterns
          additional_info: {
            ...session.additional_info,
            cancel_reason: dto.reason,
          },
        });
      } catch (err: any) {
        console.error(`[TelelinkService] Remote cancel fail: ${err.message}`);
      }
    }

    // 2. Update Local
    session.status = TeleLinkSessionStatus.CANCELLED;
    session.reason = dto.reason;
    session.ended_at = new Date();
    this.sessionRepo.save(session).catch(e => {
       console.error(`[TelelinkService] Local cancel save fail: ${e.message}`);
    });

    return remoteResponse || { status: 'success', local_id: session.id };
  }

  async getConsultDetailsByToken(token: string) {
    console.log(`[TelelinkService] getConsultDetailsByToken called`);
    try {
      this.logger.log(`Validating consultation token: ${token.substring(0, 8)}...`);
      const response = await this.cureselectApi.validateToken(token);
      console.log(`[TelelinkService] Token validation successful`);
      return response;
    } catch (err) {
      this.logger.error(`Token validation failed: ${err.message}`);
      console.error(`[TelelinkService] Token validation failed: ${err.message}`);
      throw new BadGatewayException(`Consultation access denied: ${err.message}`);
    }
  }

  async getConsultById(consultId: string) {
    console.log(`[TelelinkService] getConsultById called for consultId: ${consultId}`);
    try {
      this.logger.log(`Fetching consult by remote ID: ${consultId}`);
      const remoteResponse = await this.cureselectApi.fetchConsultById(consultId);
      console.log(`[TelelinkService] Remote fetch successful for consultId: ${consultId}`);
      return remoteResponse;
    } catch (err) {
      this.logger.error(`Fetch consult ${consultId} failed: ${err.message}`);
      console.error(`[TelelinkService] Fetch consult ${consultId} failed: ${err.message}`);
      throw new BadGatewayException(`Failed to fetch consultation: ${err.message}`);
    }
  }

  async createDoctorConsult(dto: CreateDoctorConsultDto, user: any) {
    console.log(`[TelelinkService] createDoctorConsult called with DTO:`, JSON.stringify(dto, null, 2));
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
        console.log(`[TelelinkService] Sending doctor remotePayload:`, JSON.stringify(remotePayload, null, 2));
        remoteResponse = await this.cureselectApi.createConsult(remotePayload);
        this.logger.log(`Doctor Consult Response: ${JSON.stringify(remoteResponse)}`);
        console.log(`[TelelinkService] Doctor remoteResponse:`, JSON.stringify(remoteResponse, null, 2));
      } catch (err: any) {
        const msg = `External TeleConsult API Error: ${err.message}`;
        this.logger.error(msg);
        console.error(`[TelelinkService] Doctor Remote API error: ${err.message}`);
        throw new BadGatewayException(msg);
      }

      // 5. Extract consult data
      const consultData = remoteResponse?.data?.consults || remoteResponse?.data || {};
      const participants = consultData?.participants || [];
      const roomId = consultData?.id || remoteResponse?.consult_id || `local_${Date.now()}`;
      
      let fullRemoteData: any = null;
      if (roomId && !String(roomId).startsWith('local_')) {
        try {
          console.log(`[TelelinkService] Fetching full details for created doctor consult ${roomId}...`);
          fullRemoteData = await this.cureselectApi.fetchConsultById(roomId);
        } catch (e) {
          console.error(`[TelelinkService] Failed to fetch full data: ${e.message}`);
        }
      }

      const consultDataFull = fullRemoteData?.data?.consults || fullRemoteData?.data || {};
      const participantsList = consultDataFull.participants || [];
      
      const doctorParticipant = participantsList.find(
        (p: any) => 
          String(p.ref_number) === String(doctor.id) || 
          String(p.user_id) === String(doctor.id),
      );
      
      const roomToken = doctorParticipant?.token || participantsList?.[0]?.token || 'MOCK_TOKEN';

      // Publisher uses /teleconsult-v3/
      const roomUrl = roomToken && roomToken !== 'MOCK_TOKEN'
        ? `https://teleconsult.a2zhealth.in/teleconsult-v3/${roomToken}`
        : (remoteResponse?.room_url || `https://telelink.teleems.in/room/${roomId}`);

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


      const saved = await this.sessionRepo.save(session);

      // Inject fields for frontend compatibility
      if (remoteResponse.data) {
        remoteResponse.data.room_url = roomUrl;
        remoteResponse.data.room_token = roomToken;
        remoteResponse.data.consult_id = roomId;
        remoteResponse.data.id = saved.id; // Correct local UUID
      }

      console.log(`[TelelinkService] createDoctorConsult successful returning direct remoteResponse:`, JSON.stringify(remoteResponse, null, 2));
      return remoteResponse;
    } catch (err: any) {
      this.logger.error(`DOCTOR_CONSULT_ERROR: ${err.message}`, err.stack);
      console.error(`[TelelinkService] createDoctorConsult failed error: ${err.message}`);
      if (err.getStatus && typeof err.getStatus === 'function') throw err;
      throw new InternalServerErrorException({
        status: 500,
        message: `Doctor Consult Creation Failed: ${err.message}`,
        meta: { timestamp: new Date().toISOString() },
      });
    }
  }
}
