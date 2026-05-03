export interface CCTVUsage {
  no: number;
  namaPetugas: string;
  ulp: string;
  jumlahWoTotal: number;
  totalWoPakaiCctv: number;
  persenWo: string;
  jumlahPoTotal: number;
  totalPoPakaiCctv: number;
  persenPo: string;
  persenPenggunaanCctv: string;
}

export interface DashboardData {
  unitRecap: UnitRecap[];
  officerPerformance: OfficerPerformance[];
  ulpPerformance: ULPPerformance[];
  cctvUsage: CCTVUsage[];
  mainTable: MainTableEntry[];
  summary: {
    totalBaca: number;
    totalValid: number;
    tidakValid: number;
    totalPo: number;
    totalPoCctv: number;
    lastSync: string;
    dataAktif: number;
  };
  overSla: OverSLAData;
  rawWoRows: any[][];
  rawPoRows: any[][];
  woHeaders: string[];
  poHeaders: string[];
  woIndices: { name: number; ulp: number; cctv: number; tglLapor: number; tglPengerjaan: number; tglSelesai: number; source: number; reporter: number; shift: number };
  poIndices: { name: number; ulp: number; cctv: number };
}

export interface OverSLAData {
  totalGangguan: number;
  highestRpt: number;
  highestRct: number;
  countRptOver30: number;
  countRptOver45: number;
  avgRpt: number;
  avgRct: number;
  woOverSlaRptList: any[][]; // Table data: No Laporan, Tgl Lapor, Nama Petugas, RPT, RCT
  shiftDistribution: { name: string; value: number }[];
  officerOverSlaRpt: { name: string; count: number }[];
  officerOverSlaRct: { name: string; count: number }[];
  ulpDistribution: { name: string; value: number }[];
}

export interface UnitRecap {
  unit: string;
  total: number;
  valid: number;
  invalid: number;
}

export interface OfficerPerformance {
  name: string;
  ulp: string;
  jumlahWoTotal: number;
  totalWoPakaiCctv: number;
  persenWo: string;
  jumlahPoTotal: number;
  totalPoPakaiCctv: number;
  persenPo: string;
}

export interface ULPPerformance {
  ulp: string;
  jumlahWoTotal: number;
  totalWoPakaiCctv: number;
  persenWo: string;
  jumlahPoTotal: number;
  totalPoPakaiCctv: number;
  persenPo: string;
  persenPenggunaanCctv: string;
}

export interface GeospatialPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  status: 'valid' | 'invalid';
}

export interface MainTableEntry {
  unit: string;
  idpel: string;
  name: string;
  petugas: string;
  valid: boolean;
  keterangan: string;
  tegangan: number;
  arus: number;
  cosphi: number;
  tarif: string;
  daya: number;
  kwh: number;
  kwhKumulatif: number;
}
