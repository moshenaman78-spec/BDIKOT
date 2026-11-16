/**
 * EV_DC — בדיקת עמדת טעינה DC (לא מוצג בבורר — נפתח מתוך עמדת טעינה)
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל עמדה) עד להעברת המבנה המלא.
 * TODO(EV_DC): להעביר מ-renderEvDcTestCards (~20162), makeEvDcVisualItem, makeEvDcRisoRow, makeEvDcLoopRow, makeEvDcBreakerRow, makeEvDcCableRow, makeEvDcRcdTestRow.
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const evDcService = facilitySkeletonService('EV_DC', { sectionTitle: 'עמדות טעינה DC', unitName: 'עמדה', icon: '⚡' });
