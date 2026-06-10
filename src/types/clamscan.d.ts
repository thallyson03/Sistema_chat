declare module 'clamscan' {
  interface ClamScanOptions {
    removeInfected?: boolean;
    quarantineInfected?: boolean;
    scanLog?: string | null;
    debugMode?: boolean;
    clamdscan?: {
      host?: string;
      port?: number;
      timeout?: number;
    };
    preference?: string;
  }

  interface ScanFileResult {
    isInfected: boolean;
    viruses?: string[];
  }

  export default class NodeClam {
    init(options: ClamScanOptions): Promise<NodeClam>;
    scanFile(filePath: string): Promise<ScanFileResult>;
  }
}
