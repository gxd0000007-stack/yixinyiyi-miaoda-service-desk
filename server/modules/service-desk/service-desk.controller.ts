import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CanRole, NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import type {
  AppointmentMutationRequest,
  AppointmentMutationResponse,
  CompleteCustomerFollowupTaskRequest,
  CompleteCustomerFollowupTaskResponse,
  CompleteServiceRequest,
  CompleteServiceResponse,
  ConfigureServiceRequest,
  ConfigureServiceResponse,
  SaveServiceAppointmentRequest,
  SaveServiceAppointmentResponse,
  ServiceActor,
  ServiceAppointmentHistoryResponse,
  ServiceAppointmentsResponse,
  CustomerFollowupTasksResponse,
  ServiceRoleResponse,
  ServiceStateResponse,
  UpdateServiceAssignmentRequest,
  UpdateServiceAssignmentResponse,
  UpdateServiceStaffScheduleRequest,
  UpdateServiceStaffScheduleResponse,
  UpdateServiceStateRequest,
} from '@shared/api.interface';
import {
  FRONT_DESK_ROLE,
  NURSE_ROLE,
  SKIN_MANAGER_ROLE,
  STORE_OWNER_ROLE,
} from '../../../shared/role.constants';
import { ServiceDeskService } from './service-desk.service';
import { CustomerReminderService } from './customer-reminder.service';

@Controller('api')
export class ServiceDeskController {
  constructor(
    private readonly serviceDeskService: ServiceDeskService,
    private readonly customerReminderService: CustomerReminderService,
  ) {}

  @NeedLogin()
  @CanRole([
    STORE_OWNER_ROLE,
    FRONT_DESK_ROLE,
    SKIN_MANAGER_ROLE,
    NURSE_ROLE,
  ])
  @Get('customer-followup-tasks')
  async getCustomerFollowupTasks(): Promise<CustomerFollowupTasksResponse> {
    return this.customerReminderService.getTodayFollowupTasks();
  }

  @NeedLogin()
  @CanRole([
    STORE_OWNER_ROLE,
    FRONT_DESK_ROLE,
    SKIN_MANAGER_ROLE,
    NURSE_ROLE,
  ])
  @Post('customer-followup-task-complete')
  async completeCustomerFollowupTask(
    @Req() request: Request,
    @Body() body: CompleteCustomerFollowupTaskRequest,
  ): Promise<CompleteCustomerFollowupTaskResponse> {
    return this.customerReminderService.completeFollowupTask(
      body,
      this.getActor(request),
    );
  }

  @NeedLogin()
  @CanRole([
    STORE_OWNER_ROLE,
    FRONT_DESK_ROLE,
    SKIN_MANAGER_ROLE,
    NURSE_ROLE,
  ])
  @Get('service-state')
  async getServiceState(
    @Query('appointmentId') appointmentId = '1',
  ): Promise<ServiceStateResponse> {
    return this.serviceDeskService.getState(appointmentId);
  }

  @NeedLogin()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @Get('service-role')
  async getServiceRole(@Req() request: Request): Promise<ServiceRoleResponse> {
    return this.serviceDeskService.getRole(this.getActor(request));
  }

  @NeedLogin()
  @CanRole([
    STORE_OWNER_ROLE,
    FRONT_DESK_ROLE,
    SKIN_MANAGER_ROLE,
    NURSE_ROLE,
  ])
  @Get('service-appointments')
  async getServiceAppointments(): Promise<ServiceAppointmentsResponse> {
    return this.serviceDeskService.getAppointments();
  }

  @NeedLogin()
  @CanRole([
    STORE_OWNER_ROLE,
    FRONT_DESK_ROLE,
    SKIN_MANAGER_ROLE,
    NURSE_ROLE,
  ])
  @Get('service-appointment-history')
  async getServiceAppointmentHistory(): Promise<ServiceAppointmentHistoryResponse> {
    return this.serviceDeskService.getAppointmentHistory();
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Patch('service-appointment')
  async saveAppointment(
    @Req() request: Request,
    @Body() body: SaveServiceAppointmentRequest,
  ): Promise<SaveServiceAppointmentResponse> {
    return this.serviceDeskService.saveAppointment(body, this.getActor(request));
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Patch('service-staff-schedule')
  async updateStaffSchedule(
    @Req() request: Request,
    @Body() body: UpdateServiceStaffScheduleRequest,
  ): Promise<UpdateServiceStaffScheduleResponse> {
    return this.serviceDeskService.updateStaffSchedule(body, this.getActor(request));
  }

  @NeedLogin()
  @CanRole([
    STORE_OWNER_ROLE,
    FRONT_DESK_ROLE,
    SKIN_MANAGER_ROLE,
    NURSE_ROLE,
  ])
  @Patch('service-state')
  async updateServiceState(
    @Req() request: Request,
    @Body() body: UpdateServiceStateRequest,
  ): Promise<ServiceStateResponse> {
    return this.serviceDeskService.updateState(body, this.getActor(request));
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Patch('service-assignment')
  async updateServiceAssignment(
    @Req() request: Request,
    @Body() body: UpdateServiceAssignmentRequest,
  ): Promise<UpdateServiceAssignmentResponse> {
    return this.serviceDeskService.updateAssignment(
      body,
      this.getActor(request),
    );
  }

  @NeedLogin()
  @CanRole([
    STORE_OWNER_ROLE,
    FRONT_DESK_ROLE,
    SKIN_MANAGER_ROLE,
    NURSE_ROLE,
  ])
  @Post('service-complete')
  async completeService(
    @Req() request: Request,
    @Body() body: CompleteServiceRequest,
  ): Promise<CompleteServiceResponse> {
    return this.serviceDeskService.completeService(
      body,
      this.getActor(request),
    );
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE])
  @Post('service-config')
  async configureService(
    @Req() request: Request,
    @Body() body: ConfigureServiceRequest,
  ): Promise<ConfigureServiceResponse> {
    return this.serviceDeskService.configure(body, this.getActor(request));
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE])
  @Delete('service-appointment')
  async deleteAppointment(
    @Req() request: Request,
    @Query('appointmentId') appointmentId = '',
  ): Promise<AppointmentMutationResponse> {
    return this.serviceDeskService.deleteAppointment(
      appointmentId,
      this.getActor(request),
    );
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE])
  @Post('service-appointment/restore')
  async restoreAppointment(
    @Req() request: Request,
    @Body() body: AppointmentMutationRequest,
  ): Promise<AppointmentMutationResponse> {
    return this.serviceDeskService.restoreAppointment(
      body.appointmentId,
      this.getActor(request),
    );
  }

  private getActor(request: Request): ServiceActor {
    const displayName: string = request.userContext?.userName || '门店员工';
    const userId: string | undefined = request.userContext?.userId || undefined;
    const roles: string[] = Array.isArray(request.userContext?.roles)
      ? request.userContext.roles.filter(
          (role: unknown): role is string => typeof role === 'string',
        )
      : [];
    return { displayName, userId, roles };
  }
}
