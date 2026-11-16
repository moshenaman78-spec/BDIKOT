/**
 * GENERAL — דוח כללי לבדיקת מתקן חשמל
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל לוח) עד להעברת המבנה המלא.
 * TODO(GENERAL): להעביר מ-renderGeneralInspectionCards (~19232), makeGeneralSupply, makeGeneralInspectionSection, makeGeneralBoardCircuitRow, makeGeneralFinalCircuitRow, makeGeneralRcdTestType. הצהרות מ-15.
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const generalService = facilitySkeletonService('GENERAL', { sectionTitle: 'לוחות ומעגלים', unitName: 'לוח', icon: '🏢' });
