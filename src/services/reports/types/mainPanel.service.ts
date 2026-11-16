/**
 * MAIN_PANEL — דוח בדיקת לוח חשמל ראשי (משמש גם ללוחות מתח גבוה; קידומת HV;
 * תיקיית טיוטות "בדיקות מתח גבוה"). סעיפים 01–03, הצהרות מ-04.
 * TODO(MAIN_PANEL): להעביר מ-renderMainPanelReportCards (שורה ~16406) ומ-makeMainPanelFacility,
 *   makeMainPanelBreaker, makeMainPanelCell, makeMainPanelLoopTest, makeMainPanelCurrentCT,
 *   makeMainPanelProtectionCT — בדיקות הבידוד ממוזגות לתוך סעיף 02 (v2.216).
 */
import { facilitySkeletonService } from '../facilitySkeleton';

export const mainPanelService = facilitySkeletonService('MAIN_PANEL', {
  sectionTitle: 'לוחות ובדיקות', unitName: 'לוח', icon: '🗄️',
  defaultChecklist: ['שילוט וזיהוי מעגלים', 'הארקה ופס השוואת פוטנציאלים', 'מצב פיזי וניקיון', 'הידוק חיבורים', 'התאמת מפסקים לחתכי כבלים'],
});
