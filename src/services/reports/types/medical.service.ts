/**
 * MEDICAL — דוח בדיקה למתקן רפואי — קבוצת שימוש 2
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל חדר) עד להעברת המבנה המלא.
 * TODO(MEDICAL): להעביר מ-renderMedicalReportCards (~18993), makeMedicalChecklistItem, makeMedicalMonitorMeasurement, makeAntiStaticFloorPoint, MEDICAL_STATUS_OPTIONS.
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const medicalService = facilitySkeletonService('MEDICAL', { sectionTitle: 'חדרים רפואיים', unitName: 'חדר', icon: '🏥' });
