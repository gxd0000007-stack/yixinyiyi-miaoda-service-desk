import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { createStoreBackupApi } from '@shared/store-backup-api';
import type {
  AddMembersRequest,
  CreateRoleRequest,
  CreateCustomerAssetRequest,
  CreateCustomerAssetResponse,
  CustomerAssetDetailResponse,
  CustomerAssetSegmentsResponse,
  CustomerAssetsResponse,
  CustomerCardWalletResponse,
  CustomerCardOperationResponse,
  CustomerLedgerFilter,
  CustomerLedgerResponse,
  CustomerFollowupTasksResponse,
  DeductCustomerCardRequest,
  DeductCustomerCardResponse,
  BatchSettleCustomerCardRequest,
  GrantCustomerCashVoucherRequest,
  CardPackageCatalogResponse,
  CardPackageMutationResponse,
  CompleteCustomerFollowupTaskRequest,
  CompleteCustomerFollowupTaskResponse,
  CreateCustomerCardRequest,
  CreateCardPackageRequest,
  CreateServiceProjectRequest,
  ForceRoleDTO,
  CreateInventoryProductRequest,
  InventoryCustomerSaleRequest,
  InventoryDashboardResponse,
  InventoryInboundRequest,
  InventoryInternalUseRequest,
  InventoryMutationResponse,
  OperatingAnalyticsRange,
  OperatingAnalyticsResponse,
  PurchaseWithCustomerBalanceRequest,
  RechargeCustomerCardRequest,
  RemoveMembersRequest,
  ReverseCustomerCardRequest,
  ReverseCustomerCardOperationRequest,
  ReverseCustomerCardResponse,
  SearchMembersRequest,
  SearchResponse,
  ServiceProjectMutationResponse,
  ServiceRoleResponse,
  ServiceAppointmentHistoryResponse,
  UpdateCustomerAssetSupplementRequest,
  UpdateCustomerAssetSupplementResponse,
  UpdateRoleRequest,
  UpdateInventoryProductCostRequest,
} from '@shared/api.interface';

const storeBackupApi = createStoreBackupApi(async <T>(request) =>
  axiosForBackend<T>(request),
);

export const { exportStoreBackup, restoreStoreBackup } = storeBackupApi;

export async function getCustomerFollowupTasks(): Promise<CustomerFollowupTasksResponse> {
  const response = await axiosForBackend<CustomerFollowupTasksResponse>({
    url: '/api/customer-followup-tasks',
    method: 'GET',
  });
  return response.data;
}

export async function completeCustomerFollowupTask(
  request: CompleteCustomerFollowupTaskRequest,
): Promise<CompleteCustomerFollowupTaskResponse> {
  const response = await axiosForBackend<CompleteCustomerFollowupTaskResponse>({
    url: '/api/customer-followup-task-complete',
    method: 'POST',
    data: request,
  });
  return response.data;
}

export async function getCardPackageCatalog(): Promise<CardPackageCatalogResponse> {
  const response = await axiosForBackend<CardPackageCatalogResponse>({
    url: '/api/card-items',
    method: 'GET',
  });
  return response.data;
}

export async function createCardPackage(
  request: CreateCardPackageRequest,
): Promise<CardPackageMutationResponse> {
  const response = await axiosForBackend<CardPackageMutationResponse>({
    url: '/api/card-items/packages',
    method: 'POST',
    data: request,
  });
  return response.data;
}

export async function createServiceProject(
  request: CreateServiceProjectRequest,
): Promise<ServiceProjectMutationResponse> {
  const response = await axiosForBackend<ServiceProjectMutationResponse>({
    url: '/api/card-items/projects',
    method: 'POST',
    data: request,
  });
  return response.data;
}

