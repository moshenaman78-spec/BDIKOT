/**
 * STRING_POLARITY — בדיקת קוטביות סטרינגים ולוחות DCCB
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל ממיר) עד להעברת המבנה המלא.
 * TODO(STRING_POLARITY): להעביר מ-renderStringPolarityReportCards (~18468), makeStringPolarityReport, makeStringPolarityInverter, makeStringPolarityCircuit, makeStringPolarityDccbPanel, makeStringPolarityCable. הצהרות מ-05.
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const stringPolarityService = facilitySkeletonService('STRING_POLARITY', { sectionTitle: 'ממירים, מעגלים ולוחות DCCB', unitName: 'ממיר', icon: '🔀' });
