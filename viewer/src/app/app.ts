import { Component, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TX_COUNTY_CODE_TO_NAME, TX_COUNTY_NAME_TO_CODE } from './tx-county-codes';

// ---- Oklahoma: OCC ArcGIS REST API (live) ----

interface OkFeature<T> {
  attributes: T;
  geometry?: { x: number; y: number };
}

interface OkWellAttributes {
  objectid: number;
  api_number: number;
  well_name: string;
  operator_name: string;
  well_status: string;
  well_type: string;
  county: string;
  spud: number | null;
  well_completion: number | null;
  total_depth: number | null;
}

interface OkPermitAttributes {
  objectid: number;
  api_number: number;
  entity_name: string;
  well_name: string;
  well_number: string;
  application_type: string;
  permit_status: string;
  county: string;
  submit_date: number | null;
  approval_date: number | null;
  expire_date: number | null;
}

// ---- Texas: RRC bulk files (pre-fetched sample, parsed) ----

interface TxPermitRecord {
  permit_number: string;
  county_code: string;
  lease_name: string;
  well_number: string;
  total_depth_ft: string;
  application_type: string | null;
  permit_issued_date: string | null;
  spud_date: string | null;
  nearest_city: string;
  horizontal_well: boolean;
  api_number: string | null;
}

interface TxPermitFile {
  source: string;
  layout_manual: string;
  counts: { '01_root': number; '02_permit': number; other_record_types_skipped: Record<string, number> };
  records: { '02_permit': TxPermitRecord[] };
}

interface TxWellRecord {
  standard_api_number: string | null;
  county_name: string;
  lease_name: string;
  operator_name: string;
  well_status: string;
  oil_gas_code: string;
  api_depth: string;
  completion_date: string;
  well_no_display: string;
}

interface TxWellFile {
  source: string;
  layout_manual: string;
  count: number;
  records: TxWellRecord[];
}

const OCC_BASE = 'https://gis.occ.ok.gov/server/rest/services/Hosted';

function epochToDate(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toISOString().slice(0, 10);
}

