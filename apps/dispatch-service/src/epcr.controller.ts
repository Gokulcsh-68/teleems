import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../libs/common/src/guards/jwt-auth.guard';
import { RolesGuard } from '../../../libs/common/src/guards/roles.guard';
import { Roles } from '../../../libs/common/src/decorators/roles.decorator';
import { v4 as uuid } from 'uuid';

@Controller('v1/epcr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EpcrController {
  
  @Post('generate/:dispatchId')
  @Roles('EMT / Paramedic')
  async generateEpcr(@Param('dispatchId') dispatchId: string) {
    console.log(`[EPCR] Generating draft for dispatch: ${dispatchId}`);
    return {
      status: 200,
      message: 'ePCR Draft Generated',
      data: {
        id: uuid(),
        dispatch_id: dispatchId,
        status: 'DRAFT',
        preview_url: 'https://cdn.teleems.com/previews/epcr-draft-sample.pdf'
      }
    };
  }

  @Post(':epcrId/signatures/emt')
  @Roles('EMT / Paramedic')
  @HttpCode(200)
  async submitEmtSignature(
    @Param('epcrId') epcrId: string,
    @Body() dto: any
  ) {
    console.log(`[EPCR] EMT Signature received for ${epcrId}`);
    return {
      status: 200,
      message: 'EMT Signature captured'
    };
  }

  @Post(':epcrId/signatures/clinician')
  @Roles('EMT / Paramedic')
  @HttpCode(200)
  async submitClinicianSignature(
    @Param('epcrId') epcrId: string,
    @Body() dto: any
  ) {
    console.log(`[EPCR] Clinician Signature received for ${epcrId}. Finalizing ePCR.`);
    return {
      status: 200,
      message: 'Clinician Signature captured. Handoff finalized.'
    };
  }
}
