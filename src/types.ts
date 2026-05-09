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
  officerPerformance: OfficerPerformance[];
  ulpPerformance: ULPPerformance[];
  cctvUsage: CCTVUsage[];
  summary: {
    totalBaca: number;
    totalValid: number;
    tidakValid: number;
    totalPo: number;
    totalPoCctv: number;
    lastSync: string;
    dataAktif: number;
  };
  allUlps: string[];
  allPoskos: string[];
  overSla: OverSLAData;
  rating: RatingData;
  rawWoRows: any[][];
  rawPoRows: any[][];
  woHeaders: string[];
  poHeaders: string[];
  woIndices: { name: number; ulp: number; cctv: number; tglLapor: number; tglPengerjaan: number; tglSelesai: number; source: number; reporter: number; shift: number; rpt: number; rct: number };
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

export interface RatingData {
  officerRatings: OfficerRating[];
  summary: {
    avgRating: number;
    totalFeedback: number;
  };
  totalWoPlnMobile: number;
  rating5: number;
  rating34: number;
  rating12: number;
  noRating: number;
  totalWoPlnMobileList: any[][];
  rating5List: any[][];
  rating34List: any[][];
  rating12List: any[][];
  noRatingList: any[][];
  kpRatings: KPRating[];
  ulpRatings: ULPRating[];
}

export interface ULPRating {
  namaUlp: string;
  totalWoPlnMobile: number;
  rating5: number;
  rating34: number;
  rating12: number;
  noRating: number;
  percentageKomulatif: string;
}

export interface KPRating {
  namaKp: string;
  ulp: string;
  regu: string;
  totalWoPlnMobile: number;
  rating5: number;
  rating34: number;
  rating12: number;
  noRating: number;
  percentageKomulatif: string;
}

export interface OfficerRating {
  name: string;
  ulp: string;
  regu: string;
  totalWoPlnMobile: number;
  rating5: number;
  rating34: number;
  rating12: number;
  noRating: number;
  percentageKomulatif: string;
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
