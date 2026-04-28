import { Injectable, NotFoundException, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ArrayContains } from 'typeorm';
import { Consult, ConsultStatus, CureselectApiService, Incident, User, PatientProfile } from '@app/common';
import { CreateConsultDto, UpdateConsultDto, ConsultQueryDto } from './dto';

@Injectable()
export class ConsultService {
  private readonly logger = new Logger(ConsultService.name);

  constructor(
    @InjectRepository(Consult)
    private readonly consultRepo: Repository<Consult>,
    @InjectRepository(Incident)
    private readonly incidentRepo: Repository<Incident>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
    private readonly cureselectApi: CureselectApiService,
  ) { }

  async create(createConsultDto: CreateConsultDto, user: any) {
    try {
      this.logger.log(`Creating new consult for incident: ${createConsultDto.incident_id}`);

      const roles = user.roles || [];
      const isEmt = roles.some((role: string) =>
        ['EMT', 'Paramedic', 'emt', 'paramedic'].includes(role)
      );

      this.logger.log(`Creating new consult for incident: ${createConsultDto.incident_id} by user: ${user.userId || user.id}`);

      let patientId: string | undefined = undefined;
      let emtId = createConsultDto.emt_id || user.userId || user.id;

      // Ensure EMT/Paramedic always has their own ID as emt_id for security
      if (user.roles?.includes('EMT') || user.roles?.includes('Paramedic')) {
        emtId = user.userId || user.id;
      }

      if (createConsultDto.incident_id) {
        const incident = await this.incidentRepo.findOne({
          where: { id: createConsultDto.incident_id },
        });
        if (incident && incident.patients && incident.patients.length > 0) {
          const firstPatientId = incident.patients[0].id;
          // Verify if this patient actually exists in the patient_profiles table
          const patientExists = await this.patientRepo.findOneBy({ id: firstPatientId });
          if (patientExists) {
            patientId = firstPatientId;
          } else {
            this.logger.warn(`Patient ID ${firstPatientId} from incident JSON not found in patient_profiles table. Leaving patient_id null to avoid FK violation.`);
          }
        }
      }

      let doctorId = createConsultDto.doctor_id;
      let secondaryDoctorId: string | undefined = undefined;

      // If doctor_id is not provided, automatically assign up to two available doctors
      if (!doctorId) {
        const availableDoctors = await this.userRepo.find({
          where: [
            { organisationId: user.organisationId, status: 'ACTIVE', isAvailable: true, roles: Like('%Emergency doctor%') },
            { organisationId: user.organisationId, status: 'ACTIVE', isAvailable: true, roles: Like('%Emergency Doctor%') }
          ],
          take: 2,
        });

        if (availableDoctors.length > 0) {
          doctorId = availableDoctors[0].id;
        }
        if (availableDoctors.length > 1) {
          secondaryDoctorId = availableDoctors[1].id;
        }
      }

      // We could add remote API calls here via this.cureselectApi.createConsult(...)
      // if we wanted to mirror remote session creation.

      const consult = this.consultRepo.create({
        ...createConsultDto,
        patient_id: patientId,
        doctor_id: doctorId,
        secondary_doctor_id: secondaryDoctorId,
        emt_id: emtId,
        status: ConsultStatus.PENDING,
        organisation_id: user.organisationId,
        scheduled_at: createConsultDto.scheduled_at ? new Date(createConsultDto.scheduled_at) : new Date(),
      });

      this.logger.debug(`Saving initial local consult record: ${JSON.stringify(consult)}`);
      let savedConsult = await this.consultRepo.save(consult);

      let remoteResponse: any;
      try {
        const fullDoctor = await this.userRepo.findOneBy({ id: doctorId });
        const fullEmt = await this.userRepo.findOneBy({ id: emtId });

        remoteResponse = await this.cureselectApi.createConsult({
          scheduled_at: savedConsult.scheduled_at,
          reason: savedConsult.reason,
          consult_type: savedConsult.consult_type,
          provider: { ...fullDoctor },
          patient: fullEmt ? {
            id: fullEmt.id,
            name: fullEmt.name || 'EMT',
            phone: fullEmt.phone,
            email: fullEmt.email,
          } : { 
            id: patientId || 'walk-in', 
            name: 'Emergency Patient',
          },
          organisation_id: user.organisationId,
          x_name: 'teleems',
          speciality: createConsultDto.speciality || 'General',
          additional_info: {
            ...createConsultDto.additional_info,
            trip_id: createConsultDto.trip_id,
            incident_id: createConsultDto.incident_id,
          }
        });
        this.logger.log(`CURESELECT API RESPONSE: ${JSON.stringify(remoteResponse)}`);
        if (remoteResponse && (remoteResponse.data || remoteResponse.consult_id)) {
          const remoteData = remoteResponse.data?.consults || remoteResponse.data || remoteResponse;
          savedConsult.room_id = String(remoteData.id || remoteData.consult_id || remoteData.room_id);
          savedConsult.room_token = remoteData.token || remoteData.room_token;
          savedConsult.room_url = remoteData.url || remoteData.room_url;
          savedConsult = await this.consultRepo.save(savedConsult);
          this.logger.log(`Remote session created successfully: Room ${savedConsult.room_id}`);
        } else {
          throw new Error('Remote API returned success but missing data');
        }
      } catch (remoteError: any) {
        this.logger.error(`Failed to generate remote consult token: ${remoteError.message}`);
        throw new InternalServerErrorException(`Tele-Consult API Error: ${remoteError.message}`);
      }
      return remoteResponse;
    } catch (error: any) {
      this.logger.error(`Failed to create consult: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error creating consult: ${error.message}`);
    }
  }

