import { Test, TestingModule } from '@nestjs/testing';
import { HospitalServiceController } from './hospital-service.controller';
import { HospitalServiceService } from './hospital-service.service';

describe('HospitalServiceController', () => {
  let hospitalServiceController: HospitalServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HospitalServiceController],
      providers: [HospitalServiceService],
    }).compile();

    hospitalServiceController = app.get<HospitalServiceController>(HospitalServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(hospitalServiceController.getHello()).toBe('Hello World!');
    });
  });
});
