import { Logger } from '@nestjs/common';
import { Automation, BindTrigger } from '@lark-apaas/fullstack-nestjs-core';

import {
  CustomerReminderService,
  type AutomatedReminderResult,
} from './customer-reminder.service';

@Automation()
export class ServiceDeskAutomation {
  private readonly logger = new Logger(ServiceDeskAutomation.name);

  constructor(
    private readonly customerReminderService: CustomerReminderService,
  ) {}

  @BindTrigger('daily-tomorrow-birthday-reminder')
  async sendTomorrowBirthdayReminder(): Promise<void> {
    const result: AutomatedReminderResult =
      await this.customerReminderService.sendTomorrowBirthdayReminder();
    this.logger.log(
      `两天后生日提醒完成: ${JSON.stringify(result)}`,
    );
  }

  @BindTrigger('daily-today-followup-reminder')
  async sendTodayFollowupReminder(): Promise<void> {
    const result: AutomatedReminderResult =
      await this.customerReminderService.sendTodayFollowupReminder();
    this.logger.log(
      `今日回访提醒完成: ${JSON.stringify(result)}`,
    );
  }
}
