/**
 * GROUNDING — בדיקת התנגדות אלקטרודת הארקה למסה הכללית של האדמה
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל אלקטרודה) עד להעברת המבנה המלא.
 * TODO(GROUNDING): להעביר מ-renderGroundingTestCards (~14049), makeGroundingClampTest, makeGroundingSelectiveTest, buildGroundingCalcTraceHtml (חישוב Fall-of-Potential).
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const groundingService = facilitySkeletonService('GROUNDING', { sectionTitle: 'מדידות התנגדות הארקה', unitName: 'אלקטרודה', icon: '⏚' });
