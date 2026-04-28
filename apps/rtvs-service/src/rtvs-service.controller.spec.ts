import { Test, TestingModule } from '@nestjs/testing';
import { RtvsServiceController } from './rtvs-service.controller';
import { RtvsServiceService } from './rtvs-service.service';

describe('RtvsServiceController', () => {
  let rtvsServiceController: RtvsServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [RtvsServiceController],
      providers: [RtvsServiceService],
    }).compile();

    rtvsServiceController = app.get<RtvsServiceController>(
      RtvsServiceController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(rtvsServiceController.getHello()).toBe('Hello World!');
    });
  });
});
