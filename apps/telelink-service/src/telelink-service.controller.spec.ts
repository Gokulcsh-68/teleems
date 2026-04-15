import { Test, TestingModule } from '@nestjs/testing';
import { TelelinkServiceController } from './telelink-service.controller';
import { TelelinkServiceService } from './telelink-service.service';

describe('TelelinkServiceController', () => {
  let telelinkServiceController: TelelinkServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [TelelinkServiceController],
      providers: [TelelinkServiceService],
    }).compile();

    telelinkServiceController = app.get<TelelinkServiceController>(TelelinkServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(telelinkServiceController.getHello()).toBe('Hello World!');
    });
  });
});