  async findAll(query: ConsultQueryDto, user: any) {
    const roles = user.roles || [];
    const isSuperAdmin = roles.includes('CureSelect Admin');
    const isHospitalAdmin = roles.includes('Hospital Admin') || roles.includes('Hospital Coordinator');
    const isFleetAdmin = roles.includes('Fleet Operator') || roles.includes('Station Incharge');
    const isOrgStaff = isHospitalAdmin || isFleetAdmin;

    const params: any = {
      x_name: 'teleems',
    };

    if (query.status) params.consult_status = query.status;
    if (query.incident_id) params.incident_id = query.incident_id;
    if (query.consult_id) params.consult_id = query.consult_id;
    if (query.organization_id) params.organization_id = query.organization_id;

    if (query.from_date) {
      params.scheduled_from_date = `${query.from_date} 00:00:00`;
    }
    if (query.to_date) {
      params.scheduled_to_date = `${query.to_date} 23:59:59`;
    }

    if (isSuperAdmin) {
      // Super admins see everything, no state/org filter needed
    } else if (isOrgStaff) {
      params.organization_id = user.organisationId || user.id;
    } else {
      params.participant_ref_number = user.id;
    }

    // If a specific search was requested by ID, override the participant filter
    if (query.doctor_id) params.participant_ref_number = query.doctor_id;
    if (query.emt_id) params.participant_ref_number = query.emt_id;

    try {
      this.logger.log(`Fetching consults from remote with params: ${JSON.stringify(params)}`);
      const remoteResponse = await this.cureselectApi.fetchConsults(params);
      return remoteResponse;
    } catch (error) {
      this.logger.error(`Remote fetch failed: ${error.message}. Falling back to local DB.`);
      
      let whereClauses: any[] = [];

      const baseCondition: any = {};
      if (query.status) baseCondition.status = query.status;
      if (query.incident_id) baseCondition.incident_id = query.incident_id;
      if (query.doctor_id) baseCondition.doctor_id = query.doctor_id;

      if (isSuperAdmin) {
        whereClauses.push({ ...baseCondition });
      } else if (isOrgStaff) {
        whereClauses.push({ ...baseCondition, organisation_id: user.organisationId || user.id });
      } else {
        whereClauses.push({ ...baseCondition, doctor_id: user.id });
        whereClauses.push({ ...baseCondition, emt_id: user.id });
        whereClauses.push({ ...baseCondition, secondary_doctor_id: user.id });
      }

      const consults = await this.consultRepo.find({
        where: whereClauses.length > 0 ? whereClauses : baseCondition,
        order: { created_at: 'DESC' },
        relations: ['patient', 'doctor', 'secondary_doctor', 'emt', 'incident'],
      });

      return {
        status: 200,
        data: { consults },
        meta: { source: 'local_database' }
      };
    }
  }

