"use server";

export {
  createTaskAction,
  createEmployeeAction,
  createDealAction,
} from './actions/index';
export type {
  ActionResult,
  CreateTaskPayload,
  CreateEmployeePayload,
  CreateDealPayload,
} from './actions/index';
