import { today } from '../../../core/utils/DateHelper';

/** Static test configuration for the fix_repair module */
export const FIX_REPAIR_TEST_CONFIG = {
  repairTypeNotUnderWarrantyNoSerial: 'Repair - Not Under Warranty (Without Ser',
  jobLocationFactory: 'Factory Repair',
  jobLocationCentre: 'Centre Repair',
  returnReceiptLocationExample: 'BR-AM/Stock',
  // Confirmed to exist on the target instance (Data.txt) — used to reach the
  // "Send to Factory" step deterministically, rather than picking whichever
  // autocomplete result happens to be first.
  customerExample: 'KURUNEGALA CASH CUSTOMER',
  productExample: '[JMC6] Multi Chopper 6Hp (Tractor Type)',
  // Short, unique substring for the product search — searching the full
  // bracketed display name confirmed a match server-side but proved fragile
  // client-side (the autocomplete's dropdown render didn't reliably keep pace
  // with the longer query); the product code alone is a safer search term for
  // the same result.
  productSearchTerm: 'JMC6',
  repairReasonExample: 'Difficult to start the engine',
  // Spelled exactly as configured on the instance (sic).
  repairReasonLowPressure: 'Low Pressue',
  // Repair Diagnosis reference values confirmed to exist on this instance
  // (Data.txt) — note "Base Plate" and "Reject" here vs. "Base plate" (lower
  // "p") and "REP" observed directly in the live dropdowns; matched
  // case-insensitively / by substring where the picker allows it.
  diagnosisArea: 'Burnt Part',
  diagnosisCode: 'Base plate',
  diagnosisReason: 'Internal',
  diagnosisSubReason: 'Hi Voltage',
  diagnosisResolution: 'Reject',
  diagnosisRepairStage: '1-REP-REC',
  repairImagePath: 'WaterPump.jpg',
  // Spare part added to the repair quotation via the task's "Products"
  // catalog — [02BB 023] BALL BEARING 6202-2RS, has stock on this instance.
  quotationProductSearchTerm: '02BB 023',
} as const;

export function getFixRepairDates() {
  return { dateStart: today() };
}
