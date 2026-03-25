export type WarningType = 'low' | 'critical' | 'empty';

export interface CreditWarning {
  threshold_absolute: number;
  warning_type: WarningType;
  message: string;
}
