import { Test, TestingModule } from '@nestjs/testing';
import { FleetServiceController } from './fleet-service.controller';
import { FleetServiceService } from './fleet-service.service';

describe('FleetServiceController', () => {
  let fleetServiceController: FleetServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [FleetServiceController],
      providers: [FleetServiceService],
    }).compile();

    fleetServiceController = app.get<FleetServiceController>(FleetServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(fleetServiceController.getHello()).toBe('Hello World!');
    });
  });
});
