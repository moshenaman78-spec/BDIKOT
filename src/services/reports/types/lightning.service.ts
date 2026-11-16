/**
 * LIGHTNING — דוח בדיקת מערכת הגנה מפני ברקים
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל נקודה) עד להעברת המבנה המלא.
 * TODO(LIGHTNING): להעביר מ-renderLightningReportCards (~15820), makeContinuityItem. הצהרות מ-04.
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const lightningService = facilitySkeletonService('LIGHTNING', { sectionTitle: 'רציפות והארקת מערכת הברקים', unitName: 'נקודה', icon: '🌩️' });
