/**
 * TOUCH_VOLTAGE — דוח בדיקת מתח מגע
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל נקודה) עד להעברת המבנה המלא.
 * TODO(TOUCH_VOLTAGE): להעביר מ-renderTouchVoltageReportCards (~18858), makeTouchStepItem. הצהרות מ-06.
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const touchVoltageService = facilitySkeletonService('TOUCH_VOLTAGE', { sectionTitle: 'מדידות מתח מגע וצעד', unitName: 'נקודה', icon: '✋' });