  async findOne(id: string, user: any) {
    const roles = user.roles || [];
    const isSuperAdmin = roles.includes('CureSelect Admin');
    const isHospitalAdmin = roles.includes('Hospital Admin') || roles.includes('Hospital Coordinator');
    const isFleetAdmin = roles.includes('Fleet Operator') || roles.includes('Station Incharge');
    const isOrgStaff = isHospitalAdmin || isFleetAdmin;

    let room_id = id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let localConsult: Consult | null = null;
    
    if (isUuid) {
      localConsult = await this.consultRepo.findOne({
        where: { id },
        relations: ['patient', 'doctor', 'secondary_doctor', 'emt', 'incident'],
      });
      if (localConsult && localConsult.room_id) {
        room_id = localConsult.room_id;
      }
    } else {
      localConsult = await this.consultRepo.findOne({
        where: { room_id: id },
        relations: ['patient', 'doctor', 'secondary_doctor', 'emt', 'incident'],
      });
    }

    const params: any = {
      x_name: 'teleems',
      consult_id: room_id
    };

    if (isSuperAdmin) {
      // Super admins see everything
    } else if (isOrgStaff) {
      params.organization_id = user.organisationId || user.id;
    } else {
      params.participant_ref_number = user.id;
    }

    try {
      this.logger.log(`Fetching single consult from remote with params: ${JSON.stringify(params)}`);
      const remoteResponse = await this.cureselectApi.fetchConsults(params);
      
      if (remoteResponse?.data?.consults && remoteResponse.data.consults.length > 0) {
        return {
          status: 200,
          message: remoteResponse.message || 'Success',
          data: remoteResponse.data.consults[0],
          meta: { source: 'remote_api' }
        };
      }
      
      // If remote succeeded but returned empty array, we can still fallback to local if we want, 
      // or throw a NotFound. For safety, let's throw NotFound if it wasn't found remotely or locally.
      if (!localConsult) {
        throw new NotFoundException(`Consult #${id} not found on remote or local server.`);
      }
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`Remote fetch for consult ${room_id} failed: ${err.message}. Falling back to local DB.`);
    }

    if (!localConsult) {
      throw new NotFoundException(`Consult #${id} not found`);
    }

    // Local security check
    if (!isSuperAdmin) {
      if (isOrgStaff && localConsult.organisation_id !== user.organisationId) {
        throw new NotFoundException(`Consult #${id} not found`); // Obfuscate unauthorized access
      } else if (!isOrgStaff && localConsult.doctor_id !== user.id && localConsult.emt_id !== user.id && localConsult.secondary_doctor_id !== user.id) {
        throw new NotFoundException(`Consult #${id} not found`);
      }
    }

    // Add a convenience participants array for the frontend
    const participants: any[] = [];
    if (localConsult.emt) participants.push({ ...this.cleanUser(localConsult.emt), participant_role: 'EMT' });
    if (localConsult.doctor) participants.push({ ...this.cleanUser(localConsult.doctor), participant_role: 'Primary Doctor' });
    if (localConsult.secondary_doctor) participants.push({ ...this.cleanUser(localConsult.secondary_doctor), participant_role: 'Secondary Doctor' });

    // Clean up the direct relations to reduce JSON size
    localConsult.doctor = this.cleanUser(localConsult.doctor) as any;
    localConsult.secondary_doctor = this.cleanUser(localConsult.secondary_doctor) as any;
    localConsult.emt = this.cleanUser(localConsult.emt) as any;

