/**
 * TRANSFORMER_WINDING — דוח בדיקת התנגדות סלילים בשטח
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל שנאי) עד להעברת המבנה המלא.
 * TODO(TRANSFORMER_WINDING): להעביר מ-renderTransformerWindingReportCards (~17630), makeWindingTapRow — כולל תיקון טמפרטורה ו-DGPT (סעיפים 01–08, הצהרות מ-09).
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const transformerWindingService = facilitySkeletonService('TRANSFORMER_WINDING', { sectionTitle: 'התנגדות סלילים', unitName: 'שנאי', icon: '🌀' });
