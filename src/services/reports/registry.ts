/**
 * services/reports/registry.ts — שירות לכל אחד מ-19 סוגי הדוחות.
 * Record<ReportTypeCode, ...> מבטיח בזמן קומפילציה שאף סוג לא חסר.
 */
import type { ReportData, ReportDocument } from '@/core/reportModel';
import { reportTypeFromHebrewName, type ReportTypeCode } from '@/core/reportTypes';
import { relaysApply, validateRelays } from '@/services/shared/protectionRelays';
import { buildReportDocument, readTypeData, type DocumentOptions, type ReportTypeService, type ValidationIssue } from './ReportTypeService';
import { validateInstruments } from '@/services/shared/testInstruments';
import { dcCableService } from './types/dcCable.service';
import { evcsService } from './types/evcs.service';
import { evDcService } from './types/evDc.service';
import { fireForm3Service } from './types/fireForm3.service';
import { flexibleService } from './types/flexible.service';
import { generalService } from './types/general.service';
import { generatorService } from './types/generator.service';
import { groundingService } from './types/grounding.service';
import { hvCableService } from './types/hvCable.service';
import { lightningService } from './types/lightning.service';
import { mainPanelService } from './types/mainPanel.service';
import { medicalService } from './types/medical.service';
import { pvInspectionService } from './types/pvInspection.service';
import { smaService } from './types/sma.service';
import { soilService } from './types/soil.service';
import { stringPolarityService } from './types/stringPolarity.service';
import { touchVoltageService } from './types/touchVoltage.service';
import { transformerInspectionService } from './types/transformerInspection.service';
import { transformerWindingService } from './types/transformerWinding.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyService = ReportTypeService<any>;

export const REPORT_SERVICES: Readonly<Record<ReportTypeCode, AnyService>> = {
  SMA: smaService,
  SOIL: soilService,
  GROUNDING: groundingService,
  DC_CABLE: dcCableService,
  EVCS: evcsService,
  EV_DC: evDcService,
  GENERAL: generalService,
  MEDICAL: medicalService,
  LIGHTNING: lightningService,
  TOUCH_VOLTAGE: touchVoltageService,
  TRANSFORMER_WINDING: transformerWindingService,
  HV_CABLE: hvCableService,
  FLEXIBLE: flexibleService,
  MAIN_PANEL: mainPanelService,
  TRANSFORMER_INSPECTION: transformerInspectionService,
  GENERATOR: generatorService,
  STRING_POLARITY: stringPolarityService,
  PV_INSPECTION: pvInspectionService,
  FIRE_FORM3: fireForm3Service,
};

export function serviceFor(code: ReportTypeCode): AnyService {
  return REPORT_SERVICES[code];
}

export function serviceForData(data: ReportData): AnyService {
  return serviceFor(reportTypeFromHebrewName(data.settings.formTypeName));
}

export function validateReport(data: ReportData, opts: DocumentOptions = {}): ValidationIssue[] {
  const svc = serviceForData(data);
  return [
    ...svc.validate(readTypeData(svc, data), data),
    ...(relaysApply(svc.code) ? validateRelays(data) : []),
    // מכשירי בדיקה ותוקף כיול — רק כשנטענה רשימת המכשירים (אחרת אין על מה לבדוק)
    ...(opts.equipment && svc.definition.documentKind === 'company-letterhead' ? validateInstruments(data, opts.equipment, opts.today) : []),
  ];
}

export function renderReportDocument(
  data: ReportData,
  lastUpdatedAt: string | null = data.settings.cloudKnownUpdatedAt,
  opts: DocumentOptions = {},
): ReportDocument {
  return buildReportDocument(serviceForData(data), data, lastUpdatedAt, opts);
}
