/**
 * PV_INSPECTION — טופס בדיקה של מתקן פוטו-וולטאי
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל מערך) עד להעברת המבנה המלא.
 * TODO(PV_INSPECTION): להעביר מ-renderPvInspectionCards (~2889), makePvInspection, makePvParty, makePvRcd, makePvItMonitor, buildPvCoverHtml (עמוד שער).
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const pvInspectionService = facilitySkeletonService('PV_INSPECTION', { sectionTitle: 'מערכת פוטו-וולטאית', unitName: 'מערך', icon: '☀️' });
