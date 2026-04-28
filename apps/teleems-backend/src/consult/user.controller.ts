import { Controller, Post, Body, UseGuards, Req, Patch } from '@nestjs/common';
import { ConsultService } from './consult.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';


@Controller('v1/auth/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly consultService: ConsultService) { }

  @Post('emergency-doctor')
  @Roles('CureSelect Admin', 'Doctor', 'Emergency doctor')
  createEmergencyDoctor(@Body() body: { name: string; phone: string; username?: string; password?: string; role?: string }, @Req() req: any) {
    return this.consultService.createEmergencyDoctor(req.user, body);
  }

  @Patch('availability')
  @Roles('Doctor', 'Emergency doctor')
  updateAvailability(@Body() body: { isAvailable: boolean }, @Req() req: any) {
    return this.consultService.updateAvailability(req.user, body.isAvailable);
  }
}
 