function yyyymmddToIso(s: string): string | null {
  if (!s || s.length < 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  epochToDate = epochToDate;
  tx_county_code_to_name = TX_COUNTY_CODE_TO_NAME;

  activeTab = signal<'ok' | 'tx'>('ok');

  constructor(private http: HttpClient) {
    this.searchOk();
    this.loadTxPermits();
    this.loadTxWells();
  }

  // ================= OKLAHOMA (live, state-level filters) =================

  okCounty = signal('');
  okStart = signal('');
  okEnd = signal('');
  okCount = signal(25);

  private buildOkWhere(countyField: string, dateField: string): string {
    const clauses: string[] = [];
    const county = this.okCounty().trim();
    if (county) clauses.push(`UPPER(${countyField}) LIKE UPPER('%${county.replace(/'/g, '')}%')`);
    if (this.okStart()) clauses.push(`${dateField} >= TIMESTAMP '${this.okStart()} 00:00:00'`);
    if (this.okEnd()) clauses.push(`${dateField} <= TIMESTAMP '${this.okEnd()} 23:59:59'`);
    return clauses.length ? clauses.join(' AND ') : '1=1';
  }

  searchOk() {
    this.loadOkWells();
    this.loadOkPermits();
  }

  okWellLoading = signal(false);
  okWellError = signal<string | null>(null);
  okWellFeatures = signal<OkFeature<OkWellAttributes>[]>([]);
  okWellRaw = signal<unknown>(null);
  okWellShowRaw = signal(false);
  okWellQueryUrl = signal('');

  private loadOkWells() {
    this.okWellLoading.set(true);
    this.okWellError.set(null);
    const where = this.buildOkWhere('county', 'well_completion');
    const params = new URLSearchParams({
      where,
      outFields: 'objectid,api_number,well_name,operator_name,well_status,well_type,county,spud,well_completion,total_depth',
      orderByFields: 'well_completion DESC',
      resultRecordCount: String(this.okCount()),
      f: 'json',
    });
    const url = `${OCC_BASE}/COMP_WELLS/FeatureServer/331/query?${params}`;
    this.okWellQueryUrl.set(url);
    this.http.get<{ features: OkFeature<OkWellAttributes>[] }>(url).subscribe({
      next: (res) => {
        this.okWellFeatures.set(res.features ?? []);
        this.okWellRaw.set(res);
        this.okWellLoading.set(false);
      },
      error: (err) => {
        this.okWellError.set(`Request failed: ${err.status} ${err.statusText ?? ''}`);
        this.okWellLoading.set(false);
      },
    });
  }

  okPermitLoading = signal(false);
  okPermitError = signal<string | null>(null);
  okPermitFeatures = signal<OkFeature<OkPermitAttributes>[]>([]);
  okPermitRaw = signal<unknown>(null);
  okPermitShowRaw = signal(false);
  okPermitQueryUrl = signal('');

  private loadOkPermits() {
    this.okPermitLoading.set(true);
    this.okPermitError.set(null);
    const where = this.buildOkWhere('county', 'submit_date');
    const params = new URLSearchParams({
      where,
      outFields: 'objectid,api_number,entity_name,well_name,well_number,application_type,permit_status,county,submit_date,approval_date,expire_date',
      orderByFields: 'submit_date DESC',
      resultRecordCount: String(this.okCount()),
      f: 'json',
    });
    const url = `${OCC_BASE}/ITD_WELLS/FeatureServer/290/query?${params}`;
    this.okPermitQueryUrl.set(url);
    this.http.get<{ features: OkFeature<OkPermitAttributes>[] }>(url).subscribe({
      next: (res) => {
        this.okPermitFeatures.set(res.features ?? []);
        this.okPermitRaw.set(res);
        this.okPermitLoading.set(false);
      },
      error: (err) => {
        this.okPermitError.set(`Request failed: ${err.status} ${err.statusText ?? ''}`);
        this.okPermitLoading.set(false);
      },
    });
  }

  // ================= TEXAS (static sample, client-side filters) =================

  txCounty = signal('');
  txStart = signal('');
  txEnd = signal('');

  txPermitData = signal<TxPermitFile | null>(null);
  txPermitLoading = signal(false);
  txPermitError = signal<string | null>(null);
  txPermitShowRaw = signal(false);

  loadTxPermits() {
    this.txPermitLoading.set(true);
    this.http.get<TxPermitFile>('data/tx_permits_sample.json').subscribe({
      next: (res) => {
        this.txPermitData.set(res);
        this.txPermitLoading.set(false);
      },
      error: (err) => {
        this.txPermitError.set(`Failed to load: ${err.status} ${err.statusText ?? ''}`);
        this.txPermitLoading.set(false);
      },
    });
  }

  filteredTxPermits = computed(() => {
    const all = this.txPermitData()?.records['02_permit'] ?? [];
    const countyText = this.txCounty().trim().toUpperCase();
    const codeFilter = countyText ? TX_COUNTY_NAME_TO_CODE[countyText] ?? countyText.replace(/\D/g, '') : '';
    const start = this.txStart();
    const end = this.txEnd();
    return all.filter((p) => {
      if (codeFilter && p.county_code !== codeFilter.padStart(3, '0')) return false;
      const d = p.permit_issued_date;
      if (start && (!d || d < start)) return false;
      if (end && (!d || d > end)) return false;
      return true;
    });
  });

  txWellData = signal<TxWellFile | null>(null);
  txWellLoading = signal(false);
  txWellError = signal<string | null>(null);
  txWellShowRaw = signal(false);

  loadTxWells() {
    this.txWellLoading.set(true);
    this.http.get<TxWellFile>('data/tx_wellbore_sample.json').subscribe({
      next: (res) => {
        this.txWellData.set(res);
        this.txWellLoading.set(false);
      },
      error: (err) => {
        this.txWellError.set(`Failed to load: ${err.status} ${err.statusText ?? ''}`);
        this.txWellLoading.set(false);
      },
    });
  }

  filteredTxWells = computed(() => {
    const all = this.txWellData()?.records ?? [];
    const countyText = this.txCounty().trim().toUpperCase();
    const start = this.txStart();
    const end = this.txEnd();
    return all.filter((w) => {
      if (countyText && !w.county_name.toUpperCase().includes(countyText)) return false;
      const d = yyyymmddToIso(w.completion_date);
      if (start && (!d || d < start)) return false;
      if (end && (!d || d > end)) return false;
      return true;
    });
  });
}