export async function getInventoryDashboard(): Promise<InventoryDashboardResponse> {
  try {
    const response = await axiosForBackend<InventoryDashboardResponse>({
      url: '/api/inventory',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('产品库存加载失败', error);
    throw error;
  }
}

export async function createInventoryProduct(
  request: CreateInventoryProductRequest,
): Promise<InventoryMutationResponse> {
  try {
    const response = await axiosForBackend<InventoryMutationResponse>({
      url: '/api/inventory/products',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('产品档案保存失败', error);
    throw error;
  }
}

export async function updateInventoryProductCost(
  productId: string,
  request: UpdateInventoryProductCostRequest,
): Promise<InventoryMutationResponse> {
  try {
    const response = await axiosForBackend<InventoryMutationResponse>({
      url: `/api/inventory/products/${encodeURIComponent(productId)}/cost`,
      method: 'PUT',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('产品成本保存失败', error);
    throw error;
  }
}

export async function getOperatingAnalytics(
  range: OperatingAnalyticsRange,
): Promise<OperatingAnalyticsResponse> {
  try {
    const response = await axiosForBackend<OperatingAnalyticsResponse>({
      url: `/api/inventory/operating-analytics?range=${encodeURIComponent(range)}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('门店经营数据加载失败', error);
    throw error;
  }
}

export async function inboundInventory(
  request: InventoryInboundRequest,
): Promise<InventoryMutationResponse> {
  try {
    const response = await axiosForBackend<InventoryMutationResponse>({
      url: '/api/inventory/inbound',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('产品扫码入库失败', error);
    throw error;
  }
}

export async function internalUseInventory(
  request: InventoryInternalUseRequest,
): Promise<InventoryMutationResponse> {
  try {
    const response = await axiosForBackend<InventoryMutationResponse>({
      url: '/api/inventory/internal-use',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('产品内部领用失败', error);
    throw error;
  }
}

export async function sellInventoryToCustomer(
  request: InventoryCustomerSaleRequest,
): Promise<InventoryMutationResponse> {
  try {
    const response = await axiosForBackend<InventoryMutationResponse>({
      url: '/api/inventory/customer-sale',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('产品客户销售失败', error);
    throw error;
  }
}

export async function getCurrentServiceRole(): Promise<ServiceRoleResponse> {
  const response = await axiosForBackend<ServiceRoleResponse>({
    url: `/api/service-role?permissionVersion=${encodeURIComponent('2026-08-17-inventory-scope-v3')}`,
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  return response.data;
}

export async function getRoles(): Promise<ForceRoleDTO[]> {
  const response = await axiosForBackend<ForceRoleDTO[]>({
    url: '/api/role_manager/roles',
    method: 'GET',
  });
  return response.data;
}

export async function createRole(data: CreateRoleRequest): Promise<void> {
  await axiosForBackend({
    url: '/api/role_manager/roles',
    method: 'POST',
    data,
  });
}

export async function updateRole(
  bizID: string,
  data: UpdateRoleRequest,
): Promise<void> {
  await axiosForBackend({
    url: `/api/role_manager/roles/${encodeURIComponent(bizID)}`,
    method: 'PUT',
    data,
  });
}

export async function deleteRole(bizID: string): Promise<void> {
  await axiosForBackend({
    url: `/api/role_manager/roles/${encodeURIComponent(bizID)}`,
    method: 'DELETE',
  });
}

export async function clearRoleMembers(bizID: string): Promise<void> {
  await axiosForBackend({
    url: `/api/role_manager/roles/${encodeURIComponent(bizID)}/members`,
    method: 'DELETE',
  });
}

export async function addRoleMembers(
  bizID: string,
  data: AddMembersRequest,
): Promise<void> {
  await axiosForBackend({
    url: `/api/role_manager/roles/${encodeURIComponent(bizID)}/members`,
    method: 'POST',
    data,
  });
}

export async function removeRoleMembers(
  bizID: string,
  data: RemoveMembersRequest,
): Promise<void> {
  await axiosForBackend({
    url: `/api/role_manager/roles/${encodeURIComponent(bizID)}/members/batch_remove`,
    method: 'POST',
    data,
  });
}

export async function searchMembers(
  data: SearchMembersRequest,
): Promise<SearchResponse> {
  const response = await axiosForBackend<SearchResponse>({
    url: '/api/role_manager/search',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function getServiceAppointmentHistory(): Promise<ServiceAppointmentHistoryResponse> {
  try {
    const response = await axiosForBackend<ServiceAppointmentHistoryResponse>({
      url: '/api/service-appointment-history',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('客户预约历史加载失败', error);
    throw error;
  }
}

export async function createCustomerAsset(
  request: CreateCustomerAssetRequest,
): Promise<CreateCustomerAssetResponse> {
  try {
    const response = await axiosForBackend<CreateCustomerAssetResponse>({
      url: '/api/customer-assets',
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('新增客户保存失败', error);
    throw error;
  }
}

export async function getCustomerAssets(params: {
  query: string;
  page: number;
  pageSize: number;
}): Promise<CustomerAssetsResponse> {
  try {
    const response = await axiosForBackend<CustomerAssetsResponse>({
      url: '/api/customer-assets',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('客户资料库加载失败', error);
    throw error;
  }
}

export async function searchCheckoutCustomers(params: {
  query: string;
  page: number;
  pageSize: number;
}): Promise<CustomerAssetsResponse> {
  try {
    const response = await axiosForBackend<CustomerAssetsResponse>({
      url: '/api/customer-assets/checkout-search',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('开单客户搜索失败', error);
    throw error;
  }
}

export async function getCustomerAssetDetail(
  id: string,
): Promise<CustomerAssetDetailResponse> {
  try {
    const response = await axiosForBackend<CustomerAssetDetailResponse>({
      url: `/api/customer-assets/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('客户资产详情加载失败', error);
    throw error;
  }
}

export async function getCheckoutCustomerDetail(
  id: string,
): Promise<CustomerAssetDetailResponse> {
  try {
    const response = await axiosForBackend<CustomerAssetDetailResponse>({
      url: `/api/customer-assets/${id}/checkout-detail`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('开单客户详情加载失败', error);
    throw error;
  }
}

export async function getCustomerLedger(params: {
  id: string;
  query: string;
  filter: CustomerLedgerFilter;
  page: number;
  pageSize: number;
}): Promise<CustomerLedgerResponse> {
  try {
    const response = await axiosForBackend<CustomerLedgerResponse>({
      url: `/api/customer-assets/${params.id}/ledger`,
      method: 'GET',
      params: {
        query: params.query,
        filter: params.filter,
        page: params.page,
        pageSize: params.pageSize,
      },
    });
    return response.data;
  } catch (error) {
    logger.error('客户逐笔消费账本加载失败', error);
    throw error;
  }
}

export async function getCustomerCardWallet(
  customerId: string,
): Promise<CustomerCardWalletResponse> {
  try {
    const response = await axiosForBackend<CustomerCardWalletResponse>({
      url: `/api/customer-assets/${customerId}/card-wallet`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('客户卡账户加载失败', error);
    throw error;
  }
}

export async function deductCustomerCard(
  customerId: string,
  request: DeductCustomerCardRequest,
): Promise<DeductCustomerCardResponse> {
  try {
    const response = await axiosForBackend<DeductCustomerCardResponse>({
      url: `/api/customer-assets/${customerId}/card-wallet/deductions`,
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('客户本次扣卡失败', error);
    throw error;
  }
}

export async function settleCustomerCards(
  customerId: string,
  request: BatchSettleCustomerCardRequest,
): Promise<CustomerCardOperationResponse> {
  const response = await axiosForBackend<CustomerCardOperationResponse>({
    url: `/api/customer-assets/${customerId}/card-wallet/settlements`,
    method: 'POST',
    data: request,
  });
  return response.data;
}

export async function grantCustomerCashVoucher(
  customerId: string,
  request: GrantCustomerCashVoucherRequest,
): Promise<CustomerCardWalletResponse> {
  const response = await axiosForBackend<CustomerCardWalletResponse>({
    url: `/api/customer-assets/${customerId}/card-wallet/cash-vouchers`,
    method: 'POST',
    data: request,
  });
  return response.data;
}

export async function createCustomerCard(
  customerId: string,
  request: CreateCustomerCardRequest,
): Promise<CustomerCardOperationResponse> {
  const response = await axiosForBackend<CustomerCardOperationResponse>({
    url: `/api/customer-assets/${customerId}/card-wallet/cards`,
    method: 'POST',
    data: request,
  });
  return response.data;
}

export async function rechargeCustomerCard(
  customerId: string,
  request: RechargeCustomerCardRequest,
): Promise<CustomerCardOperationResponse> {
  const response = await axiosForBackend<CustomerCardOperationResponse>({
    url: `/api/customer-assets/${customerId}/card-wallet/recharges`,
    method: 'POST',
    data: request,
  });
  return response.data;
}

export async function purchaseWithCustomerBalance(
  customerId: string,
  request: PurchaseWithCustomerBalanceRequest,
): Promise<CustomerCardOperationResponse> {
  const response = await axiosForBackend<CustomerCardOperationResponse>({
    url: `/api/customer-assets/${customerId}/card-wallet/purchases`,
    method: 'POST',
    data: request,
  });
  return response.data;
}

export async function reverseCustomerCardOperation(
  customerId: string,
  operationNo: string,
  request: ReverseCustomerCardOperationRequest,
): Promise<CustomerCardOperationResponse> {
  const response = await axiosForBackend<CustomerCardOperationResponse>({
    url:
      `/api/customer-assets/${customerId}/card-wallet/operations/` +
      `${operationNo}/reversals`,
    method: 'POST',
    data: request,
  });
  return response.data;
}

export async function reverseCustomerCardDeduction(
  customerId: string,
  transactionId: string,
  request: ReverseCustomerCardRequest,
): Promise<ReverseCustomerCardResponse> {
  try {
    const response = await axiosForBackend<ReverseCustomerCardResponse>({
      url:
        `/api/customer-assets/${customerId}/card-wallet/ledger/` +
        `${transactionId}/reversals`,
      method: 'POST',
      data: request,
    });
    return response.data;
  } catch (error) {
    logger.error('客户扣卡撤销失败', error);
    throw error;
  }
}

export async function getCustomerAssetSegments(): Promise<CustomerAssetSegmentsResponse> {
  try {
    const response = await axiosForBackend<CustomerAssetSegmentsResponse>({
      url: '/api/customer-assets/segments',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('客户资产分组加载失败', error);
    throw error;
  }
}

export async function updateCustomerAssetSupplement(
  id: string,
  request: UpdateCustomerAssetSupplementRequest,
): Promise<UpdateCustomerAssetSupplementResponse> {
  try {
    const response =
      await axiosForBackend<UpdateCustomerAssetSupplementResponse>({
        url: `/api/customer-assets/${id}/supplement`,
        method: 'PATCH',
        data: request,
      });
    return response.data;
  } catch (error) {
    logger.error('客户补充档案保存失败', error);
    throw error;
  }
}

// Add more API functions here, use axios instance (`axiosForBackend`) to make requests.
//
// 使用示例：
// export async function getUserData(userId: string) {
//   try {
//     const response = await axiosForBackend({
//       url: `/api/users/${userId}`,
//       method: 'GET'
//     });
//     return response.data;
//   } catch (error) {
//     logger.error('获取用户数据失败', error);
//     throw error;
//   }
// }
