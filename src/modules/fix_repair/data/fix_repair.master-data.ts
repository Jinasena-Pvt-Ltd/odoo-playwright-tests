import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { today } from '../../../core/utils/DateHelper';

/**
 * Pictures for the "Take a Picture" uploads: whatever PNG or JPEG is on the Desktop (checked by
 * its file header, so a renamed text file is not used), sorted by name. The warranty card takes
 * the first, the repair image the second when there is one. Nothing is hardcoded: with no picture
 * on the Desktop, a test that uploads one stops with a message saying so.
 */
function desktopImages(): string[] {
  const dirs = [path.join(os.homedir(), 'Desktop'), path.join(os.homedir(), 'OneDrive', 'Desktop')];
  const isImage = (file: string) => {
    try {
      const head = Buffer.alloc(8);
      const fd = fs.openSync(file, 'r');
      fs.readSync(fd, head, 0, 8, 0);
      fs.closeSync(fd);
      const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
      const png = head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      return jpeg || png;
    } catch {
      return false;
    }
  };
  return dirs
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) => fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort().map((f) => path.join(dir, f)))
    .filter(isImage);
}

const DESKTOP_IMAGES = desktopImages();

function desktopImage(index: number): string {
  const file = DESKTOP_IMAGES[index] ?? DESKTOP_IMAGES[0];
  if (!file) throw new Error(`No PNG or JPEG picture on the Desktop (${path.join(os.homedir(), 'Desktop')}) to upload`);
  return file;
}

/** Static test configuration for the fix_repair module */
export const FIX_REPAIR_TEST_CONFIG = {
  repairTypeNotUnderWarrantyNoSerial: 'Repair - Not Under Warranty (Without Ser',
  // 'Not Under Warranty (With Serial No)' flow (tour 3A): unique substring of the type name.
  repairTypeNotUnderWarrantyWithSerial: 'Not Under Warranty (With Serial',
  // 'Under Warranty - RUG (Approved)' flow (tour 2A): the type is picked by a
  // unique substring. The Serial Number field only offers serials already sold
  // to a customer (e.g. 0630_001 in the tour); the spec picks a clean one at
  // run time and falls back to this value.
  repairTypeUnderWarrantyRug: 'Under Warranty - RUG',
  // 'Under Warranty (External not RUG)' flow (tour 4A): the instance's option is
  // 'Repair - Under Warranty -  External not RUG' (note the double space), so a
  // unique substring is used.
  repairTypeUnderWarrantyExternal: 'External not RUG',
  serialNumberExample: '0630_001',
  get warrantyCardImagePath() { return desktopImage(0); },
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
  get repairImagePath() { return desktopImage(1); },
  // Spare part added to the repair quotation via the task's "Products"
  // catalog — [02BB 023] BALL BEARING 6202-2RS, has stock on this instance.
  quotationProductSearchTerm: '02BB 023',
} as const;

export function getFixRepairDates() {
  return { dateStart: today() };
}
