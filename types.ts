export interface ProspectRow {
    id: string;
    name: string;
    company: string;
    email?: string;
    linkedinUrl?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_found' | 'deliverable' | 'undeliverable' | 'risky' | 'unknown' | 'found' | 'searching';
    error?: string;
    originalData: Record<string, any>;
    metadata?: any;
    cachedAt?: string;
    cachedType?: 'single' | 'bulk' | string;
    synced?: boolean;
}

export interface MappingConfig {
    nameHeader: string;
    companyHeader: string;
    emailHeader?: string;
}

export interface GetProspectResult {
    email?: string;
    success: boolean;
    message?: string;
}

export interface VerificationResult {
    success: boolean;
    status?: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
    message?: string;
    rawData?: any;
}

export interface HistoryEntry {
    id: string;
    type: 'single' | 'bulk';
    feature?: string;
    input: string;
    result: string;
    status: string;
    timestamp: number;
    data?: ProspectRow[];
    headers?: string[];
    mapping?: MappingConfig;
    synced?: boolean;
    hasCached?: boolean;
    cachedAt?: string;
    cachedType?: string;
    originalHistoryId?: string;
}
