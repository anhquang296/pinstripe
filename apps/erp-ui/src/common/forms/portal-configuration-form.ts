import { zodResolver } from '@hookform/resolvers/zod';
import type {
  BillingPortalConfigurationResponse,
  CreateBillingPortalConfigurationPayload,
  UpdateBillingPortalConfigurationPayload,
} from '@vxrerp/sdk';
import { z } from 'zod';

const portalConfigurationFormSchema = z.object({
  businessName: z.string().min(1, 'Tên hiển thị là bắt buộc'),
  defaultReturnUrl: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  canViewInvoiceHistory: z.boolean(),
  canUpdatePaymentMethod: z.boolean(),
  canCancelSubscription: z.boolean(),
});

export type PortalConfigurationFormData = z.infer<typeof portalConfigurationFormSchema>;

export const portalConfigurationFormResolver = zodResolver(portalConfigurationFormSchema);

export const portalConfigurationFormDefaultValues: PortalConfigurationFormData = {
  businessName: '',
  defaultReturnUrl: '',
  isDefault: false,
  isActive: true,
  canViewInvoiceHistory: true,
  canUpdatePaymentMethod: true,
  canCancelSubscription: false,
};

export function portalConfigurationToFormData(
  configuration: BillingPortalConfigurationResponse,
): PortalConfigurationFormData {
  const { defaultReturnUrl, features } = configuration;

  return {
    businessName: configuration.businessName,
    defaultReturnUrl: defaultReturnUrl ?? '',
    isDefault: configuration.isDefault,
    isActive: configuration.isActive,
    canViewInvoiceHistory: features.canViewInvoiceHistory,
    canUpdatePaymentMethod: features.canUpdatePaymentMethod,
    canCancelSubscription: features.canCancelSubscription,
  };
}

export function portalConfigurationFormDataToPayload(
  formData: PortalConfigurationFormData,
): CreateBillingPortalConfigurationPayload {
  return {
    businessName: formData.businessName,
    defaultReturnUrl: formData.defaultReturnUrl || undefined,
    isDefault: formData.isDefault,
    features: {
      canViewInvoiceHistory: formData.canViewInvoiceHistory,
      canUpdatePaymentMethod: formData.canUpdatePaymentMethod,
      canCancelSubscription: formData.canCancelSubscription,
    },
  };
}

export function portalConfigurationFormDataToUpdatePayload(
  formData: PortalConfigurationFormData,
): UpdateBillingPortalConfigurationPayload {
  return {
    businessName: formData.businessName,
    defaultReturnUrl: formData.defaultReturnUrl || undefined,
    isDefault: formData.isDefault,
    isActive: formData.isActive,
    features: {
      canViewInvoiceHistory: formData.canViewInvoiceHistory,
      canUpdatePaymentMethod: formData.canUpdatePaymentMethod,
      canCancelSubscription: formData.canCancelSubscription,
    },
  };
}