    return {
      status: 200,
      data: {
        ...localConsult,
        participants,
      },
      meta: { source: 'local_database' }
    };
  }

  async findEntityById(id: string, user: any) {
    let localConsult: Consult | null = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isUuid) {
      localConsult = await this.consultRepo.findOne({
        where: { id },
        relations: ['patient', 'doctor', 'secondary_doctor', 'emt', 'incident'],
      });
    } else {
      localConsult = await this.consultRepo.findOne({
        where: { room_id: id },
        relations: ['patient', 'doctor', 'secondary_doctor', 'emt', 'incident'],
      });
    }

    if (!localConsult) {
      throw new NotFoundException(`Consult #${id} not found`);
    }
    return localConsult;
  }

  async update(id: string, updateConsultDto: UpdateConsultDto, user: any) {
    const consult = await this.findEntityById(id, user);

    if (updateConsultDto.status === ConsultStatus.COMPLETED && consult.status !== ConsultStatus.COMPLETED) {
      consult.ended_at = new Date();
    }

    if (updateConsultDto.status === ConsultStatus.ACTIVE && consult.status !== ConsultStatus.ACTIVE) {
      consult.started_at = new Date();
    }

    Object.assign(consult, updateConsultDto);
    const updatedConsult = await this.consultRepo.save(consult);

    // Sync with remote if room_id exists
    if (updatedConsult.room_id) {
      try {
        await this.cureselectApi.patchConsult(updatedConsult.room_id, {
          status: updatedConsult.status,
          consult_notes: updatedConsult.clinical_notes?.staff_notes,
        });
      } catch (err) {
        this.logger.error(`Remote status sync failed for ${updatedConsult.id}: ${err.message}`);
      }
    }

    return updatedConsult;
  }

  async remove(id: string, user: any) {
    const consult = await this.findEntityById(id, user);
    consult.status = ConsultStatus.CANCELLED;
    return this.consultRepo.save(consult);
  }

  async escalate(id: string, secondaryDoctorId: string, user: any) {
    const consult = await this.findEntityById(id, user);

    // Restriction removed: allow updating the secondary doctor even if already escalated

    const secondaryDoctor = await this.userRepo.findOneBy({ id: secondaryDoctorId });
    if (!secondaryDoctor) {
      throw new NotFoundException('Secondary doctor not found');
    }

    consult.secondary_doctor_id = secondaryDoctorId;
    consult.secondary_doctor = secondaryDoctor;
    const updatedConsult = await this.consultRepo.save(consult);

    let remoteParticipants: any[] = [];

    // Sync with remote to fetch tokens for Tokbox session
    if (updatedConsult.room_id) {
      try {
        // Cureselect API does not support dynamically adding a 3rd participant via PATCH.
        // However, Tokbox allows multiple users to join with the same publisher token!
        // We will fetch the existing session tokens and share the primary doctor's publisher token.
        const remoteConsult = await this.cureselectApi.fetchConsultById(updatedConsult.room_id);
        const consultData = remoteConsult?.data?.consults;
        remoteParticipants = (Array.isArray(consultData) ? consultData[0]?.participants : consultData?.participants) || [];

        this.logger.log(`Successfully fetched remote tokens for escalated consult ${updatedConsult.room_id}`);
      } catch (err) {
        this.logger.error(`Remote token fetch failed for ${updatedConsult.id}: ${err.message}`);
      }
    }

    // Function to grab the token. If it's the secondary doctor, fallback to the primary doctor's token
    const getRemoteToken = (userId: string, isSecondaryDoctor: boolean = false) => {
      let rp = remoteParticipants.find((p: any) => String(p.ref_number) === String(userId));
      
      // If we are looking for the secondary doctor and they aren't in the remote DB, 
      // borrow the Primary Doctor's publisher token so they can join the Tokbox room.
      if (!rp && isSecondaryDoctor && consult.doctor_id) {
        rp = remoteParticipants.find((p: any) => String(p.ref_number) === String(consult.doctor_id));
      }
      
      return rp ? rp.token : null;
    };

    const frontendParticipants: any[] = [];
    if (consult.emt) frontendParticipants.push({ ...this.cleanUser(consult.emt), participant_role: 'EMT', token: getRemoteToken(consult.emt_id) });
    if (consult.doctor) frontendParticipants.push({ ...this.cleanUser(consult.doctor), participant_role: 'Primary Doctor', token: getRemoteToken(consult.doctor_id) });
    if (secondaryDoctor) frontendParticipants.push({ ...this.cleanUser(secondaryDoctor), participant_role: 'Secondary Doctor', token: getRemoteToken(secondaryDoctor.id, true) });

    return {
      status: 201,
      message: 'Success',
      data: {
        ...updatedConsult,
        doctor: this.cleanUser(consult.doctor),
        secondary_doctor: this.cleanUser(secondaryDoctor),
        emt: this.cleanUser(consult.emt),
        participants: frontendParticipants
      }
    };
  }

  async addNote(id: string, noteData: { note_type: string; content: string; timestamp?: string }, user: any) {
    const consult = await this.findEntityById(id, user);

    const newNote = {
      id: new Date().getTime().toString(),
      note_type: noteData.note_type,
      content: noteData.content,
      timestamp: noteData.timestamp || new Date().toISOString(),
      author_id: user.userId || user.id,
      author_name: user.name || 'Unknown'
    };

    let existingNotes: any[] = [];
    if (Array.isArray(consult.clinical_notes)) {
      existingNotes = consult.clinical_notes;
    } else if (consult.clinical_notes && typeof consult.clinical_notes === 'object' && Object.keys(consult.clinical_notes).length > 0) {
      existingNotes = [consult.clinical_notes];
    }

    consult.clinical_notes = [...existingNotes, newNote] as any;
    await this.consultRepo.save(consult);

    return {
      status: 201,
      message: 'Note added successfully',
      data: newNote
    };
  }

  async getNotes(id: string, user: any) {
    const consult = await this.findEntityById(id, user);

    let existingNotes: any[] = [];
    if (Array.isArray(consult.clinical_notes)) {
      existingNotes = consult.clinical_notes;
    } else if (consult.clinical_notes && typeof consult.clinical_notes === 'object' && Object.keys(consult.clinical_notes).length > 0) {
      existingNotes = [consult.clinical_notes];
    }

    return {
      status: 200,
      message: 'Success',
      data: existingNotes
    };
  }

  async updateNote(id: string, noteId: string, content: string, user: any) {
    const consult = await this.findEntityById(id, user);

    if (consult.status === ConsultStatus.COMPLETED || consult.status === ConsultStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit notes for completed or cancelled consultations');
    }

    let existingNotes: any[] = [];
    if (Array.isArray(consult.clinical_notes)) {
      existingNotes = consult.clinical_notes;
    } else if (consult.clinical_notes && typeof consult.clinical_notes === 'object' && Object.keys(consult.clinical_notes).length > 0) {
      existingNotes = [consult.clinical_notes];
    }

    const noteIndex = existingNotes.findIndex(n => n.id === noteId);
    if (noteIndex === -1) {
      throw new NotFoundException('Note not found');
    }

    const userId = user.userId || user.id;
    if (existingNotes[noteIndex].author_id !== userId) {
      throw new BadRequestException('You can only edit your own notes');
    }

    existingNotes[noteIndex].content = content;
    existingNotes[noteIndex].updated_at = new Date().toISOString();

    consult.clinical_notes = existingNotes as any;
    await this.consultRepo.save(consult);

    return {
      status: 200,
      message: 'Note updated successfully',
      data: existingNotes[noteIndex]
    };
  }

  async recordConsent(
    id: string, 
    body: { 
      consented: boolean; 
      consented_by: string; 
      consent_type?: string;
      relationship_to_patient?: string;
      remarks?: string;
      timestamp?: string 
    }, 
    user: any
  ) {
    const consult = await this.findEntityById(id, user);

    const consentRecord = {
      consented: body.consented,
      consented_by: body.consented_by,
      consent_type: body.consent_type || 'VERBAL',
      relationship_to_patient: body.relationship_to_patient || 'SELF',
      remarks: body.remarks || null,
      timestamp: body.timestamp || new Date().toISOString(),
      recorded_by: user.userId || user.id,
      recorded_at: new Date().toISOString()
    };

    let additionalInfo = consult.additional_info || {};
    if (typeof additionalInfo !== 'object') {
      additionalInfo = {};
    }

    additionalInfo.recording_consent = consentRecord;
    consult.additional_info = additionalInfo;

    await this.consultRepo.save(consult);

    return {
      status: 201,
      message: 'Recording consent logged successfully',
      data: consentRecord
    };
  }

  async getRecording(id: string, user: any) {
    const consult = await this.findEntityById(id, user);
    
    return {
      status: 200,
      message: 'Success',
      data: consult.additional_info?.recording_consent || null
    };
  }

  async deleteRecording(id: string, reason: string, user: any) {
    const consult = await this.findEntityById(id, user);

    if (!consult.additional_info || !consult.additional_info.recording) {
      throw new NotFoundException('Recording file not found for this consultation');
    }

    const deletionRecord = {
      deleted_by: user.userId || user.id,
      deleted_at: new Date().toISOString(),
      reason: reason,
      previous_metadata: consult.additional_info.recording
    };

    delete consult.additional_info.recording;
    
    // Store deletion history for audit purposes
    let additionalInfo = consult.additional_info || {};
    if (!additionalInfo.deletion_history) {
      additionalInfo.deletion_history = [];
    }
    additionalInfo.deletion_history.push(deletionRecord);

    // Create a new reference so TypeORM detects the JSONB change
    consult.additional_info = { ...additionalInfo };
    
    await this.consultRepo.save(consult);

    return; // Returns void which NestJS converts to 204 No Content
  }

  async createEmergencyDoctor(user: any, body: { name: string; phone: string; username?: string; password?: string; role?: string }) {
    const doctor = this.userRepo.create({
      name: body.name,
      phone: body.phone,
      username: body.username || body.phone,
      password: body.password || 'TemporaryPassword123!',
      roles: [body.role || 'Emergency doctor'],
      status: 'ACTIVE',
      isAvailable: true,
      organisationId: user.organisationId,
    });
    return await this.userRepo.save(doctor);
  }

  async updateAvailability(user: any, isAvailable: boolean) {
    const userId = user.userId || user.id;
    const dbUser = await this.userRepo.findOneBy({ id: userId });
    if (!dbUser) {
      throw new NotFoundException('User not found');
    }
    dbUser.isAvailable = isAvailable;
    return await this.userRepo.save(dbUser);
  }

  private cleanUser(user: any) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      roles: user.roles,
      username: user.username,
      email: user.email,
      profileImage: user.profileImage,
      metadata: user.metadata
    };
  }
}
