import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class CureselectApiService {
  private readonly logger = new Logger(CureselectApiService.name);
  private baseUrl: string | undefined;
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private categoryId: string | undefined;
  private token: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('CURESELECT_API_ENDPOINT');
    if (this.baseUrl && this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
    this.clientId = this.config.get<string>('CURESELECT_API_CLIENT_ID');
    this.clientSecret = this.config.get<string>('CURESELECT_API_CLIENT_SECRET');
    this.categoryId = this.config.get<string>('CURESELECT_CATEGORY_ID');
  }

  private async authenticate(): Promise<boolean> {
    if (!this.baseUrl || !this.clientId || !this.clientSecret) {
      this.logger.error('Missing Cureselect API configuration');
      return false;
    }

    const url = `${this.baseUrl}/v1/users/authenticate/api`;
    const data = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
    };

    try {
      this.logger.log(`Authenticating with Cureselect: ${url}`);
      const response = await axios.post(url, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      this.logger.log(`CURESELECT AUTH RESPONSE: ${JSON.stringify(response.data)}`);
      this.logger.log(`CURESELECT AUTH HEADERS: ${JSON.stringify(response.headers)}`);

      if (
        response.status === 200 &&
        (response.data.code === 200 || response.data.code === '200')
      ) {
        // Priority: Authorization header (as specified in updated guide)
        let token =
          response.headers['authorization'] ||
          response.headers['Authorization'];

        // Fallback to data.token if header is missing
        let tokenSource = 'none';
        if (response.headers['authorization'] || response.headers['Authorization']) {
          token = response.headers['authorization'] || response.headers['Authorization'];
          tokenSource = 'header';
        }
        if (!token && response.data?.data?.token) {
          token = response.data.data.token;
          tokenSource = 'body';
        }

        // Ensure token has Bearer prefix if it doesn't already
        if (token && !token.startsWith('Bearer ')) {
          token = `Bearer ${token}`;
        }

        const tokenPreview = token ? `${token.slice(0, 15)}...` : 'none';
        this.logger.log(`CURESELECT AUTH TOKEN SOURCE: ${tokenSource}; token preview: ${tokenPreview}`);

        this.token = token;
        // 1380 minutes = 23 hours (matching PHP cache duration)
        this.tokenExpiry = Date.now() + 1380 * 60 * 1000;
        this.logger.log('CURESELECT AUTH SUCCESS: Token acquired successfully');
        return true;
      }
    } catch (error) {
      this.logger.error(
        `CURESELECT AUTH ERROR: ${error.response ? JSON.stringify(error.response.data) : error.message}`,
      );
    }
    return false;
  }

  private async getToken(): Promise<string | null> {
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.token;
    }
    const success = await this.authenticate();
    return success ? this.token : null;
  }

  async createConsult(highLevelPayload: any): Promise<any> {
    const token = await this.getToken();
    if (!token) throw new Error('Could not authenticate with Cureselect API');

    const url = `${this.baseUrl}/v1/resource/consults`;
    const headers = {
      Authorization: token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    const providerData = highLevelPayload.provider || {};
    const patientData = highLevelPayload.patient || {};

    const additionValue = {
      consult_speciality: highLevelPayload.speciality || '',
      x_name: highLevelPayload.x_name || 'mental health',
    };

    providerData.additional_info = additionValue;
    patientData.additional_info = additionValue;
    const formattedDate = this.formatDate(
      highLevelPayload.scheduled_at || highLevelPayload.consult_date_time,
    );

    const apiPayload: any = {
      scheduled_at: formattedDate,
      consult_type: highLevelPayload.consult_type || 'virtual',
      reason:
        highLevelPayload.reason ||
        highLevelPayload.consult_reason ||
        'Tele-Consultation',
      virtual_service_provider: 'tokbox',
      additional_info: {
        ...(highLevelPayload.additional_info || {}),
        x_name: highLevelPayload.x_name || 'mental health',
      },

      participants: [
        this.processUserData(providerData, 'publisher'),
        this.processUserData(patientData, 'subscriber'),
      ],
    };



    try {
      const authPreview = headers.Authorization
        ? `${headers.Authorization.slice(0, 15)}...`
        : 'none';
      this.logger.log(
        `Creating remote consult at: ${url} with x_name: ${apiPayload.additional_info.x_name}; Authorization: ${authPreview}`,
      );
      this.logger.debug(
        `CURESELECT API REQUEST HEADERS: ${JSON.stringify(headers)}`,
      );
      this.logger.debug(
        `CURESELECT API REQUEST PAYLOAD: ${JSON.stringify(apiPayload)}`,
      );
      const response = await axios.post(url, apiPayload, { headers });

      this.logger.log(
        `CURESELECT API SUCCESS: ${JSON.stringify(response.data)}`,
      );
      return response.data;
    } catch (error) {
      // If 401, clear token and retry once
      if (error.response?.status === 401 && !highLevelPayload._retry) {
        this.logger.warn(
          'Cureselect API returned 401. Clearing token and retrying...',
        );
        this.token = null;
        this.tokenExpiry = null;
        return this.createConsult({ ...highLevelPayload, _retry: true });
      }

      const errorData = error.response ? error.response.data : error.message;
      const errorMsg =
        typeof errorData === 'object'
          ? JSON.stringify(errorData)
          : String(errorData);

      this.logger.error(`Cureselect API Create Error: ${errorMsg}`);
      throw new Error(`Tele-Consult API Error: ${errorMsg}`);
    }
  }

  async fetchConsultById(consultId: string | number): Promise<any> {
    const token = await this.getToken();
    if (!token) throw new Error('Could not authenticate with Cureselect API');

    const url = `${this.baseUrl}/v1/resource/consults/${consultId}`;
    const headers = { Authorization: token };

    try {
      const response = await axios.get(url, { headers, timeout: 10000 });
      return response.data;
    } catch (error) {
      this.logger.error(`Cureselect API Fetch Error: ${error.message}`);
      throw error;
    }
  }

  async fetchConsults(params: any = {}): Promise<any> {
    const token = await this.getToken();
    if (!token) throw new Error('Could not authenticate with Cureselect API');

    const url = `${this.baseUrl}/v1/resource/consults`;
    const headers = { Authorization: token };

    // Prepare parameters, ensuring x_name is included and ref_number is handled for Laravel
    const queryParams = {
      ...params,
      x_name: params.x_name || 'mental health',
    };

    if (queryParams.participant_ref_number && !Array.isArray(queryParams.participant_ref_number)) {
      queryParams.participant_ref_number = [String(queryParams.participant_ref_number)];
    }

    try {
      const response = await axios.get(url, {
        headers,
        params: queryParams,
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Cureselect API List Error: ${error.message}`);
      throw error;
    }
  }

  async patchConsult(consultId: string | number, payload: any): Promise<any> {
    const token = await this.getToken();
    if (!token) throw new Error('Could not authenticate with Cureselect API');

    const url = `${this.baseUrl}/v1/resource/consults/${consultId}`;
    const headers = {
      Authorization: token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    const apiPayload = {
      ...payload,
      x_name: payload.x_name || 'mental health',
    };

    try {
      const response = await axios.patch(url, apiPayload, {
        headers,
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Cureselect API Patch Error: ${error.message}`);
      throw error;
    }
  }

  async validateToken(token: string): Promise<any> {
    const remoteToken = await this.getToken();
    if (!remoteToken)
      throw new Error('Could not authenticate with Cureselect API');

    const url = `${this.baseUrl}/v1/consults/token-validate?token=${token}`;
    const headers = { Authorization: remoteToken };

    try {
      this.logger.log(`Calling Cureselect Token Validate: ${url}`);
      const response = await axios.get(url, { headers, timeout: 10000 });
      return response.data;
    } catch (error) {
      this.logger.error(`Cureselect API Token Validate Error: ${error.message}`);
      throw error;
    }
  }

  private formatDate(date: any): string {
    if (!date) return '';
    let d = new Date(date);
    
    const now = new Date();
    if (isNaN(d.getTime()) || d.getTime() < now.getTime()) {
      d = now;
    }

    d.setMinutes(d.getMinutes() + 2);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  public processUserData(data: any, role: string) {
    const user: any = {
      role: role,
      ref_number: String(data.id || ''),
      participant_info: {
        name: data.name || null,
      },
    };

    // Ensure additional_info is included if it exists in data
    const additionalInfo = data.additional_info || data.participant_info?.additional_info;
    if (additionalInfo) {
      user.participant_info.additional_info = additionalInfo;
    }

    return user;
  }
}
