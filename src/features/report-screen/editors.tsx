/**
 * features/report-screen/editors.tsx — אילו סוגי דוחות הועברו לאפליקציה החדשה, ועורך לכל אחד.
 * סוג שלא מופיע כאן — נפתח באפליקציה הקיימת.
 */
import type { ComponentType } from 'react';
import type { ReportData } from '@/core/reportModel';
import type { ReportTypeCode } from '@/core/reportTypes';
import type { Mutate, SharedEditorProps } from '@/components/shared-sections';
import { TransformerInspectionEditor } from '@/features/reports/TRANSFORMER_INSPECTION/TransformerInspectionEditor';
import { MainPanelEditor } from '@/features/reports/MAIN_PANEL/MainPanelEditor';

export interface EditorProps { data: ReportData; mutate: Mutate; shared?: SharedEditorProps }

export const MIGRATED_EDITORS: Partial<Record<ReportTypeCode, ComponentType<EditorProps>>> = {
  TRANSFORMER_INSPECTION: TransformerInspectionEditor,
  MAIN_PANEL: MainPanelEditor,
};

export const MIGRATED_TYPES = Object.keys(MIGRATED_EDITORS) as ReportTypeCode[];
