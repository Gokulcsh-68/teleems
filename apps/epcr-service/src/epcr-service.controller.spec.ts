import { Test, TestingModule } from '@nestjs/testing';
import { EpcrServiceController } from './epcr-service.controller';
import { EpcrServiceService } from './epcr-service.service';

describe('EpcrServiceController', () => {
  let epcrServiceController: EpcrServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [EpcrServiceController],
      providers: [EpcrServiceService],
    }).compile();

    epcrServiceController = app.get<EpcrServiceController>(EpcrServiceController);
  });

});
