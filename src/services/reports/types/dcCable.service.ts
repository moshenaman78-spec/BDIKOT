/**
 * DC_CABLE — בדיקת בידוד וקוטביות כבלי וגידי DC
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל קבוצה) עד להעברת המבנה המלא.
 * TODO(DC_CABLE): להעביר מ-renderDcCableTestCards (~14498), makeDcCableGroup, makeDcCableRow.
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const dcCableService = facilitySkeletonService('DC_CABLE', { sectionTitle: 'כבלי וגידי DC', unitName: 'קבוצה', icon: '〰️' });
