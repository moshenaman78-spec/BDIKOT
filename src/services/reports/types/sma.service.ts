/**
 * SMA — טיפול בממירי SMA (שם היצרן דינמי)
 * שלד: מבנה מתקנים אחיד (כרטיס כהה לכל ממיר) עד להעברת המבנה המלא.
 * TODO(SMA): להעביר מ-render ברירת המחדל (panels/panelOrder), makePanel, makeItemPair, makeDccbItem, makeDpsItem, makeStorageContainer. כותרת וקידומת לפי inverterBrand.
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const smaService = facilitySkeletonService('SMA', { sectionTitle: 'ממירים ולוחות DC/AC', unitName: 'ממיר', icon: '🔌' });
