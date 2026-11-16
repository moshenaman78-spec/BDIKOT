/**
 * FLEXIBLE — דוח גמיש
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל סעיף) עד להעברת המבנה המלא.
 * TODO(FLEXIBLE): להעביר מ-renderFlexibleReportCards (~16653), makeFlexibleSection, makeFlexibleTableSection, makeFlexibleFinding, makeFlexPanelChecklist, makeFlexFire — סעיפים חופשיים שהמשתמש מגדיר.
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const flexibleService = facilitySkeletonService('FLEXIBLE', { sectionTitle: 'סעיפי הדוח', unitName: 'סעיף', icon: '🧩' });
