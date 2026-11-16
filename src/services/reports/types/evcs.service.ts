/**
 * EVCS — בדיקת עמדת טעינה
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל עמדה) עד להעברת המבנה המלא.
 * TODO(EVCS): להעביר מ-renderEvcsReportCards (~19760), makeEvcsStation, makeInstallationSupply. סעיפים 01–03, הצהרות מ-04.
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const evcsService = facilitySkeletonService('EVCS', { sectionTitle: 'עמדות טעינה', unitName: 'עמדה', icon: '🚗' });
